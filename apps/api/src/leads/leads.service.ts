import {
  type Lead,
  type LeadCreate,
  type LeadDetail,
  type LeadNoteHistory,
  type LeadListQuery,
  type LeadListResponse,
  type LeadUpdate,
} from '@app/shared';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeadPilotService } from '../integrations/leadpilot/leadpilot.service';
import { AppError } from '../common/http/app-error';
import { PrismaService } from '../infra/prisma.service';

type Row = {
  id: string;
  propertyId: string | null;
  source: Lead['source'];
  status: Lead['status'];
  label: string | null;
  email: string | null;
  phone: string | null;
  nextActionAt: Date | null;
  assignedToId: string | null;
  overdueNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  property: { title: string } | null;
};

const LEAD_SELECT = {
  id: true,
  propertyId: true,
  source: true,
  status: true,
  label: true,
  email: true,
  phone: true,
  nextActionAt: true,
  assignedToId: true,
  overdueNotifiedAt: true,
  createdAt: true,
  updatedAt: true,
  property: { select: { title: true } },
} as const;

/** Names of the input fields whose value differs from the saved lead. */
function changedFields(
  current: {
    propertyId: string | null;
    source: string;
    status: string;
    label: string | null;
    email: string | null;
    phone: string | null;
    nextActionAt: Date | null;
    assignedToId: string | null;
  },
  input: LeadUpdate,
): string[] {
  const out: string[] = [];
  if (input.propertyId !== undefined && input.propertyId !== current.propertyId)
    out.push('propertyId');
  if (input.source !== undefined && input.source !== current.source) out.push('source');
  if (input.status !== undefined && input.status !== current.status) out.push('status');
  if (input.label !== undefined && input.label !== current.label) out.push('label');
  if (input.email !== undefined && input.email !== current.email) out.push('email');
  if (input.phone !== undefined && input.phone !== current.phone) out.push('phone');
  if (input.assignedToId !== undefined && input.assignedToId !== current.assignedToId)
    out.push('assignedToId');
  if (input.nextActionAt !== undefined) {
    const next = input.nextActionAt ? new Date(input.nextActionAt).getTime() : null;
    const before = current.nextActionAt ? current.nextActionAt.getTime() : null;
    if (next !== before) out.push('nextActionAt');
  }
  return out;
}

