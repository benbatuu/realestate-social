import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { REDACT_CENSOR, REDACT_PATHS, serializeRequest } from './redaction';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const logger = pino({ redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR } }, stream);
  return { logger, lines };
}

describe('log redaction', () => {
  it('masks secrets and personal data at top level and one level deep', () => {
    const { logger, lines } = captureLogger();
    logger.info(
      {
        apiKey: 'sk-live-123',
        email: 'someone@example.com',
        connection: { encryptedCredentials: 'ciphertext', accessToken: 'tok' },
        req: { headers: { authorization: 'Bearer abc', cookie: 'sid=1' } },
        propertyId: 'prop_1',
      },
      'test',
    );
    const out = lines.join('');
    for (const leaked of [
      'sk-live-123',
      'someone@example.com',
      'ciphertext',
      'tok"',
      'Bearer abc',
      'sid=1',
    ]) {
      expect(out).not.toContain(leaked);
    }
    expect(out).toContain('prop_1');
    expect(out).toContain(REDACT_CENSOR);
  });
});

describe('request serializer', () => {
  it('keeps only id, method and path', () => {
    const out = serializeRequest({
      id: 'req-1',
      method: 'POST',
      url: '/api/v1/invitations/accept?signature=secret-sig',
      headers: { cookie: 'sid=session-token' },
      body: { token: 'invite-token' },
    } as never);
    expect(out).toEqual({ id: 'req-1', method: 'POST', path: '/api/v1/invitations/accept' });
    expect(JSON.stringify(out)).not.toMatch(/secret-sig|session-token|invite-token/);
  });
});
