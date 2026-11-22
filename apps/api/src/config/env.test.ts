import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env';

const valid = {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:3100',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  OBJECT_STORAGE_ENDPOINT: 'http://localhost:58333',
  OBJECT_STORAGE_BUCKET: 'bucket',
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_ACCESS_KEY: 'access',
  OBJECT_STORAGE_SECRET_KEY: 'super-secret-value',
  AUTH_SECRET: 'a'.repeat(32),
  ENCRYPTION_KEY: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('parses a complete environment and applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.API_PORT).toBe(4100);
    expect(env.OBJECT_STORAGE_FORCE_PATH_STYLE).toBe(false);
  });

  it('fails fast and names every missing variable', () => {
    const { DATABASE_URL: _db, REDIS_URL: _redis, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
    try {
      parseEnv(rest);
    } catch (err) {
      const issues = (err as EnvValidationError).issues.join('\n');
      expect(issues).toContain('DATABASE_URL');
      expect(issues).toContain('REDIS_URL');
    }
  });

  it('never echoes a secret value in the error', () => {
    const tooShort = 'short-secret-value';
    try {
      parseEnv({ ...valid, AUTH_SECRET: tooShort });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain('AUTH_SECRET');
      expect((err as Error).message).not.toContain(tooShort);
    }
  });

  it('keeps paid AI calls off unless the switch is exactly true', () => {
    expect(parseEnv(valid).AI_PAID_CALLS_ENABLED).toBe(false);
    expect(parseEnv({ ...valid, AI_PAID_CALLS_ENABLED: 'false' }).AI_PAID_CALLS_ENABLED).toBe(
      false,
    );
    expect(parseEnv({ ...valid, AI_PAID_CALLS_ENABLED: 'true' }).AI_PAID_CALLS_ENABLED).toBe(true);
    expect(() => parseEnv({ ...valid, AI_PAID_CALLS_ENABLED: 'yes' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...valid, AI_PAID_CALLS_ENABLED: 'TRUE' })).toThrow(EnvValidationError);
  });

  it('reads the paid switch from a .env line with an inline comment as off', async () => {
    const { parse } = await import('dotenv');
    const fromFile = parse('AI_PAID_CALLS_ENABLED=false  # Ana şalter\n');
    expect(parseEnv({ ...valid, ...fromFile }).AI_PAID_CALLS_ENABLED).toBe(false);
  });
});
