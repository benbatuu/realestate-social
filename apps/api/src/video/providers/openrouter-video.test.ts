import { describe, expect, it } from 'vitest';
import { clampDuration, estimateClipMicroUsd } from './openrouter-video';

// Price lists as returned by GET /api/v1/videos/models on 2026-11-23.
const SEEDANCE_25 = {
  video_tokens: '0.0000107',
  video_tokens_1080p: '0.0000117',
  video_tokens_without_audio: '0.0000107',
};
const VEO_31_FAST = {
  duration_seconds_with_audio: '0.12',
  duration_seconds_without_audio: '0.10',
  duration_seconds_without_audio_720p: '0.08',
};
const WAN_30 = { duration_seconds_480p: '0.05', duration_seconds_1080p: '0.2' };
const RUNWAY = { cents_per_second_output: '12' };

describe('clampDuration', () => {
  it('keeps a supported duration', () => {
    expect(clampDuration(5, [-1, 4, 5, 6])).toBe(5);
  });
  it('rounds up to the next supported duration (renderer trims)', () => {
    expect(clampDuration(5, [4, 6, 8])).toBe(6);
  });
  it('uses the longest when none is long enough', () => {
    expect(clampDuration(10, [4, 6, 8])).toBe(8);
  });
  it('passes through when the model lists nothing', () => {
    expect(clampDuration(5, null)).toBe(5);
  });
});

describe('estimateClipMicroUsd', () => {
  it('prices token-billed Seedance from frame size: 480p matches the listed $0.1028/s', () => {
    const perSecond = estimateClipMicroUsd(SEEDANCE_25, '480p', 1)!;
    expect(perSecond / 1_000_000).toBeCloseTo(0.1028, 3);
  });
  it('uses the 1080p token price for 1080p', () => {
    // 1920 × 1080 × 24 / 1024 = 48,600 tokens/s × 0.0000117 ≈ $0.569/s
    expect(estimateClipMicroUsd(SEEDANCE_25, '1080p', 5)! / 1_000_000).toBeCloseTo(2.84, 2);
  });
  it('uses the silent per-second price', () => {
    expect(estimateClipMicroUsd(VEO_31_FAST, '1080p', 6)).toBe(600_000);
    expect(estimateClipMicroUsd(VEO_31_FAST, '720p', 6)).toBe(480_000);
  });
  it('reads resolution-specific prices', () => {
    expect(estimateClipMicroUsd(WAN_30, '1080p', 5)).toBe(1_000_000);
  });
  it('reads cents per second', () => {
    expect(estimateClipMicroUsd(RUNWAY, '720p', 5)).toBe(600_000);
  });
  it('returns null without a usable price, so nothing is spent blind', () => {
    expect(estimateClipMicroUsd({ reference_images: '0.04' }, '1080p', 5)).toBeNull();
    expect(estimateClipMicroUsd(null, '1080p', 5)).toBeNull();
  });
});
