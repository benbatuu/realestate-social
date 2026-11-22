import type { VideoFailureCode } from './failure';

/** A failure the pipeline understands. `safeMessage` is the only text that reaches users. */
export class PipelineError extends Error {
  constructor(
    readonly code: VideoFailureCode,
    readonly retryable: boolean,
    readonly safeMessage: string,
  ) {
    super(code);
    this.name = 'PipelineError';
  }
}

export const SAFE_MESSAGES: Record<VideoFailureCode, string> = {
  PROVIDER_JOB_FAILED: 'Video üretim servisi bu işi tamamlayamadı. Kredi iade edildi.',
  PROVIDER_TIMEOUT: 'Video üretim servisi zamanında yanıt vermedi. Kredi iade edildi.',
  LLM_SCHEMA_INVALID: 'Senaryo doğrulanamadı. Kredi iade edildi.',
  INVALID_MEDIA: 'Mülk fotoğrafları işlenemedi. Kredi iade edildi.',
  QUALITY_REJECTED: 'Video kalite kontrolünden geçemedi. Kredi iade edildi.',
  RENDER_FAILED: 'Video dosyası oluşturulamadı. Kredi iade edildi.',
  PROVIDER_RATE_LIMIT: 'Video servisi şu an yoğun. Kredi iade edildi.',
  PROVIDER_AUTH_ERROR: 'Video servisi kimlik doğrulamasını reddetti. Kredi iade edildi.',
  ASSET_DOWNLOAD_FAILED: 'Üretilen klip indirilemedi. Kredi iade edildi.',
  MUSIC_LICENSE_OR_ASSET_ERROR: 'Lisanslı müzik seçilemedi. Kredi iade edildi.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata oluştu. Kredi iade edildi.',
};
