import { z } from 'zod';

/**
 * Packages and plan changes. Upgrades apply at once; downgrades apply at the period end and are
 * refused while the workspace uses more than the smaller package allows. No payment is taken yet.
 */
export const planSummarySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  monthlyPriceMinor: z.number().int(),
  currency: z.string(),
  monthlyCredits: z.number().int(),
  freeRegenerationAllowance: z.number().int(),
  maxSeats: z.number().int(),
  maxWorkspaces: z.number().int(),
  maxCrmConnections: z.number().int(),
  retentionDays: z.number().int(),
  features: z.object({
    portfolioAnalytics: z.enum(['basic', 'advanced']),
    teamReport: z.enum(['none', 'basic', 'full', 'advanced']),
    brandKits: z.number().int(),
    priorityQueue: z.boolean(),
    apiAccess: z.enum(['none', 'limited', 'advanced']),
  }),
});
export type PlanSummary = z.infer<typeof planSummarySchema>;

export const packageOptionSchema = z.object({
  plan: planSummarySchema,
  relation: z.enum(['current', 'upgrade', 'downgrade']),
  /** Reasons a change is refused right now. Empty means it can be done. */
  blockers: z.array(z.string()),
});
export type PackageOption = z.infer<typeof packageOptionSchema>;

export const subscriptionViewSchema = z.object({
  current: planSummarySchema.nullable(),
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE']).nullable(),
  periodEnd: z.iso.datetime().nullable(),
  pending: z.object({ plan: planSummarySchema, effectiveAt: z.iso.datetime() }).nullable(),
  usage: z.object({ seats: z.number().int(), crmConnections: z.number().int() }),
  options: z.array(packageOptionSchema),
});
export type SubscriptionView = z.infer<typeof subscriptionViewSchema>;

export const changePlanRequestSchema = z.object({ planCode: z.string().min(2).max(40) });
export type ChangePlanRequest = z.infer<typeof changePlanRequestSchema>;
