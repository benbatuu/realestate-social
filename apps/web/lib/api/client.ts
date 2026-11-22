'use client';

import { API_PREFIX, type ApiErrorBody, TENANT_HEADER } from '@app/shared';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

const NETWORK_ERROR: ApiErrorBody = {
  statusCode: 0,
  code: 'INTERNAL_ERROR',
  message: 'Network error',
};

interface Options {
  /** Workspace for X-Tenant-Id scoped routes. */
  tenantId?: string;
  /** Extra headers, e.g. Idempotency-Key for money-moving requests. */
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  body: BodyInit | undefined,
  json: boolean,
  opts: Options,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (json) headers['content-type'] = 'application/json';
  if (opts.tenantId) headers[TENANT_HEADER] = opts.tenantId;
  try {
    const res = await fetch(`/${API_PREFIX}${path}`, {
      method,
      credentials: 'same-origin',
      headers,
      ...(body === undefined ? {} : { body }),
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const data: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      error: (data as ApiErrorBody | null) ?? { ...NETWORK_ERROR, statusCode: res.status },
    };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

/** Browser call to the API through the same-origin rewrite. Never throws for HTTP errors. */
export function apiPost<T>(
  path: string,
  body?: unknown,
  opts: Options = {},
): Promise<ApiResult<T>> {
  return request<T>(
    'POST',
    path,
    body === undefined ? undefined : JSON.stringify(body),
    true,
    opts,
  );
}

export function apiGet<T>(path: string, opts: Options = {}): Promise<ApiResult<T>> {
  return request<T>('GET', path, undefined, false, opts);
}

export function apiDelete(path: string, opts: Options = {}): Promise<ApiResult<void>> {
  return request<void>('DELETE', path, undefined, false, opts);
}

/** Partial update of a property. */
export function apiPatch<T>(
  path: string,
  body: unknown,
  opts: Options = {},
): Promise<ApiResult<T>> {
  return request<T>('PATCH', path, JSON.stringify(body), true, opts);
}

export function apiPut<T>(path: string, body: unknown, opts: Options = {}): Promise<ApiResult<T>> {
  return request<T>('PUT', path, JSON.stringify(body), true, opts);
}

/** Multipart upload; the browser sets the boundary header itself. */
export function apiUpload<T>(
  path: string,
  form: FormData,
  opts: Options = {},
): Promise<ApiResult<T>> {
  return request<T>('POST', path, form, false, opts);
}

/** Fetches a file from the API and hands it to the browser as a download. */
export async function apiDownload(
  path: string,
  fileName: string,
  opts: Options = {},
): Promise<boolean> {
  const headers: Record<string, string> = opts.tenantId ? { [TENANT_HEADER]: opts.tenantId } : {};
  try {
    const res = await fetch(`/${API_PREFIX}${path}`, { credentials: 'same-origin', headers });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
