import { createHash } from 'node:crypto';
import { VIDEO_POLICY } from '../policy';
import {
  type ImageToVideoProvider,
  type LlmProvider,
  type MusicProvider,
  ProviderError,
  type TtsProvider,
} from './types';

/**
 * Mock providers. Deterministic IDs derived from idempotency keys, so a retried call maps to the
 * same external job. Failure injection: set MOCK_FAILURE_STAGE to a stage name to make that stage
 * fail (tests use this to exercise the refund path).
 */
const id = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 24);
const failing = (stage: string) => process.env['MOCK_FAILURE_STAGE'] === stage;

export class MockImageToVideo implements ImageToVideoProvider {
  readonly name = 'mock';
  readonly model = 'mock-i2v-v0';

  async generate(input: {
    idempotencyKey: string;
    imageUrl: string;
    durationSeconds: number;
    prompt: string;
  }) {
    if (failing('GENERATING_AI_SCENES')) {
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'Mock image-to-video job failed');
    }
    const externalJobId = `mock-i2v-${id(input.idempotencyKey)}`;
    return {
      externalJobId,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'image_to_video',
        externalRequestId: externalJobId,
        units: input.durationSeconds,
        unitType: 'seconds' as const,
        estimatedCostMicroUsd: input.durationSeconds * VIDEO_POLICY.i2vMicroUsdPerSecond,
        isMock: true,
      },
    };
  }

  async getJob(_externalJobId: string) {
    // No output URL: the mock clip is the photo itself, rendered by the renderer.
    return { status: 'SUCCEEDED' as const };
  }
}

export class MockLlm implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock-llm-v0';

  async generateScript(input: {
    facts: Record<string, string | number | boolean | null>;
    durationSeconds: number;
  }) {
    if (failing('GENERATING_SCRIPT'))
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'Mock LLM failed');
    const f = input.facts;
    const lines = [
      `${f['title'] ?? 'Bu mülk'}.`,
      f['roomLayout'] ? `${f['roomLayout']} oda düzeni.` : '',
      f['grossAreaM2'] ? `${f['grossAreaM2']} metrekare.` : '',
      f['district'] ? `${f['district']} konumunda.` : '',
      f['priceText'] ? `Fiyat ${f['priceText']}.` : '',
    ].filter(Boolean);
    return {
      text: lines.join(' '),
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'script',
        externalRequestId: null,
        units: 1,
        unitType: 'calls' as const,
        estimatedCostMicroUsd: 0,
        isMock: true,
      },
    };
  }
}

export class MockTts implements TtsProvider {
  readonly name = 'mock';
  readonly model = 'mock-tts-v0';

  async synthesize(input: { idempotencyKey: string; text: string; language: 'tr' }) {
    if (failing('GENERATING_VOICE'))
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'Mock TTS failed');
    const externalJobId = `mock-tts-${id(input.idempotencyKey)}`;
    return {
      audio: null,
      externalJobId,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'tts',
        externalRequestId: externalJobId,
        units: input.text.length,
        unitType: 'characters' as const,
        estimatedCostMicroUsd: input.text.length * VIDEO_POLICY.ttsMicroUsdPerCharacter,
        isMock: true,
      },
    };
  }
}

export class MockMusic implements MusicProvider {
  readonly name = 'mock';
  readonly model = 'mock-music-catalog-v0';

  async select(input: { mood: string; durationSeconds: number }) {
    if (failing('SELECTING_MUSIC'))
      throw new ProviderError('PROVIDER_JOB_FAILED', false, 'Mock music failed');
    const externalJobId = `mock-music-${id(`${input.mood}:${input.durationSeconds}:${Math.random()}`)}`;
    return {
      trackId: 'mock-track-001',
      license: 'MOCK-CATALOG (placeholder, not licensed)',
      file: null,
      externalJobId,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'select',
        externalRequestId: externalJobId,
        units: 1,
        unitType: 'calls' as const,
        estimatedCostMicroUsd: 0,
        isMock: true,
      },
    };
  }
}
