import { providerFetch } from './http';
import { ProviderError, type ImageToVideoProvider } from './types';

const BASE = 'https://openrouter.ai/api/v1';
const MAX_CLIP_BYTES = 100 * 1024 * 1024;
/** Clips are made landscape; the renderer crops portrait and square from them (one paid clip per scene). */
const ASPECT_RATIO = '16:9';

export type Resolution = '480p' | '720p' | '1080p';

/** Pixel size of a 16:9 frame at each resolution, for token-priced models. */
const FRAME: Record<Resolution, { w: number; h: number }> = {
  '480p': { w: 854, h: 480 },
  '720p': { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
};
const TOKEN_FPS = 24;

/** The parts of GET /videos/models this adapter uses. */
export interface VideoModelInfo {
  id: string;
  supported_durations: number[] | null;
  supported_frame_images: string[] | null;
  pricing_skus: Record<string, string> | null;
}

/**
 * Picks the shortest duration the model accepts that is at least `wanted` (the renderer trims the
 * rest). Falls back to the longest one when none is long enough. `-1` (model decides) is ignored.
 */
export function clampDuration(wanted: number, supported: number[] | null): number {
  const options = (supported ?? []).filter((d) => d > 0).sort((a, b) => a - b);
  if (options.length === 0) return wanted;
  return options.find((d) => d >= wanted) ?? options[options.length - 1]!;
}

/**
 * Cost of one silent clip in micro-USD from the model's price list. Handles the three shapes the
 * catalogue uses: per second by resolution, cents per second, and video tokens
 * (width × height × fps / 1024 per second). Returns null when the price list has no usable entry.
 */
export function estimateClipMicroUsd(
  pricing: Record<string, string> | null,
  resolution: Resolution,
  seconds: number,
): number | null {
  if (!pricing) return null;
  const num = (k: string) => (pricing[k] === undefined ? undefined : Number(pricing[k]));
  const perSecond =
    num(`duration_seconds_without_audio_${resolution}`) ??
    num(`duration_seconds_${resolution}`) ??
    (resolution === '1080p' ? num('duration_seconds_without_audio') : undefined) ??
    num('duration_seconds_without_audio') ??
    num('duration_seconds') ??
    (num('cents_per_second_output') !== undefined
      ? num('cents_per_second_output')! / 100
      : undefined);
  if (perSecond !== undefined && Number.isFinite(perSecond))
    return Math.round(perSecond * seconds * 1_000_000);
  const perToken =
    num(`video_tokens_${resolution}`) ?? num('video_tokens_without_audio') ?? num('video_tokens');
  if (perToken !== undefined && Number.isFinite(perToken)) {
    const { w, h } = FRAME[resolution];
    const tokens = ((w * h * TOKEN_FPS) / 1024) * seconds;
    return Math.round(perToken * tokens * 1_000_000);
  }
  return null;
}

/**
 * OpenRouter video generation (POST /videos, poll, download with the key). Field names follow
 * the OpenRouter video guide; the submit call is never retried, since a retry can bill twice.
 */
export class OpenRouterImageToVideo implements ImageToVideoProvider {
  readonly name = 'openrouter';
  private static catalogue: Promise<Map<string, VideoModelInfo>> | null = null;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly resolution: Resolution,
  ) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' };
  }

  /** Model capabilities and prices; fetched once per process (free call). */
  private async info(): Promise<VideoModelInfo | null> {
    if (!OpenRouterImageToVideo.catalogue) {
      OpenRouterImageToVideo.catalogue = providerFetch(
        `${BASE}/videos/models`,
        { headers: this.headers() },
        { timeoutMs: 15_000, retries: 2 },
      )
        .then((r) => r.json() as Promise<{ data?: VideoModelInfo[] }>)
        .then((b) => new Map((b.data ?? []).map((m) => [m.id, m])))
        .catch((err: unknown) => {
          OpenRouterImageToVideo.catalogue = null;
          throw err;
        });
    }
    return (await OpenRouterImageToVideo.catalogue).get(this.model) ?? null;
  }

  async estimateCostMicroUsd(durationSeconds: number): Promise<number> {
    const info = await this.info();
    if (!info) throw new ProviderError('PROVIDER_JOB_FAILED', false, 'model not in catalogue');
    const seconds = clampDuration(durationSeconds, info.supported_durations);
    const cost = estimateClipMicroUsd(info.pricing_skus, this.resolution, seconds);
    // Unknown price: refuse rather than spend blind.
    if (cost === null) throw new ProviderError('PROVIDER_JOB_FAILED', false, 'no price for model');
    return cost;
  }

  async generate(input: {
    idempotencyKey: string;
    imageUrl: string;
    durationSeconds: number;
    prompt: string;
  }) {
    const info = await this.info();
    if (!info || !(info.supported_frame_images ?? []).includes('first_frame'))
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'model cannot start from a photo');
    const duration = clampDuration(input.durationSeconds, info.supported_durations);
    const res = await providerFetch(
      `${BASE}/videos`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.model,
          prompt: input.prompt,
          duration,
          resolution: this.resolution,
          aspect_ratio: ASPECT_RATIO,
          generate_audio: false,
          frame_images: [
            { type: 'image_url', image_url: { url: input.imageUrl }, frame_type: 'first_frame' },
          ],
          // Options are keyed by the serving provider; only the matching one is forwarded.
          ...(this.model.startsWith('bytedance/seedance')
            ? {
                provider: {
                  options: { seed: { watermark: false }, byteplus: { watermark: false } },
                },
              }
            : {}),
        }),
      },
      { timeoutMs: 30_000, retries: 0 },
    );
    const body = (await res.json()) as { id?: string };
    if (!body.id) throw new ProviderError('PROVIDER_JOB_FAILED', false, 'no job id');
    const estimate = estimateClipMicroUsd(info.pricing_skus, this.resolution, duration) ?? 0;
    return {
      externalJobId: body.id,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'image_to_video',
        externalRequestId: body.id,
        units: duration,
        unitType: 'seconds' as const,
        estimatedCostMicroUsd: estimate,
        isMock: false,
      },
    };
  }

  async getJob(externalJobId: string) {
    const res = await providerFetch(
      `${BASE}/videos/${encodeURIComponent(externalJobId)}`,
      { headers: this.headers() },
      { timeoutMs: 15_000, retries: 2 },
    );
    const body = (await res.json()) as {
      status?: string;
      error?: string;
      usage?: { cost?: number };
    };
    const cost =
      typeof body.usage?.cost === 'number'
        ? { costMicroUsd: Math.round(body.usage.cost * 1_000_000) }
        : {};
    switch (body.status) {
      case 'completed':
        return { status: 'SUCCEEDED' as const, ...cost };
      case 'pending':
      case 'in_progress':
        return { status: 'RUNNING' as const };
      default:
        // failed, cancelled, expired, or anything new.
        return {
          status: 'FAILED' as const,
          error: body.error ?? body.status ?? 'failed',
          ...cost,
        };
    }
  }

  async downloadOutput(externalJobId: string): Promise<Buffer> {
    const res = await providerFetch(
      `${BASE}/videos/${encodeURIComponent(externalJobId)}/content?index=0`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
      { timeoutMs: 120_000, retries: 2 },
    );
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_CLIP_BYTES)
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'too large');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_CLIP_BYTES)
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'bad size');
    return bytes;
  }
}
