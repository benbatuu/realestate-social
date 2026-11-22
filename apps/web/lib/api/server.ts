import 'server-only';
import {
  API_PREFIX,
  type ApiErrorBody,
  type Entitlements,
  entitlementsSchema,
  healthResponseSchema,
  type HealthResponse,
  type AccountDeletion,
  type VideoLibraryResponse,
  videoLibraryResponseSchema,
  accountDeletionSchema,
  type AuditLogResponse,
  auditLogResponseSchema,
  type DashboardStats,
  dashboardStatsSchema,
  type TenantDetail,
  tenantDetailSchema,
  type CreditBalance,
  creditBalanceSchema,
  type CreditLedgerResponse,
  creditLedgerResponseSchema,
  type ImportSummary,
  importSummarySchema,
  type PropertyDetail,
  propertyDetailSchema,
  type PropertyListResponse,
  propertyListResponseSchema,
  TENANT_HEADER,
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
async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  tenantId?: string,
): Promise<z.output<T>> {
  const cookieHeader = (await cookies()).toString();
  const headers: Record<string, string> = {};
  if (cookieHeader) headers['cookie'] = cookieHeader;
  if (tenantId) headers[TENANT_HEADER] = tenantId;
  const res = await fetch(`${apiBaseUrl()}/${API_PREFIX}${path}`, {
    cache: 'no-store',
    headers,
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

/** Null when the property does not exist in this workspace (404). */
export async function getProperty(tenantId: string, id: string): Promise<PropertyDetail | null> {
  try {
    return await apiGet(`/properties/${encodeURIComponent(id)}`, propertyDetailSchema, tenantId);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}

export function getProperties(
  tenantId: string,
  query: Record<string, string | undefined>,
): Promise<PropertyListResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const qs = params.toString();
  return apiGet(`/properties${qs ? `?${qs}` : ''}`, propertyListResponseSchema, tenantId);
}

export function getCredits(tenantId: string): Promise<CreditBalance> {
  return apiGet('/credits', creditBalanceSchema, tenantId);
}

/** The user's open deletion request, if any. Not tenant-scoped. */
export function getOpenDeletion(): Promise<AccountDeletion | null> {
  return apiGet('/auth/data-requests/open', accountDeletionSchema.nullable());
}

/** Newest finished videos, for the dashboard strip. */
export function getRecentVideos(tenantId: string, pageSize = 4): Promise<VideoLibraryResponse> {
  return apiGet(`/videos?page=1&pageSize=${pageSize}`, videoLibraryResponseSchema, tenantId);
}

export function getTenantDetail(tenantId: string): Promise<TenantDetail> {
  return apiGet(`/tenants/${tenantId}`, tenantDetailSchema, tenantId);
}

export function getStats(tenantId: string): Promise<DashboardStats> {
  return apiGet(`/tenants/${tenantId}/stats`, dashboardStatsSchema, tenantId);
}

export function getAudit(
  tenantId: string,
  query: {
    page: number;
    pageSize: number;
    q?: string | undefined;
    category?: string | undefined;
    actorUserId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  },
): Promise<AuditLogResponse> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.actorUserId) params.set('actorUserId', query.actorUserId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return apiGet(`/tenants/${tenantId}/audit?${params}`, auditLogResponseSchema, tenantId);
}

export function getLedger(tenantId: string, page: number): Promise<CreditLedgerResponse> {
  return apiGet(`/credits/ledger?page=${page}&pageSize=25`, creditLedgerResponseSchema, tenantId);
}

export function getImports(tenantId: string): Promise<ImportSummary[]> {
  return apiGet('/imports', z.array(importSummarySchema), tenantId);
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
