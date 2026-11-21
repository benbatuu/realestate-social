import { describe, expect, it } from 'vitest';
import { safeErrorSummary } from './error.filter';

describe('safeErrorSummary', () => {
  it('keeps the error name and stack frames but drops the message', () => {
    const err = new TypeError('Invalid value for email: someone@example.com, hash $argon2id$abc');
    const summary = safeErrorSummary(err);
    expect(summary.name).toBe('TypeError');
    expect(summary.frames.length).toBeGreaterThan(0);
    expect(JSON.stringify(summary)).not.toMatch(/someone@example\.com|argon2id/);
  });
});
