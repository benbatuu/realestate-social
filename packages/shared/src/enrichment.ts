import { z } from 'zod';

export const dashboardStatsSchema = z.object({
  properties: z.number().int(),
  propertiesWithoutPhotos: z.number().int(),
  videosThisMonth: z.number().int(),
  importsPending: z.number().int(),
  credits: z.number().int(),
  freeRegenerations: z.number().int(),
  recentActivity: z.array(
    z.object({
      id: z.uuid(),
      action: z.string(),
      actorName: z.string().nullable(),
      /** Entries merged into this one (a bulk upload counts as one activity). */
      count: z.number().int().min(1),
      propertyTitle: z.string().nullable(),
      /** What the action was about: a property or a lead's short name. */
      subject: z.string().nullable(),
      /** The lead, when the action was about a lead: opens its page. */
      subjectId: z.string().nullable(),
      /** Short line under the entry, e.g. how a video was paid and what is left. */
      detail: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const AUDIT_CATEGORIES = [
  'all',
  'leads',
  'properties',
  'videos',
  'imports',
  'team',
  'billing',
  'account',
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  /** Free text: matches the person, lead or property name. */
  q: z.string().trim().max(100).optional(),
  category: z.enum(AUDIT_CATEGORIES).default('all'),
  actorUserId: z.uuid().optional(),
  /** Calendar days in Turkish time, inclusive. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      action: z.string(),
      actorName: z.string().nullable(),
      targetType: z.string().nullable(),
      targetId: z.string().nullable(),
      subject: z.string().nullable(),
      subjectId: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()).nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

export const dataRequestSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['EXPORT', 'DELETE']),
  status: z.enum(['OPEN', 'DONE']),
  createdAt: z.iso.datetime(),
});
export type DataRequest = z.infer<typeof dataRequestSchema>;

export const DELETION_REASONS = [
  'NOT_USING',
  'TOO_EXPENSIVE',
  'MISSING_FEATURE',
  'SWITCHING_TOOL',
  'PRIVACY_CONCERN',
  'OTHER',
] as const;
export const DELETION_GRACE_DAYS = 14;

export const deletionRequestSchema = z.object({
  reason: z.enum(DELETION_REASONS),
  reasonDetail: z.string().trim().max(500).optional(),
});
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;

export const accountDeletionSchema = z.object({
  id: z.uuid(),
  status: z.enum(['OPEN', 'DONE', 'CANCELLED']),
  reason: z.enum(DELETION_REASONS).nullable(),
  requestedAt: z.iso.datetime(),
  scheduledFor: z.iso.datetime(),
});
export type AccountDeletion = z.infer<typeof accountDeletionSchema>;
