import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  const dep = { status: 'ok' as const, latencyMs: 3 };

  it('accepts a well-formed response', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      checkedAt: new Date().toISOString(),
      dependencies: { database: dep, redis: dep, storage: dep },
    });
    expect(parsed.status).toBe('ok');
  });

  it('rejects a response missing a dependency', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      checkedAt: new Date().toISOString(),
      dependencies: { database: dep, redis: dep },
    });
    expect(result.success).toBe(false);
  });
});
