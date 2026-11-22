import { createHash } from 'node:crypto';
import sharp from 'sharp';

export type PhotoCheck =
  | {
      ok: true;
      mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
      ext: 'jpg' | 'png' | 'webp';
      width: number;
      height: number;
      checksum: string;
      thumbnail: Buffer;
    }
  | { ok: false; reason: string };

const FORMATS = {
  jpeg: { mimeType: 'image/jpeg', ext: 'jpg' },
  png: { mimeType: 'image/png', ext: 'png' },
  webp: { mimeType: 'image/webp', ext: 'webp' },
} as const;

const MIN_SHORT_SIDE = 400;
const THUMBNAIL_SIZE = 640;
/** Decompression-bomb guard (~100 megapixels). */
const MAX_PIXELS = 100_000_000;

/**
 * Validates an uploaded photo by its content (never the client's MIME type or extension),
 * reads its displayed size after EXIF orientation, and renders a small WebP preview.
 * Reasons are user-facing Turkish text.
 */
export async function checkPhoto(buf: Buffer): Promise<PhotoCheck> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    return { ok: false, reason: 'Görsel okunamadı.' };
  }
  if (meta.format === 'heif') {
    return {
      ok: false,
      reason: 'HEIC fotoğraflar henüz desteklenmiyor. JPEG olarak dışa aktarıp yükleyin.',
    };
  }
  const format = meta.format ? FORMATS[meta.format as keyof typeof FORMATS] : undefined;
  if (!format) return { ok: false, reason: 'Yalnızca JPEG, PNG ve WebP yüklenebilir.' };

  // Displayed dimensions: EXIF orientations 5–8 swap width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  if (Math.min(width, height) < MIN_SHORT_SIDE) {
    return {
      ok: false,
      reason: `Fotoğraf çok küçük (kısa kenar en az ${MIN_SHORT_SIDE} piksel olmalı).`,
    };
  }

  let thumbnail: Buffer;
  try {
    thumbnail = await sharp(buf, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    return { ok: false, reason: 'Görsel işlenemedi.' };
  }
  return {
    ok: true,
    ...format,
    width,
    height,
    checksum: createHash('sha256').update(buf).digest('hex'),
    thumbnail,
  };
}
