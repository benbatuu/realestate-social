import 'server-only';
import {
  API_PREFIX,
  type ApiErrorBody,
  type Entitlements,
  entitlementsSchema,
  healthResponseSchema,
  type HealthResponse,
  type Invitation,
  invitationSchema,
  type Member,
  memberSchema,
  type MeResponse,
  meResponseSchema,
} from '@app/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';

function apiBaseUrl(): string {
  const url = process.env['API_URL'];
  if (!url) throw new Error('API_URL is not set');
  return url.replace(/\/$/, '');
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(`API request failed with ${status}${body ? ` (${body.code})` : ''}`);
    this.name = 'ApiRequestError';
  }
}

/** GET from the API on the server, forwarding the browser's session cookie. */
async function apiGet<T extends z.ZodType>(path: string, schema: T): Promise<z.output<T>> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${apiBaseUrl()}/${API_PREFIX}${path}`, {
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    signal: AbortSignal.timeout(10_000),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, json as ApiErrorBody | null);
  return schema.parse(json);
}

/** The signed-in user, or null. Cached per request so layouts and pages share one call. */
export const getMe = cache(async (): Promise<MeResponse | null> => {
  try {
    return await apiGet('/auth/me', meResponseSchema);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) return null;
    throw err;
  }
});

export function getMembers(tenantId: string): Promise<Member[]> {
  return apiGet(`/tenants/${tenantId}/members`, z.array(memberSchema));
}

export function getPendingInvitations(tenantId: string): Promise<Invitation[]> {
  return apiGet(`/tenants/${tenantId}/invitations`, z.array(invitationSchema));
}

export function getEntitlements(tenantId: string): Promise<Entitlements> {
  return apiGet(`/tenants/${tenantId}/entitlements`, entitlementsSchema);
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
