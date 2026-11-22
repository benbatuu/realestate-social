import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerFetch } from './http';
import { ProviderError } from './types';

afterEach(() => vi.unstubAllGlobals());

describe('providerFetch', () => {
  it('maps 401 to a non-retryable auth error without retrying or leaking the body', async () => {
    const fetchMock = vi.fn(async () => new Response('secret body', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const err = await providerFetch('https://x.test', {}, { timeoutMs: 1000, retries: 2 }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).code).toBe('PROVIDER_AUTH_ERROR');
    expect((err as ProviderError).retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((err as Error).message).not.toContain('secret body');
  });

  it('retries 5xx and then succeeds', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++;
        return calls < 2 ? new Response('', { status: 503 }) : new Response('ok', { status: 200 });
      }),
    );
    const res = await providerFetch('https://x.test', {}, { timeoutMs: 1000, retries: 2 });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });
});