const OPEN_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function toLead(r: Row): Lead {
  return {
    id: r.id,
    propertyId: r.propertyId,
    propertyTitle: r.property?.title ?? null,
    source: r.source,
    status: r.status,
    label: r.label,
    email: r.email,
    phone: r.phone,
    nextActionAt: r.nextActionAt?.toISOString() ?? null,
    assignedToId: r.assignedToId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leadpilot: LeadPilotService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(tenantId: string, query: LeadListQuery): Promise<LeadListResponse> {
    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.q
        ? {
            OR: [
              { label: { contains: query.q, mode: 'insensitive' as const } },
              { notes: { some: { body: { contains: query.q, mode: 'insensitive' as const } } } },
              { property: { title: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [total, rows, all, open, won, last30Days] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: LEAD_SELECT,
      }),
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.lead.count({ where: { tenantId, status: { in: [...OPEN_STATUSES] } } }),
      this.prisma.lead.count({ where: { tenantId, status: 'WON' } }),
      this.prisma.lead.count({ where: { tenantId, createdAt: { gte: since } } }),
    ]);
    return {
      items: rows.map(toLead),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: { total: all, open, won, last30Days },
    };
  }

  /** One lead with its own history from the audit trail. */
  async detail(tenantId: string, id: string): Promise<LeadDetail> {
    const row = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      select: LEAD_SELECT,
    });
    if (!row) throw AppError.notFound('Lead not found');
    const [notes, events] = await Promise.all([
      this.prisma.leadNote.findMany({
        where: { tenantId, leadId: id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 200,
        include: { _count: { select: { revisions: true } } },
      }),
      this.prisma.auditLog.findMany({
        // Note additions and removals already show as notes; they are not repeated here.
        where: {
          tenantId,
          targetType: 'lead',
          targetId: id,
          action: { notIn: ['lead.note_added', 'lead.note_deleted', 'lead.note_updated'] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    ]);
    const actorIds = [
      ...new Set(
        [
          ...notes.flatMap((n) => [n.authorId, n.editedById]),
          ...events.map((e) => e.actorUserId),
        ].filter((x): x is string => !!x),
      ),
    ];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    return {
      ...toLead(row),
      notes: notes.map((n) => ({
        id: n.id,
        body: n.body,
        authorName: n.authorId ? (names.get(n.authorId) ?? null) : null,
        editedAt: n.editedAt?.toISOString() ?? null,
        editorName: n.editedById ? (names.get(n.editedById) ?? null) : null,
        revisionCount: n._count.revisions,
        createdAt: n.createdAt.toISOString(),
      })),
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        actorName: e.actorUserId ? (names.get(e.actorUserId) ?? null) : null,
        metadata: (e.metadataJson as LeadDetail['events'][number]['metadata']) ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  /** Adds one step to the lead's notes. */
  async addNote(
    tenantId: string,
    userId: string,
    leadId: string,
    body: string,
    requestId: string | undefined,
  ): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: { id: true },
    });
    if (!lead) throw AppError.notFound('Lead not found');
    await this.prisma.$transaction(async (tx) => {
      const note = await tx.leadNote.create({
        data: { tenantId, leadId, authorId: userId, body },
        select: { id: true },
      });
      await this.audit.record(tx, {
        action: 'lead.note_added',
        tenantId,
        actorUserId: userId,
        targetType: 'lead',
        targetId: leadId,
        metadata: { noteId: note.id },
        requestId,
      });
    });
  }

  /**
   * Edits a note. The text it had before is kept with who wrote it and when, so the full
   * history stays readable. Notes are never deleted.
   */
  async updateNote(
    tenantId: string,
    userId: string,
    leadId: string,
    noteId: string,
    body: string,
    requestId: string | undefined,
  ): Promise<void> {
    const note = await this.prisma.leadNote.findFirst({
      where: { id: noteId, leadId, tenantId },
    });
    if (!note) throw AppError.notFound('Note not found');
    if (note.body === body) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.leadNoteRevision.create({
        data: {
          tenantId,
          noteId,
          body: note.body,
          writtenById: note.editedById ?? note.authorId,
          writtenAt: note.editedAt ?? note.createdAt,
          replacedById: userId,
        },
      });
      await tx.leadNote.update({
        where: { id: noteId },
        data: { body, editedAt: new Date(), editedById: userId },
      });
      await this.audit.record(tx, {
        action: 'lead.note_updated',
        tenantId,
        actorUserId: userId,
        targetType: 'lead',
        targetId: leadId,
        metadata: { noteId },
        requestId,
      });
    });
  }

  /** Current text plus every earlier text, newest earlier version first. */
  async noteHistory(tenantId: string, leadId: string, noteId: string): Promise<LeadNoteHistory> {
    const note = await this.prisma.leadNote.findFirst({
      where: { id: noteId, leadId, tenantId },
      include: { revisions: { orderBy: { replacedAt: 'desc' } } },
    });
    if (!note) throw AppError.notFound('Note not found');
    const ids = [
      ...new Set(
        [
          note.authorId,
          note.editedById,
          ...note.revisions.flatMap((r) => [r.writtenById, r.replacedById]),
        ].filter((x): x is string => !!x),
      ),
    ];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    return {
      current: {
        body: note.body,
        authorName: note.editedById
          ? (names.get(note.editedById) ?? null)
          : note.authorId
            ? (names.get(note.authorId) ?? null)
            : null,
        writtenAt: (note.editedAt ?? note.createdAt).toISOString(),
      },
      revisions: note.revisions.map((r) => ({
        body: r.body,
        authorName: r.writtenById ? (names.get(r.writtenById) ?? null) : null,
        writtenAt: r.writtenAt.toISOString(),
        replacedAt: r.replacedAt.toISOString(),
        replacedByName: r.replacedById ? (names.get(r.replacedById) ?? null) : null,
      })),
    };
  }

  async create(
    tenantId: string,
    userId: string,
    input: LeadCreate,
    requestId: string | undefined,
  ): Promise<Lead> {
    await this.assertProperty(tenantId, input.propertyId ?? null);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.lead.create({
        data: {
          tenantId,
          propertyId: input.propertyId ?? null,
          source: input.source,
          status: input.status,
          label: input.label ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
          assignedToId: input.assignedToId ?? null,
          createdById: userId,
        },
        select: LEAD_SELECT,
      });
      if (input.note) {
        await tx.leadNote.create({
          data: { tenantId, leadId: row.id, authorId: userId, body: input.note },
        });
      }
      await this.audit.record(tx, {
        action: 'lead.created',
        tenantId,
        actorUserId: userId,
        targetType: 'lead',
        targetId: row.id,
        metadata: { source: row.source, status: row.status },
        requestId,
      });
      return toLead(row);
    });
    // Forwarded in the background: a LeadPilot outage never blocks creating the lead.
    await this.leadpilot.enqueuePush(tenantId, created.id);
    if (created.assignedToId && created.assignedToId !== userId) {
      await this.notifications.create(this.prisma, {
        tenantId,
        userId: created.assignedToId,
        kind: 'lead.assigned',
        title: 'Size bir lead atandı',
        body: created.label ?? null,
        link: `/leads/${created.id}`,
      });
    }
    return created;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    input: LeadUpdate,
    requestId: string | undefined,
  ): Promise<Lead> {
    const existing = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      select: LEAD_SELECT,
    });
    if (!existing) throw AppError.notFound('Lead not found');
    if (input.propertyId !== undefined) await this.assertProperty(tenantId, input.propertyId);
    // Only what really changed counts: a form that re-sends unchanged values records nothing.
    const changed = changedFields(existing, input);
    if (changed.length === 0) return toLead(existing);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.lead.update({
        where: { id },
        data: {
          ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
          ...(changed.includes('nextActionAt') ? { overdueNotifiedAt: null } : {}),
          ...(input.nextActionAt !== undefined
            ? { nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null }
            : {}),
        },
        select: LEAD_SELECT,
      });
      await this.audit.record(tx, {
        action: 'lead.updated',
        tenantId,
        actorUserId: userId,
        targetType: 'lead',
        targetId: id,
        metadata: {
          fields: changed.join(','),
          status: row.status,
          nextActionAt: row.nextActionAt?.toISOString() ?? null,
        },
        requestId,
      });
      return toLead(row);
    });
    if (input.assignedToId && changed.includes('assignedToId') && input.assignedToId !== userId) {
      await this.notifications.create(this.prisma, {
        tenantId,
        userId: input.assignedToId,
        kind: 'lead.assigned',
        title: 'Size bir lead atandı',
        body: updated.label ?? null,
        link: `/leads/${id}`,
      });
    }
    return updated;
  }

  async remove(
    tenantId: string,
    userId: string,
    id: string,
    requestId: string | undefined,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.lead.deleteMany({ where: { id, tenantId } });
      if (deleted.count !== 1) throw AppError.notFound('Lead not found');
      await this.audit.record(tx, {
        action: 'lead.deleted',
        tenantId,
        actorUserId: userId,
        targetType: 'lead',
        targetId: id,
        requestId,
      });
    });
  }

  /** A lead can only point at a property of the same workspace. */
  private async assertProperty(tenantId: string, propertyId: string | null): Promise<void> {
    if (!propertyId) return;
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });
    if (!property) throw AppError.notFound('Property not found');
  }
}
