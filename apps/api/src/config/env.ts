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
  /** Host browsers use for signed URLs, when it differs from the API's internal endpoint. */
  OBJECT_STORAGE_PUBLIC_ENDPOINT: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.url().optional()),

  IMPORT_MAX_FILE_MB: z.coerce.number().int().min(1).max(50).default(10),
  IMPORT_MAX_ROWS: z.coerce.number().int().min(1).max(50_000).default(5000),
  IMPORT_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  PHOTO_MAX_FILE_MB: z.coerce.number().int().min(1).max(50).default(20),
  PHOTO_MAX_PER_PROPERTY: z.coerce.number().int().min(1).max(500).default(60),

  /**
   * Express `trust proxy`: which hops may set X-Forwarded-For. `loopback` fits the local setup
   * (Next.js rewrite on the same host). In production set it to the web tier's addresses or hop
   * count, otherwise every user shares the proxy's IP for login throttling.
   */
  TRUST_PROXY: z
    .string()
    .trim()
    .default('loopback')
    .transform((v): string | number => (/^\d+$/.test(v) ? Number(v) : v)),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  INVITATION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  SIGNUP_PLAN_CODE: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),

  // Provider selection. `mock` is for development and tests; real providers need their key.
  PROVIDER_I2V: z.enum(['mock', 'fal', 'openrouter']).default('mock'),
  PROVIDER_LLM: z.enum(['mock', 'anthropic', 'openrouter']).default('mock'),
  /** One key for OpenRouter video models and Claude (plan-08). */
  OPENROUTER_API_KEY: z.string().trim().optional(),
  I2V_MODEL_PRIMARY: z.string().trim().default('bytedance/seedance-2.5'),
  /** Used once when the primary model fails a scene. Empty = no fallback. */
  I2V_MODEL_FALLBACK: z.string().trim().default('google/veo-3.1-fast'),
  I2V_RESOLUTION: z.enum(['480p', '720p', '1080p']).default('1080p'),
  /**
   * Master switch for calls that cost money. Only the exact value `true` turns it on; anything
   * else (empty, typo) keeps it off. Off: AI scenes fall back to photo motion, no paid call is made.
   */
  AI_PAID_CALLS_ENABLED: booleanString,
  AI_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(10),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(50),
  PROVIDER_TTS: z.enum(['mock', 'elevenlabs']).default('mock'),
  PROVIDER_MUSIC: z.enum(['mock', 'catalog']).default('mock'),
  FAL_API_KEY: z.string().trim().optional(),
  FAL_KLING_MODEL: z.string().trim().default('fal-ai/kling-video/v3/pro/image-to-video'),
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  LLM_MODEL: z.string().trim().default('claude-sonnet-5-5'),
  ELEVENLABS_API_KEY: z.string().trim().optional(),
  ELEVENLABS_VOICE_ID: z.string().trim().optional(),
  ELEVENLABS_MODEL: z.string().trim().default('eleven_multilingual_v2'),
  MUSIC_CATALOG_PATH: z.string().trim().optional(),

  AUTH_SECRET: secret,
  ENCRYPTION_KEY: secret,
});

export type Env = z.infer<typeof envSchema>;

/** Real providers must come with their credentials. Checked once, at startup. */
export function assertProviderConfig(env: Env): void {
  const issues: string[] = [];
  if (env.PROVIDER_I2V === 'fal' && !env.FAL_API_KEY)
    issues.push('FAL_API_KEY: required when PROVIDER_I2V=fal');
  if (
    (env.PROVIDER_I2V === 'openrouter' || env.PROVIDER_LLM === 'openrouter') &&
    !env.OPENROUTER_API_KEY
  )
    issues.push('OPENROUTER_API_KEY: required when a provider is openrouter');
  if (env.PROVIDER_LLM === 'anthropic' && !env.ANTHROPIC_API_KEY)
    issues.push('ANTHROPIC_API_KEY: required when PROVIDER_LLM=anthropic');
  if (env.PROVIDER_TTS === 'elevenlabs' && (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID)) {
    issues.push('ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID: required when PROVIDER_TTS=elevenlabs');
  }
  if (env.PROVIDER_MUSIC === 'catalog' && !env.MUSIC_CATALOG_PATH)
    issues.push('MUSIC_CATALOG_PATH: required when PROVIDER_MUSIC=catalog');
  if (issues.length > 0) throw new EnvValidationError(issues);
}

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
