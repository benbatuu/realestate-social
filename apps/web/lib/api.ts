import 'server-only';
import { API_PREFIX, healthResponseSchema, type HealthResponse } from '@app/shared';

function apiBaseUrl(): string {
  const url = process.env['API_URL'];
  if (!url) throw new Error('API_URL is not set');
  return url.replace(/\/$/, '');
}

export type HealthResult =
  { reachable: true; health: HealthResponse } | { reachable: false; reason: string };

/** Server-side call to the API health endpoint. 503 still carries a valid body. */
export async function fetchHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/${API_PREFIX}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const parsed = healthResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { reachable: false, reason: `Unexpected response (${res.status})` };
    return { reachable: true, health: parsed.data };
  } catch (err) {
    return { reachable: false, reason: err instanceof Error ? err.name : 'Unknown error' };
  }
}
