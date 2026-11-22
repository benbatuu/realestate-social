import {
  NOTIFICATION_CATALOG,
  type NotificationDetail,
  type NotificationPreference,
} from '@app/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../common/http/app-error';
import { PrismaService } from '../infra/prisma.service';

const TEAM_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

export interface NotifyInput {
  tenantId: string;
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  details?: NotificationDetail[] | null;
}

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
  details: NotificationDetail[] | null;
}

type Db = Pick<PrismaService, 'notification' | 'membership' | 'notificationPreference'>;

/** In-app notices. Writers call `create` inside the same change that caused the event. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes a notice unless the member switched this kind off. */
  async create(db: Db, input: NotifyInput): Promise<void> {
    if (!(await this.allowed(input.tenantId, input.userId, input.kind, db))) return;
    await db.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        ...(input.details ? { details: input.details } : {}),
      },
    });
  }

  /** Same notice to every member with a team role (owner, admin, manager) who wants it. */
  /** Pass the open transaction as `db` when called inside one, so no second connection is needed. */
  async notifyTeam(
    tenantId: string,
    input: Omit<NotifyInput, 'tenantId' | 'userId'>,
    db: Db = this.prisma,
  ): Promise<void> {
    const members = await db.membership.findMany({
      where: { tenantId, role: { in: TEAM_ROLES as never } },
      select: { userId: true },
    });
    for (const m of members) {
      await this.create(db, { ...input, tenantId, userId: m.userId });
    }
  }

  /** The member's switch for a kind; without a saved choice, the role default applies. */
  async allowed(
    tenantId: string,
    userId: string,
    kind: string,
    db: Db = this.prisma,
  ): Promise<boolean> {
    const entry = NOTIFICATION_CATALOG.find((k) => k.kind === kind);
    if (!entry) return true;
    const pref = await db.notificationPreference.findUnique({
      where: { tenantId_userId_kind: { tenantId, userId, kind } },
      select: { enabled: true },
    });
    if (pref) return pref.enabled;
    const membership = await db.membership.findFirst({
      where: { tenantId, userId },
      select: { role: true },
    });
    return membership ? (entry.defaultRoles as readonly string[]).includes(membership.role) : false;
  }

  /** Every kind with the member's current switch, for the settings screen. */
  async preferences(tenantId: string, userId: string): Promise<NotificationPreference[]> {
    return Promise.all(
      NOTIFICATION_CATALOG.map(async (k) => ({
        kind: k.kind,
        label: k.label,
        group: k.group,
        enabled: await this.allowed(tenantId, userId, k.kind),
      })),
    );
  }

  async setPreference(
    tenantId: string,
    userId: string,
    kind: string,
    enabled: boolean,
  ): Promise<void> {
    if (!NOTIFICATION_CATALOG.some((k) => k.kind === kind))
      throw AppError.notFound('Unknown notification kind');
    await this.prisma.notificationPreference.upsert({
      where: { tenantId_userId_kind: { tenantId, userId, kind } },
      create: { tenantId, userId, kind, enabled },
      update: { enabled },
    });
  }

  /**
   * Open leads whose next step time has passed and whose assignee has not been told yet.
   * Each lead is announced once; changing its next step time re-arms it.
   */
  async notifyOverdueFollowups(now: Date = new Date()): Promise<number> {
    const leads = await this.prisma.lead.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
        nextActionAt: { lt: now },
        overdueNotifiedAt: null,
      },
      select: { id: true, tenantId: true, label: true, assignedToId: true },
      take: 500,
    });
    for (const lead of leads) {
      if (!lead.assignedToId) continue;
      await this.create(this.prisma, {
        tenantId: lead.tenantId,
        userId: lead.assignedToId,
        kind: 'lead.followup_overdue',
        title: 'Sonraki adımı gecikmiş lead',
        body: lead.label,
        link: `/leads/${lead.id}`,
      });
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { overdueNotifiedAt: now },
      });
    }
    return leads.length;
  }

  /** Kinds the member may see right now: their role's defaults plus their own switches. */
  private async visibleKinds(tenantId: string, userId: string): Promise<string[]> {
    const prefs = await this.preferences(tenantId, userId);
    return prefs.filter((p) => p.enabled).map((p) => p.kind);
  }

  async list(
    tenantId: string,
    userId: string,
    query: {
      page: number;
      pageSize: number;
      q?: string | undefined;
      read: 'all' | 'unread' | 'read';
      kind?: string | undefined;
    },
  ) {
    const { page, pageSize } = query;
    // Filtered by the current role, so a notice from an earlier role does not stay visible.
    const kinds = await this.visibleKinds(tenantId, userId);
    const term = query.q?.trim();
    const where = {
      tenantId,
      userId,
      kind: query.kind ? { in: kinds.filter((k) => k === query.kind) } : { in: kinds },
      ...(query.read === 'unread' ? { readAt: null } : {}),
      ...(query.read === 'read' ? { readAt: { not: null } } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: 'insensitive' as const } },
              { body: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map(toView),
      total,
      unread: await this.unreadCount(tenantId, userId),
      page,
      pageSize,
    };
  }

  async unreadCount(tenantId: string, userId: string): Promise<number> {
    const kinds = await this.visibleKinds(tenantId, userId);
    return this.prisma.notification.count({
      where: { tenantId, userId, readAt: null, kind: { in: kinds } },
    });
  }

  async markRead(tenantId: string, userId: string, id: string): Promise<void> {
    const moved = await this.prisma.notification.updateMany({
      where: { id, tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (moved.count === 0) {
      const exists = await this.prisma.notification.count({ where: { id, tenantId, userId } });
      if (exists === 0) throw AppError.notFound('Notification not found');
    }
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

function toView(r: {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  details: unknown;
  readAt: Date | null;
  createdAt: Date;
}): NotificationView {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    link: r.link,
    read: r.readAt !== null,
    createdAt: r.createdAt.toISOString(),
    details: (r.details as NotificationDetail[] | null) ?? null,
  };
}
