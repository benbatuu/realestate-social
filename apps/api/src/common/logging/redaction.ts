/**
 * Paths pino masks in every log line (blueprint rule 13: no secrets or personal data in logs).
 * `*` matches one level, so both top-level and one-level-nested keys are covered.
 */
const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'secretKey',
  'clientSecret',
  'credentials',
  'encryptedCredentials',
  'authorization',
  'cookie',
  'email',
  'phone',
  'phoneNumber',
] as const;

export const REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
];

export const REDACT_CENSOR = '[REDACTED]';
