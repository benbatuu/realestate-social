import { z } from 'zod';

/**
 * Integrations: where property and lead data comes from. LeadPilot is the first CRM; other CRMs
 * follow the same connection model.
 */
export const INTEGRATION_PROVIDERS = ['LEADPILOT', 'GENERIC_REST', 'CSV'] as const;
export const integrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

export const integrationConnectionSchema = z.object({
  id: z.uuid(),
  provider: integrationProviderSchema,
  name: z.string(),
  /** PENDING: saved, waiting for the API access check. ACTIVE: syncing. DISABLED: paused. */
  status: z.enum(['PENDING', 'ACTIVE', 'DISABLED']),
  lastSyncAt: z.iso.datetime().nullable(),
  /** Latest sync run: what it is doing now, or how it ended. */
  lastRun: z
    .object({
      status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
      stage: z.string().nullable(),
      totalRows: z.number().int(),
      processedRows: z.number().int(),
      recordsCreated: z.number().int(),
      recordsUpdated: z.number().int(),
      photosAdded: z.number().int(),
      /** Photos not taken because the property reached its package's photo cap. */
      photosSkipped: z.number().int(),
      errorSummary: z.string().nullable(),
      startedAt: z.iso.datetime().nullable(),
      finishedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  /** Result of the last live check, in plain words. */
  lastCheck: z.object({ ok: z.boolean(), message: z.string(), at: z.iso.datetime() }).nullable(),
  createdAt: z.iso.datetime(),
});
export type IntegrationConnection = z.infer<typeof integrationConnectionSchema>;

export const integrationsResponseSchema = z.object({
  connections: z.array(integrationConnectionSchema),
  usage: z.object({ used: z.number().int(), max: z.number().int() }),
  /** Whether the workspace may add a connection right now. */
  canConnect: z.boolean(),
});
export type IntegrationsResponse = z.infer<typeof integrationsResponseSchema>;

export const integrationConnectRequestSchema = z.object({
  provider: z.literal('LEADPILOT'),
  name: z.string().trim().min(2).max(80),
  /** Address of the LeadPilot workspace, e.g. https://crm.example.com */
  baseUrl: z.string().trim().min(8).max(200),
  /** Connection id shown in LeadPilot (Lead intake / Portfolio feed). */
  connectionId: z.uuid(),
  /** Signing secret shown once in LeadPilot. Stored encrypted, never shown again. */
  signingSecret: z.string().trim().min(32).max(200),
});
export type IntegrationConnectRequest = z.infer<typeof integrationConnectRequestSchema>;

export const integrationConnectResultSchema = z.object({
  connection: integrationConnectionSchema,
  test: z.object({ ok: z.boolean(), message: z.string() }),
});
export type IntegrationConnectResult = z.infer<typeof integrationConnectResultSchema>;
