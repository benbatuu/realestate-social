import { z } from 'zod';

/** Status of one infrastructure dependency checked by the health endpoint. */
export const dependencyStatusSchema = z.object({
  status: z.enum(['ok', 'error']),
  latencyMs: z.number().nonnegative(),
  /** Safe, non-sensitive error summary. Never contains credentials or connection strings. */
  error: z.string().optional(),
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checkedAt: z.iso.datetime(),
  dependencies: z.object({
    database: dependencyStatusSchema,
    redis: dependencyStatusSchema,
    storage: dependencyStatusSchema,
  }),
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type DependencyName = keyof HealthResponse['dependencies'];
