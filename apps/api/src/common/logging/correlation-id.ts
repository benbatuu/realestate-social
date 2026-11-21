import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const CORRELATION_HEADER = 'x-request-id';
const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Reuses a caller-supplied request ID when it looks safe, otherwise mints one, and echoes it on
 * the response so client, API and worker logs can be joined.
 */
export function resolveCorrelationId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[CORRELATION_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = candidate && SAFE_ID.test(candidate) ? candidate : randomUUID();
  res.setHeader(CORRELATION_HEADER, id);
  return id;
}
