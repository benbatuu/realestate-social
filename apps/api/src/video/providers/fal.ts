import type { ImageToVideoProvider } from './types';
import { ProviderError } from './types';
import { providerFetch } from './http';
import { VIDEO_POLICY } from '../policy';

/**
 * fal.ai queue client for Kling image-to-video. Endpoint and field names follow fal's queue API
 * and must be checked against the official model page before the first real call (plan-06).
 */
export class FalKlingImageToVideo implements ImageToVideoProvider {
  readonly name = 'fal';
  readonly model: string;
  private readonly base = 'https://queue.fal.run';

  constructor(
    private readonly apiKey: string,
    model: string,
  ) {
    this.model = model;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Key ${this.apiKey}`, 'content-type': 'application/json' };
  }

  async generate(input: {
    idempotencyKey: string;
    imageUrl: string;
    durationSeconds: number;
    prompt: string;
  }) {
    const res = await providerFetch(
      `${this.base}/${this.model}`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          prompt: input.prompt,
          image_url: input.imageUrl,
          duration: String(VIDEO_POLICY.clipSeconds),
        }),
      },
      { timeoutMs: 20_000, retries: 2 },
    );
    const body = (await res.json()) as { request_id?: string };
    if (!body.request_id) throw new ProviderError('PROVIDER_JOB_FAILED', false, 'no request id');
    return {
      externalJobId: body.request_id,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'image_to_video',
        externalRequestId: body.request_id,
        units: VIDEO_POLICY.clipSeconds,
        unitType: 'seconds' as const,
        estimatedCostMicroUsd: VIDEO_POLICY.clipSeconds * VIDEO_POLICY.i2vMicroUsdPerSecond,
        isMock: false,
      },
    };
  }

  async getJob(externalJobId: string) {
    const statusRes = await providerFetch(
      `${this.base}/${this.model}/requests/${externalJobId}/status`,
      { headers: this.headers() },
      { timeoutMs: 10_000, retries: 2 },
    );
    const status = (await statusRes.json()) as { status?: string; error?: string };
    if (status.status === 'COMPLETED') {
      const resultRes = await providerFetch(
        `${this.base}/${this.model}/requests/${externalJobId}`,
        { headers: this.headers() },
        { timeoutMs: 15_000, retries: 2 },
      );
      const result = (await resultRes.json()) as { video?: { url?: string } };
      if (!result.video?.url) return { status: 'FAILED' as const, error: 'no video in result' };
      return { status: 'SUCCEEDED' as const, outputUrl: result.video.url };
    }
    if (status.status === 'IN_QUEUE' || status.status === 'IN_PROGRESS')
      return { status: 'RUNNING' as const };
    return { status: 'FAILED' as const, error: status.error ?? 'failed' };
  }
}
