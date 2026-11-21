import type { ApiErrorBody, ErrorCode } from '@app/shared';

const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Girilen bilgileri kontrol edin.',
  UNAUTHENTICATED: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
  FORBIDDEN: 'Bu işlem için yetkiniz yok.',
  NOT_FOUND: 'Aradığınız kayıt bulunamadı.',
  INVALID_CREDENTIALS: 'E-posta adresi veya şifre hatalı.',
  TOO_MANY_ATTEMPTS: 'Çok fazla başarısız deneme yapıldı. Birkaç dakika sonra tekrar deneyin.',
  EMAIL_TAKEN: 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.',
  SEAT_LIMIT_REACHED: 'Paketinizdeki kullanıcı koltukları dolu.',
  ALREADY_MEMBER: 'Bu kişi zaten workspace üyesi.',
  INVITATION_PENDING: 'Bu adrese gönderilmiş bekleyen bir davet var.',
  INVITATION_INVALID: 'Davet geçersiz, kullanılmış veya süresi dolmuş.',
  INVITATION_EMAIL_MISMATCH:
    'Bu davet başka bir e-posta adresine gönderilmiş. Davet edilen adresle giriş yapın.',
  ORIGIN_NOT_ALLOWED: 'İstek reddedildi. Sayfayı yenileyip tekrar deneyin.',
  INTERNAL_ERROR: 'Bir sorun oluştu. Lütfen tekrar deneyin.',
};

export function errorMessage(error: ApiErrorBody): string {
  if (error.statusCode === 0) return 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.';
  return MESSAGES[error.code] ?? MESSAGES.INTERNAL_ERROR;
}

/** Only same-site relative paths are accepted as post-login redirects (no open redirect). */
export function safeNextPath(value: string | string[] | undefined | null): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  return v;
}
