import { describe, expect, it } from 'vitest';
import { durationForPhotoCount, planScenes } from './policy';
import { unsupportedNumbers } from './script-check';

describe('planScenes', () => {
  it('uses the policy AI scene count and never reuses a photo', () => {
    const plan = planScenes(10, 30);
    const ai = plan.filter((p) => p.sceneType === 'AI_VIDEO');
    expect(ai).toHaveLength(4);
    expect(new Set(plan.map((p) => p.photoIndex)).size).toBe(plan.length);
  });

  it('never plans more scenes than photos', () => {
    expect(planScenes(2, 60)).toHaveLength(2);
  });
});

describe('durationForPhotoCount', () => {
  it('picks a length from the photo count', () => {
    expect(durationForPhotoCount(4)).toBe(30);
    expect(durationForPhotoCount(9)).toBe(45);
    expect(durationForPhotoCount(20)).toBe(60);
  });
});

describe('unsupportedNumbers (blueprint §3.6)', () => {
  it('accepts numbers present in the facts', () => {
    expect(
      unsupportedNumbers('3+1 daire, 145 metrekare.', { roomLayout: '3+1', grossAreaM2: '145' }),
    ).toEqual([]);
  });

  it('flags invented numbers', () => {
    expect(unsupportedNumbers('Denize 5 dakika.', { roomLayout: '3+1' })).toEqual(['5']);
  });
});
