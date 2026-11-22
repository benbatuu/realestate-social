import { providerFetch } from './http';
import { VIDEO_POLICY } from '../policy';
import type { TtsProvider } from './types';

/** ElevenLabs text-to-speech. Returns the MP3 bytes; the pipeline stores them. */
export class ElevenLabsTts implements TtsProvider {
  readonly name = 'elevenlabs';
  constructor(
    private readonly apiKey: string,
    private readonly voiceId: string,
    readonly model = 'eleven_multilingual_v2',
  ) {}

  async synthesize(input: { idempotencyKey: string; text: string; language: 'tr' }) {
    const res = await providerFetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: input.text,
          model_id: this.model,
          language_code: input.language,
        }),
      },
      // Billed per character: never resend on our own.
      { timeoutMs: 60_000, retries: 0 },
    );
    const audio = Buffer.from(await res.arrayBuffer());
    return {
      audio,
      externalJobId: `elevenlabs-${input.idempotencyKey}`,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'tts',
        externalRequestId: null,
        units: input.text.length,
        unitType: 'characters' as const,
        estimatedCostMicroUsd: input.text.length * VIDEO_POLICY.ttsMicroUsdPerCharacter,
        isMock: false,
      },
    };
  }
}
