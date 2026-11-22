import { NotificationsService } from '../notifications/notifications.service';
import type {
  AuditCategory,
  AuditLogQuery,
  AuditLogResponse,
  CreateTenantRequest,
  DashboardStats,
  Member,
  MembershipRole,
  TenantDetail,
  TenantProfileUpdate,
  TenantSummary,
} from '@app/shared';
import { AppError } from '../common/http/app-error';
import { Prisma } from '../generated/prisma/client';
import { hasAtLeast, ROLE_NAME_TR } from './roles';
import { NOTIFICATION_CATALOG } from '@app/shared';

const TEAM_NOTICE_KINDS = NOTIFICATION_CATALOG.filter((k) => k.group === 'team').map((k) => k.kind);
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PrismaService } from '../infra/prisma.service';
import { StorageService } from '../infra/storage.service';
import { makeSlug } from './slug';

const MAX_SLUG_ATTEMPTS = 3;

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
  ) {}

  /** Creates a workspace with the caller as OWNER, plus the configured signup subscription. */
  async create(
    userId: string,
    input: CreateTenantRequest,
    requestId: string | undefined,
  ): Promise<TenantSummary> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.createOnce(userId, input, requestId, attempt);
      } catch (err) {
        const slugClash =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!slugClash || attempt >= MAX_SLUG_ATTEMPTS) throw err;
      }
    }
  }

  private async createOnce(
    userId: string,
    input: CreateTenantRequest,
    requestId: string | undefined,
    attempt: number,
  ): Promise<TenantSummary> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: makeSlug(input.name, attempt),
          sector: input.sector ?? null,
          teamSizeBand: input.teamSizeBand ?? null,
          referralSource: input.referralSource ?? null,
          expectedVideosPerMonth: input.expectedVideosPerMonth ?? null,
        },
      });
      await tx.membership.create({ data: { tenantId: tenant.id, userId, role: 'OWNER' } });
      await this.audit.record(tx, {
        action: 'tenant.created',
        tenantId: tenant.id,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenant.id,
        requestId,
      });
      await this.startSignupSubscription(tx, tenant.id, userId, requestId);
      return { id: tenant.id, name: tenant.name, slug: tenant.slug, role: 'OWNER' as const };
    });
  }

  /**
   * SIGNUP_PLAN_CODE is a dev/pilot setting: the blueprint defines no free trial, so production
   * leaves it empty and subscriptions come from billing (later milestone).
   */
  private async startSignupSubscription(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    requestId: string | undefined,
  ): Promise<void> {
    const code = this.config.SIGNUP_PLAN_CODE;
    if (!code) return;
    const plan = await tx.plan.findUnique({ where: { code } });
    if (!plan || !plan.isActive) {
      this.logger.warn({ planCode: code }, 'SIGNUP_PLAN_CODE does not match an active plan');
      return;
    }
    const now = new Date();
    const subscription = await tx.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'TRIALING',
        currentPeriodStart: now,
        currentPeriodEnd: addMonths(now, 1),
      },
    });
    await this.audit.record(tx, {
      action: 'subscription.started',
      tenantId,
      actorUserId: userId,
      targetType: 'subscription',
      targetId: subscription.id,
      metadata: { planCode: plan.code, status: 'TRIALING', source: 'signup_config' },
      requestId,
    });
  }

  async members(tenantId: string): Promise<Member[]> {
    const rows = await this.prisma.membership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true, avatarStorageKey: true } },
      },
    });
    return Promise.all(
      rows.map(async (m) => ({
        membershipId: m.id,
        role: m.role,
        status: m.status,
        joinedAt: m.createdAt.toISOString(),
        user: {
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          avatarUrl: m.user.avatarStorageKey
            ? await this.storage.signedGetUrl(m.user.avatarStorageKey)
            : null,
        },
      })),
    );
  }

  /**
   * Loads a membership to change and checks the caller may touch it: not yourself, not an owner,
   * and not above the caller's own role.
   */
  private async manageable(
    tenantId: string,
    actor: { userId: string; role: MembershipRole },
    membershipId: string,
  ) {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
    });
    if (!target) throw AppError.notFound('Member not found');
    if (target.userId === actor.userId)
      throw AppError.forbidden('Kendi üyeliğinizi değiştiremezsiniz.');
    if (target.role === 'OWNER') throw AppError.forbidden('Sahip üyeliği değiştirilemez.');
    if (!hasAtLeast(actor.role, target.role))
      throw AppError.forbidden('Sizden yetkili bir üye değiştirilemez.');
    return target;
  }

  async changeRole(
    tenantId: string,
    actor: { userId: string; role: MembershipRole },
    membershipId: string,
    role: Exclude<MembershipRole, 'OWNER'>,
    requestId: string | undefined,
  ): Promise<void> {
    const target = await this.manageable(tenantId, actor, membershipId);
    if (!hasAtLeast(actor.role, role)) throw AppError.forbidden('Bu rolü veremezsiniz.');
    const [byUser, memberUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
      this.prisma.user.findUnique({
        where: { id: target.userId },
        select: { name: true, email: true },
      }),
    ]);
    const details = [
      { label: 'Kişi', value: `${memberUser?.name ?? '—'} (${memberUser?.email ?? '—'})` },
      { label: 'Eski rol', value: ROLE_NAME_TR[target.role] },
      { label: 'Yeni rol', value: ROLE_NAME_TR[role] },
      { label: 'Değiştiren', value: byUser?.name ?? '—' },
    ];
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: target.id }, data: { role } });
      // Team notice switches saved for the old role are dropped, so the new role's defaults apply.
      await tx.notificationPreference.deleteMany({
        where: { tenantId, userId: target.userId, kind: { in: TEAM_NOTICE_KINDS } },
      });
      await this.audit.record(tx, {
        action: 'membership.role_changed',
        tenantId,
        actorUserId: actor.userId,
        targetType: 'membership',
        targetId: target.id,
        metadata: { from: target.role, to: role },
        requestId,
      });
      await this.notifications.notifyTeam(
        tenantId,
        {
          kind: 'team.member_changed',
          title: 'Üye rolü değişti',
          body: `${memberUser?.name ?? 'Bir üye'}: ${ROLE_NAME_TR[target.role]} → ${ROLE_NAME_TR[role]}`,
          link: '/team',
          details,
        },
        tx,
      );
    });
  }

  async setStatus(
    tenantId: string,
    actor: { userId: string; role: MembershipRole },
    membershipId: string,
    status: 'ACTIVE' | 'DISABLED',
    requestId: string | undefined,
  ): Promise<void> {
    const target = await this.manageable(tenantId, actor, membershipId);
    if (target.status === status) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: target.id }, data: { status } });
      await this.audit.record(tx, {
        action: 'membership.status_changed',
        tenantId,
        actorUserId: actor.userId,
        targetType: 'membership',
        targetId: target.id,
        metadata: { from: target.status, to: status },
        requestId,
      });
    });
  }

  async remove(
    tenantId: string,
    actor: { userId: string; role: MembershipRole },
    membershipId: string,
    requestId: string | undefined,
  ): Promise<void> {
    const target = await this.manageable(tenantId, actor, membershipId);
    const [byUser, memberUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
      this.prisma.user.findUnique({
        where: { id: target.userId },
        select: { name: true, email: true },
      }),
    ]);
    const details = [
      { label: 'Kişi', value: `${memberUser?.name ?? '—'} (${memberUser?.email ?? '—'})` },
      { label: 'Rol', value: ROLE_NAME_TR[target.role] },
      { label: 'Çıkaran', value: byUser?.name ?? '—' },
    ];
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: target.id } });
      await this.audit.record(tx, {
        action: 'membership.removed',
        tenantId,
        actorUserId: actor.userId,
        targetType: 'membership',
        targetId: target.id,
        metadata: { role: target.role },
        requestId,
      });
      await this.notifications.notifyTeam(
        tenantId,
        {
          kind: 'team.member_changed',
          title: 'Üye ekipten çıkarıldı',
          body: `${memberUser?.name ?? 'Bir üye'} (${ROLE_NAME_TR[target.role]}) çıkarıldı.`,
          link: '/team',
          details,
        },
        tx,
      );
    });
  }

  async detail(tenantId: string): Promise<TenantDetail> {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      legalName: t.legalName,
      taxOffice: t.taxOffice,
      taxNumber: t.taxNumber,
      phone: t.phone,
      website: t.website,
      addressLine: t.addressLine,
      city: t.city,
      district: t.district,
      timezone: t.timezone,
      sector: t.sector,
      teamSizeBand: t.teamSizeBand,
      expectedVideosPerMonth: t.expectedVideosPerMonth,
      createdAt: t.createdAt.toISOString(),
    };
  }

  async updateProfile(
    tenantId: string,
    actorUserId: string,
    input: TenantProfileUpdate,
    requestId: string | undefined,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const data = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      ) as Prisma.TenantUncheckedUpdateInput;
      await tx.tenant.update({ where: { id: tenantId }, data });
      await this.audit.record(tx, {
        action: 'tenant.updated',
        tenantId,
        actorUserId,
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { fields: Object.keys(input).join(',') },
        requestId,
      });
    });
    return this.detail(tenantId);
  }

  /** Numbers for the dashboard. Everything counted is scoped to the workspace. */
  async stats(tenantId: string): Promise<DashboardStats> {
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [properties, withoutPhotos, videosThisMonth, importsPending, credits, pool, activity] =
      await Promise.all([
        this.prisma.property.count({ where: { tenantId } }),
        this.prisma.property.count({ where: { tenantId, assets: { none: {} } } }),
        this.prisma.videoGeneration.count({
          where: { tenantId, stage: 'COMPLETED', completedAt: { gte: monthStart } },
        }),
        this.prisma.syncRun.count({
          where: {
            tenantId,
            kind: 'FILE_IMPORT',
            status: { in: ['UPLOADED', 'QUEUED', 'RUNNING'] },
          },
        }),
        this.prisma.creditAccount.findUnique({ where: { tenantId }, select: { available: true } }),
        this.prisma.freeRegenerationAccount.findFirst({
          where: { tenantId },
          orderBy: { periodStart: 'desc' },
          select: { available: true },
        }),
        this.prisma.auditLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);
    const recentActivity = await this.groupActivity(tenantId, activity);
    return {
      properties,
      propertiesWithoutPhotos: withoutPhotos,
      videosThisMonth,
      importsPending,
      credits: credits?.available ?? 0,
      freeRegenerations: pool?.available ?? 0,
      recentActivity,
    };
  }

  /**
   * Merges a bulk upload into one entry: same person, same action, same property, and each
   * entry no more than 2 minutes after the previous one. Anything later is a new entry.
   */
  private async groupActivity(
    tenantId: string,
    rows: {
      id: string;
      action: string;
      actorUserId: string | null;
      targetType: string | null;
      targetId: string | null;
      metadataJson: unknown;
      createdAt: Date;
    }[],
  ) {
    const WINDOW_MS = 2 * 60 * 1000;
    const groups: {
      first: (typeof rows)[number];
      last: (typeof rows)[number];
      count: number;
      propertyId: string | null;
    }[] = [];
    for (const row of rows) {
      const propertyId =
        ((row.metadataJson as { propertyId?: unknown } | null)?.propertyId as string | undefined) ??
        null;
      const prev = groups[groups.length - 1];
      const mergeable =
        prev &&
        prev.first.action === row.action &&
        prev.first.actorUserId === row.actorUserId &&
        prev.propertyId === propertyId &&
        propertyId !== null &&
        prev.last.createdAt.getTime() - row.createdAt.getTime() <= WINDOW_MS;
      if (mergeable) {
        prev.count++;
        prev.last = row;
      } else {
        groups.push({ first: row, last: row, count: 1, propertyId });
      }
      if (groups.length >= 8) break;
    }
    const propertyIds = [
      ...new Set(groups.map((g) => g.propertyId).filter((i): i is string => !!i)),
    ];
    const properties = propertyIds.length
      ? await this.prisma.property.findMany({
          where: { tenantId, id: { in: propertyIds } },
          select: { id: true, title: true },
        })
      : [];
    const titles = new Map(properties.map((p) => [p.id, p.title]));
    const leadIds = groups
      .filter((g) => g.first.targetType === 'lead' && g.first.targetId)
      .map((g) => g.first.targetId as string);
    const leadNames = await this.leadLabels(tenantId, leadIds);
    const names = await this.userNames(groups.map((g) => g.first.actorUserId));
    return groups.map((g) => ({
      id: g.first.id,
      action: g.first.action,
      actorName: g.first.actorUserId ? (names.get(g.first.actorUserId) ?? null) : null,
      count: g.count,
      propertyTitle: g.propertyId ? (titles.get(g.propertyId) ?? null) : null,
      subject: this.subjectOf(g.first, titles, leadNames),
      subjectId: this.subjectIdOf(g.first),
      detail: videoDetail(g.first.action, g.first.metadataJson),
      createdAt: g.first.createdAt.toISOString(),
    }));
  }

  /** Short name of a lead, or a neutral label when it was deleted. */
  private async leadLabels(tenantId: string, ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, label: true },
    });
    return new Map(leads.map((l) => [l.id, l.label ?? 'İsimsiz lead']));
  }

  private subjectIdOf(row: { targetType: string | null; targetId: string | null }): string | null {
    return row.targetType === 'lead' ? row.targetId : null;
  }

  private subjectOf(
    row: {
      action: string;
      targetType: string | null;
      targetId: string | null;
      metadataJson: unknown;
    },
    titles: Map<string, string>,
    leadNames: Map<string, string>,
  ): string | null {
    if (row.targetType === 'lead' && row.targetId) {
      return leadNames.get(row.targetId) ?? 'Silinmiş lead';
    }
    const propertyId = (row.metadataJson as { propertyId?: string } | null)?.propertyId;
    return propertyId ? (titles.get(propertyId) ?? null) : null;
  }

  async auditLog(tenantId: string, query: AuditLogQuery): Promise<AuditLogResponse> {
    const where = await this.auditWhere(tenantId, query);
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const names = await this.userNames(rows.map((r) => r.actorUserId));
    const leadNames = await this.leadLabels(
      tenantId,
      rows.filter((r) => r.targetType === 'lead' && r.targetId).map((r) => r.targetId as string),
    );
    const propertyIds = rows
      .map((r) => (r.metadataJson as { propertyId?: string } | null)?.propertyId)
      .filter((x): x is string => !!x);
    const titles = propertyIds.length
      ? new Map(
          (
            await this.prisma.property.findMany({
              where: { tenantId, id: { in: [...new Set(propertyIds)] } },
              select: { id: true, title: true },
            })
          ).map((p) => [p.id, p.title]),
        )
      : new Map<string, string>();
    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        actorName: r.actorUserId ? (names.get(r.actorUserId) ?? null) : null,
        targetType: r.targetType,
        targetId: r.targetId,
        subject: this.subjectOf(r, titles, leadNames),
        subjectId: this.subjectIdOf(r),
        metadata: (r.metadataJson as Record<string, unknown> | null) ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Filters for the audit list. Free text matches person, lead or property names. */
  private async auditWhere(
    tenantId: string,
    query: AuditLogQuery,
  ): Promise<Prisma.AuditLogWhereInput> {
    const and: Prisma.AuditLogWhereInput[] = [{ tenantId }];
    if (query.category !== 'all') {
      and.push({
        OR: AUDIT_CATEGORY_PREFIXES[query.category].map((p) => ({
          action: { startsWith: p },
        })),
      });
    }
    if (query.actorUserId) and.push({ actorUserId: query.actorUserId });
    // Turkish calendar days.
    if (query.from) and.push({ createdAt: { gte: new Date(`${query.from}T00:00:00+03:00`) } });
    if (query.to) and.push({ createdAt: { lte: new Date(`${query.to}T23:59:59.999+03:00`) } });
    const term = query.q?.trim();
    if (term) {
      const contains = { contains: term, mode: 'insensitive' as const };
      const [members, leads, properties] = await Promise.all([
        this.prisma.membership.findMany({
          where: { tenantId, user: { name: contains } },
          select: { userId: true },
        }),
        this.prisma.lead.findMany({
          where: { tenantId, label: contains },
          select: { id: true },
        }),
        this.prisma.property.findMany({
          where: { tenantId, title: contains },
          select: { id: true },
        }),
      ]);
      and.push({
        OR: [
          { actorUserId: { in: members.map((m) => m.userId) } },
          { targetType: 'lead', targetId: { in: leads.map((l) => l.id) } },
          { targetId: { in: properties.map((p) => p.id) } },
        ],
      });
    }
    return { AND: and };
  }

  private async userNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((i): i is string => !!i))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}

const AUDIT_CATEGORY_PREFIXES: Record<Exclude<AuditCategory, 'all'>, string[]> = {
  leads: ['lead.'],
  properties: ['property.'],
  videos: ['video.'],
  imports: ['import.'],
  team: ['membership.', 'invitation.', 'tenant.'],
  billing: ['subscription.', 'credits.'],
  account: ['auth.', 'account.'],
};

/**
 * Text for a video start. "Toplam Kredi" is the balance before the start; a paid start takes
 * one credit, a free regeneration takes none.
 */
function videoDetail(action: string, metadata: unknown): string | null {
  if (action !== 'video.generation_started' || !metadata) return null;
  const m = metadata as { billingType?: string; creditsLeft?: number; freeLeft?: number };
  const paid = m.billingType !== 'FREE_REGENERATION';
  const left = m.creditsLeft ?? 0;
  const total = paid ? left + 1 : left;
  return `Toplam Kredi ${total} · Kalan Kredi ${left} · Ücretsiz Üretim ${m.freeLeft ?? 0}`;
}
