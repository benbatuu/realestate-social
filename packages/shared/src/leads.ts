import { z } from 'zod';

/**
 * Leads: people who asked about a property. No phone, email or full name is stored here:
 * the label is a short reference chosen by the user (blueprint §10.3, data minimisation).
 */
export const LEAD_SOURCES = ['MANUAL', 'WEB_FORM', 'PHONE', 'CRM', 'OTHER'] as const;
export const leadSourceSchema = z.enum(LEAD_SOURCES);
export type LeadSource = z.infer<typeof leadSourceSchema>;

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'] as const;
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const leadSchema = z.object({
  id: z.uuid(),
  propertyId: z.uuid().nullable(),
  propertyTitle: z.string().nullable(),
  assignedToId: z.uuid().nullable(),
  source: leadSourceSchema,
  status: leadStatusSchema,
  label: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  nextActionAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Lead = z.infer<typeof leadSchema>;

export const leadCreateSchema = z.object({
  propertyId: z.uuid().nullable().optional(),
  assignedToId: z.uuid().nullable().optional(),
  source: leadSourceSchema.default('MANUAL'),
  status: leadStatusSchema.default('NEW'),
  label: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().email().max(120).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  /** Becomes the first note of the lead. */
  note: z.string().trim().max(2000).nullable().optional(),
  nextActionAt: z.iso.datetime().nullable().optional(),
});
export type LeadCreate = z.infer<typeof leadCreateSchema>;

export const leadUpdateSchema = z
  .object({
    propertyId: z.uuid().nullable(),
    assignedToId: z.uuid().nullable(),
    source: leadSourceSchema,
    status: leadStatusSchema,
    label: z.string().trim().max(80).nullable(),
    email: z.string().trim().email().max(120).nullable(),
    phone: z.string().trim().max(30).nullable(),
    nextActionAt: z.iso.datetime().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'En az bir alan değiştirilmeli.');
export type LeadUpdate = z.infer<typeof leadUpdateSchema>;

export const leadListQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  source: leadSourceSchema.optional(),
  propertyId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(25),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

export const leadListResponseSchema = z.object({
  items: z.array(leadSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** Whole workspace, not the filtered list. */
  summary: z.object({
    total: z.number().int(),
    open: z.number().int(),
    won: z.number().int(),
    last30Days: z.number().int(),
  }),
});
export type LeadListResponse = z.infer<typeof leadListResponseSchema>;

export const leadEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  actorName: z.string().nullable(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable(),
  createdAt: z.iso.datetime(),
});
export type LeadEvent = z.infer<typeof leadEventSchema>;

export const leadNoteSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  authorName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  /** Set when the note was edited at least once. */
  editedAt: z.iso.datetime().nullable(),
  editorName: z.string().nullable(),
  revisionCount: z.number().int(),
});
export type LeadNote = z.infer<typeof leadNoteSchema>;

export const leadNoteHistorySchema = z.object({
  /** The text people read now. */
  current: z.object({
    body: z.string(),
    authorName: z.string().nullable(),
    writtenAt: z.iso.datetime(),
  }),
  /** Earlier texts, newest first. */
  revisions: z.array(
    z.object({
      body: z.string(),
      authorName: z.string().nullable(),
      writtenAt: z.iso.datetime(),
      replacedAt: z.iso.datetime(),
      replacedByName: z.string().nullable(),
    }),
  ),
});
export type LeadNoteHistory = z.infer<typeof leadNoteHistorySchema>;

export const leadNoteCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type LeadNoteCreate = z.infer<typeof leadNoteCreateSchema>;

export const leadNoteUpdateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type LeadNoteUpdate = z.infer<typeof leadNoteUpdateSchema>;

export const leadDetailSchema = leadSchema.extend({
  /** Oldest first. */
  notes: z.array(leadNoteSchema),
  /** Newest first: creation, edits and status changes. */
  events: z.array(leadEventSchema),
});
export type LeadDetail = z.infer<typeof leadDetailSchema>;
