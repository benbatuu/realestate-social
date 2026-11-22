import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { checkPhoto } from './photos';

const image = (w: number, h: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg') =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 140, b: 160 } } })
    .toFormat(format)
    .toBuffer();

describe('checkPhoto', () => {
  it('accepts JPEG/PNG/WebP and builds a WebP thumbnail', async () => {
    for (const f of ['jpeg', 'png', 'webp'] as const) {
      const r = await checkPhoto(await image(1200, 800, f));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect([r.width, r.height]).toEqual([1200, 800]);
        expect(r.checksum).toMatch(/^[0-9a-f]{64}$/);
        const thumb = await sharp(r.thumbnail).metadata();
        expect(thumb.format).toBe('webp');
        expect(Math.max(thumb.width ?? 0, thumb.height ?? 0)).toBe(640);
      }
    }
  });

  it('reports displayed size for EXIF-rotated photos', async () => {
    const rotated = await sharp(await image(1200, 800))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const r = await checkPhoto(rotated);
    expect(r.ok && [r.width, r.height]).toEqual([800, 1200]);
  });

  it('rejects non-images, tiny images and judges by content, not name', async () => {
    expect(await checkPhoto(Buffer.from('not an image'))).toMatchObject({ ok: false });
    expect(await checkPhoto(await image(300, 300))).toMatchObject({ ok: false });
    const gif = await sharp({
      create: { width: 800, height: 800, channels: 3, background: '#fff' },
    })
      .gif()
      .toBuffer();
    expect(await checkPhoto(gif)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('JPEG'),
    });
  });
});
