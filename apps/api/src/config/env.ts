import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);
const secret = z.string().min(32, 'must be at least 32 characters');
const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

/**
 * Process environment, validated once at startup. Anything missing or malformed stops the
 * process before it serves traffic or picks up jobs.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(4100),
  APP_URL: z.url(),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  OBJECT_STORAGE_ENDPOINT: z.url(),
  OBJECT_STORAGE_BUCKET: nonEmpty,
  OBJECT_STORAGE_REGION: nonEmpty,
  OBJECT_STORAGE_ACCESS_KEY: nonEmpty,
  OBJECT_STORAGE_SECRET_KEY: nonEmpty,
  OBJECT_STORAGE_FORCE_PATH_STYLE: booleanString,

  AUTH_SECRET: secret,
  ENCRYPTION_KEY: secret,
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parses the environment. Error messages name the variable and the problem only, never the
 * value, so a misconfigured secret cannot leak into logs.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}
