import { ProviderError } from './types';

export interface HttpOptions {
  timeoutMs: number;
  /** Retries after the first attempt, for 429, 5xx and network errors only. */
  retries: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with a hard timeout and bounded retries with exponential backoff and jitter (§12.4).
 * Non-retryable HTTP errors are mapped to ProviderError here, so adapters never leak raw bodies.
 * Response bodies are never included in errors (they can echo request data).
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
  opts: HttpOptions,
): Promise<Response> {
  let attempt = 0;
  for (;;) {
    attempt++;
    let res: Response | undefined;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) });
    } catch (err) {
      const timedOut =
        err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      if (attempt <= opts.retries) {
        await sleep(backoff(attempt));
        continue;
      }
      throw new ProviderError(
        timedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_TIMEOUT',
        true,
        timedOut ? 'timeout' : 'network',
      );
    }
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt <= opts.retries) {
      await sleep(backoff(attempt, res.headers.get('retry-after')));
      continue;
    }
    if (res.status === 429) throw new ProviderError('PROVIDER_RATE_LIMIT', true, 'rate limited');
    if (res.status === 401 || res.status === 403)
      throw new ProviderError('PROVIDER_AUTH_ERROR', false, 'auth rejected');
    if (res.status >= 500)
      throw new ProviderError('PROVIDER_TIMEOUT', true, `upstream ${res.status}`);
    throw new ProviderError('PROVIDER_JOB_FAILED', false, `http ${res.status}`);
  }
}

function backoff(attempt: number, retryAfter?: string | null): number {
  const hinted = retryAfter ? Number(retryAfter) * 1000 : NaN;
  if (Number.isFinite(hinted) && hinted > 0) return Math.min(hinted, 30_000);
  return Math.min(1000 * 2 ** attempt, 15_000) + Math.floor(Math.random() * 250);
}
