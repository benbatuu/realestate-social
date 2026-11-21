'use client';

import { API_PREFIX, type ApiErrorBody } from '@app/shared';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

const NETWORK_ERROR: ApiErrorBody = {
  statusCode: 0,
  code: 'INTERNAL_ERROR',
  message: 'Network error',
};

/** Browser call to the API through the same-origin rewrite. Never throws for HTTP errors. */
export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/${API_PREFIX}${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    return {
      ok: false,
      error: (json as ApiErrorBody | null) ?? { ...NETWORK_ERROR, statusCode: res.status },
    };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}
