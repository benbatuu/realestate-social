import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { CatalogMusic } from './catalog-music';
import { ElevenLabsTts } from './elevenlabs';
import { FalKlingImageToVideo } from './fal';
import { AnthropicLlm } from './anthropic';
import { MockImageToVideo, MockLlm, MockMusic, MockTts } from './mock';
import { OpenRouterLlm } from './openrouter-llm';
import { OpenRouterImageToVideo } from './openrouter-video';
import type { ImageToVideoProvider, LlmProvider, MusicProvider, TtsProvider } from './types';

/**
 * Chooses implementations from configuration. Real providers were checked at startup
 * (assertProviderConfig), so a missing key cannot reach a provider call here.
 *
 * Paid switch (plan-08): while AI_PAID_CALLS_ENABLED is off, the script and voice use the mocks,
 * and AI scenes are refused by the spend guard and fall back to photo motion. No call costs money.
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  readonly imageToVideo: ImageToVideoProvider;
  /** Second model for a scene the first one failed; null when none is configured. */
  readonly imageToVideoFallback: ImageToVideoProvider | null;
  readonly llm: LlmProvider;
  readonly tts: TtsProvider;
  readonly music: MusicProvider;
  readonly paidCallsEnabled: boolean;
  /** Output settings that change a clip; part of the clip cache key. */
  readonly imageToVideoSettings: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.paidCallsEnabled = config.AI_PAID_CALLS_ENABLED;
    const paid = this.paidCallsEnabled;
    this.imageToVideoSettings = `${config.I2V_RESOLUTION}|16:9|silent`;

    if (config.PROVIDER_I2V === 'openrouter') {
      const key = config.OPENROUTER_API_KEY ?? '';
      this.imageToVideo = new OpenRouterImageToVideo(
        key,
        config.I2V_MODEL_PRIMARY,
        config.I2V_RESOLUTION,
      );
      this.imageToVideoFallback =
        config.I2V_MODEL_FALLBACK && config.I2V_MODEL_FALLBACK !== config.I2V_MODEL_PRIMARY
          ? new OpenRouterImageToVideo(key, config.I2V_MODEL_FALLBACK, config.I2V_RESOLUTION)
          : null;
    } else {
      this.imageToVideo =
        config.PROVIDER_I2V === 'fal'
          ? new FalKlingImageToVideo(config.FAL_API_KEY ?? '', config.FAL_KLING_MODEL)
          : new MockImageToVideo();
      this.imageToVideoFallback = null;
    }

    this.llm =
      paid && config.PROVIDER_LLM === 'openrouter'
        ? new OpenRouterLlm(config.OPENROUTER_API_KEY ?? '', config.LLM_MODEL)
        : paid && config.PROVIDER_LLM === 'anthropic'
          ? new AnthropicLlm(config.ANTHROPIC_API_KEY ?? '', config.LLM_MODEL)
          : new MockLlm();
    this.tts =
      paid && config.PROVIDER_TTS === 'elevenlabs'
        ? new ElevenLabsTts(
            config.ELEVENLABS_API_KEY ?? '',
            config.ELEVENLABS_VOICE_ID ?? '',
            config.ELEVENLABS_MODEL,
          )
        : new MockTts();
    this.music =
      config.PROVIDER_MUSIC === 'catalog'
        ? new CatalogMusic(config.MUSIC_CATALOG_PATH ?? '')
        : new MockMusic();

    if (!paid && (config.PROVIDER_LLM !== 'mock' || config.PROVIDER_TTS !== 'mock'))
      this.logger.warn('AI_PAID_CALLS_ENABLED is off: script and voice use the mock providers.');
  }
}
