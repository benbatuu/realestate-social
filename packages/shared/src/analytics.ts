import { z } from 'zod';

/**
 * Property analysis. Only data this product holds is used: photos, description, data coverage,
 * videos and leads. Portal views and clicks are not available, so they are not shown as numbers.
 */
export const analyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((d) => [30, 90, 365].includes(d), 'days 30, 90 or 365')
    .default(30),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const analyticsPropertySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  listingType: z.enum(['SALE', 'RENT']),
  ageDays: z.number().int(),
  photoCount: z.number().int(),
  hasDescription: z.boolean(),
  coverageScore: z.number().int(),
  videoCount: z.number().int(),
  leadsInPeriod: z.number().int(),
  leadsOpen: z.number().int(),
  leadsWon: z.number().int(),
  leadsLost: z.number().int(),
  leadsTotal: z.number().int(),
});
export type AnalyticsProperty = z.infer<typeof analyticsPropertySchema>;

export const analyticsSnapshotStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(['RUNNING', 'DONE', 'FAILED']),
  requestedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});
export type AnalyticsSnapshotStatus = z.infer<typeof analyticsSnapshotStatusSchema>;

/** The newest finished result for the period, and the newest run (which may still be running). */
export const analyticsLatestSchema = z.object({
  run: analyticsSnapshotStatusSchema.nullable(),
  data: z.lazy(() => analyticsResponseSchema).nullable(),
  /** When `data` was computed (the finished run's time). */
  computedAt: z.iso.datetime().nullable(),
});
export type AnalyticsLatest = z.infer<typeof analyticsLatestSchema>;

export const analyticsResponseSchema = z.object({
  days: z.number().int(),
  summary: z.object({
    properties: z.number().int(),
    leadsInPeriod: z.number().int(),
    leadsWon: z.number().int(),
    leadsLost: z.number().int(),
    propertiesWithVideo: z.number().int(),
    propertiesWithoutLeads: z.number().int(),
  }),
  properties: z.array(analyticsPropertySchema),
  /** Which sources feed the numbers, and which are missing. */
  coverage: z.object({
    leads: z.boolean(),
    videos: z.boolean(),
    portalViews: z.literal(false),
    priceHistory: z.literal(false),
  }),
});
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
