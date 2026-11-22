/** Provider boundaries (blueprint §8.8). Domain code never imports an SDK or HTTP client directly. */

export type ProviderErrorCode =
  'PROVIDER_JOB_FAILED' | 'PROVIDER_TIMEOUT' | 'PROVIDER_RATE_LIMIT' | 'PROVIDER_AUTH_ERROR';

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ProviderUsageFact {
  provider: string;
  model: string;
  operation: string;
  externalRequestId: string | null;
  units: number;
  unitType: 'seconds' | 'characters' | 'calls';
  estimatedCostMicroUsd: number;
  isMock: boolean;
}

export interface ImageToVideoProvider {
  readonly name: string;
  readonly model: string;
  /** `imageUrl` must be reachable by the provider (a short-lived signed URL). */
  generate(input: {
    idempotencyKey: string;
    imageUrl: string;
    durationSeconds: number;
    prompt: string;
  }): Promise<{ externalJobId: string; usage: ProviderUsageFact }>;
  /** `outputUrl` is set once the job succeeded. `costMicroUsd` is the provider's billed cost, when it reports one. */
  getJob(externalJobId: string): Promise<{
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    outputUrl?: string;
    error?: string;
    costMicroUsd?: number;
  }>;
  /** For providers whose output URL needs our credentials: returns the finished clip's bytes. */
  downloadOutput?(externalJobId: string): Promise<Buffer>;
  /** Cost estimate before submitting, used by the spend guard. */
  estimateCostMicroUsd?(durationSeconds: number): Promise<number>;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  generateScript(input: {
    facts: Record<string, string | number | boolean | null>;
    durationSeconds: number;
  }): Promise<{ text: string; usage: ProviderUsageFact }>;
}

export interface TtsProvider {
  readonly name: string;
  readonly model: string;
  /** `audio` is null for the mock; real providers return MP3 bytes. */
  synthesize(input: {
    idempotencyKey: string;
    text: string;
    language: 'tr';
  }): Promise<{ audio: Buffer | null; externalJobId: string; usage: ProviderUsageFact }>;
}

export interface MusicProvider {
  readonly name: string;
  readonly model: string;
  /** `file` is a local path for catalogue tracks; null for the mock. */
  select(input: { mood: string; durationSeconds: number }): Promise<{
    trackId: string;
    license: string;
    file?: string | null;
    externalJobId: string;
    usage: ProviderUsageFact;
  }>;
}
