import { describe, expect, it } from 'vitest';
import { buildRenderArgs } from './ffmpeg';

const images = [
  { path: '/tmp/a.jpg', kind: 'image' as const, seconds: 5 },
  { path: '/tmp/b.jpg', kind: 'image' as const, seconds: 6 },
];
const noAudio = { voicePath: null, musicPath: null };

describe('buildRenderArgs', () => {
  it('is deterministic for the same input', () => {
    const a = buildRenderArgs('PORTRAIT_9_16', images, noAudio, '/tmp/o.mp4');
    const b = buildRenderArgs('PORTRAIT_9_16', images, noAudio, '/tmp/o.mp4');
    expect(a).toEqual(b);
  });

  it('uses the frame size of each format', () => {
    const portrait = buildRenderArgs('PORTRAIT_9_16', images, noAudio, '/tmp/o.mp4').join(' ');
    const landscape = buildRenderArgs('LANDSCAPE_16_9', images, noAudio, '/tmp/o.mp4').join(' ');
    expect(portrait).toContain('s=1080x1920');
    expect(landscape).toContain('s=1920x1080');
  });

  it('total length is the sum of scene seconds', () => {
    const args = buildRenderArgs('PORTRAIT_9_16', images, noAudio, '/tmp/o.mp4');
    const i = args.lastIndexOf('-t');
    expect(args[i + 1]).toBe('11');
  });

  it('uses a silent track when there is no audio, and mixes voice with music when both exist', () => {
    const silent = buildRenderArgs('PORTRAIT_9_16', images, noAudio, '/tmp/o.mp4').join(' ');
    expect(silent).toContain('anullsrc');
    const mixed = buildRenderArgs(
      'PORTRAIT_9_16',
      images,
      { voicePath: '/tmp/v.mp3', musicPath: '/tmp/m.mp3' },
      '/tmp/o.mp4',
    ).join(' ');
    expect(mixed).toContain('amix=inputs=2');
    expect(mixed).not.toContain('anullsrc');
  });

  it('trims provider clips to their scene length', () => {
    const args = buildRenderArgs(
      'LANDSCAPE_16_9',
      [{ path: '/tmp/c.mp4', kind: 'video', seconds: 5 }],
      noAudio,
      '/tmp/o.mp4',
    ).join(' ');
    expect(args).toContain('trim=0:5');
    expect(args).toContain('tpad=stop_mode=clone');
  });
});
