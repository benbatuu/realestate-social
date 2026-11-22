/**
 * Video generation policy (blueprint §3.1, §3.2, §5.3). One source of truth; M8 moves these to
 * the database. Costs are estimates in micro-USD (1 USD = 1,000,000) for the mock providers, using
 * the blueprint's planning rate for image-to-video with audio off.
 */
export const VIDEO_POLICY = {
  allowedDurations: [30, 45, 60] as const,
  clipSeconds: 5,
  /** AI clips take minutes: check every 15 s, give up after 30 min (plan-08). */
  pollDelayMs: 15_000,
  maxPolls: 120,
  /** AI scene count per video length. Photos beyond this count use the motion template. */
  aiScenesByDuration: { 30: 4, 45: 5, 60: 6 } as const,
  i2vMicroUsdPerSecond: 112_000,
  ttsMicroUsdPerCharacter: 100,
  /** Photo counts that pick the length automatically when the user does not choose. */
  durationByPhotoCount: [
    { maxPhotos: 6, seconds: 30 },
    { maxPhotos: 12, seconds: 45 },
    { maxPhotos: Number.POSITIVE_INFINITY, seconds: 60 },
  ],
} as const;

/**
 * Image-to-video prompt (plan-08). English, since the video models follow it more closely. The
 * fixed rules keep the listing truthful: only the camera moves, nothing is added or changed.
 * Room-aware camera moves come with photo analysis (phase 2).
 */
export const I2V_PROMPT =
  'Slow, smooth cinematic camera dolly forward through the space, steady and level, real estate ' +
  'showcase. Keep the architecture, walls, furniture, materials, colors, lighting and window ' +
  'views exactly as in the photo. Do not add, remove or change any object. No people, no text, ' +
  'no logos. The scene is static; only the camera moves.';

export type VideoDuration = (typeof VIDEO_POLICY.allowedDurations)[number];

export function durationForPhotoCount(photoCount: number): VideoDuration {
  const row = VIDEO_POLICY.durationByPhotoCount.find((r) => photoCount <= r.maxPhotos);
  return (row?.seconds ?? 60) as VideoDuration;
}

export interface ScenePlanItem {
  sceneNumber: number;
  sceneType: 'AI_VIDEO' | 'PHOTO_MOTION';
  photoIndex: number;
  durationSeconds: number;
}

/**
 * Splits the video into scenes. Each photo is used at most once. The first photos become AI
 * clips (capped by length), the rest use the motion template. Returns fewer scenes than the
 * target when there are fewer photos.
 */
export function planScenes(photoCount: number, durationSeconds: VideoDuration): ScenePlanItem[] {
  const sceneCount = Math.min(
    photoCount,
    VIDEO_POLICY.aiScenesByDuration[durationSeconds] +
      Math.max(0, photoCount - VIDEO_POLICY.aiScenesByDuration[durationSeconds]),
  );
  const aiCount = Math.min(VIDEO_POLICY.aiScenesByDuration[durationSeconds], photoCount);
  const plan: ScenePlanItem[] = [];
  const perScene = Math.floor(durationSeconds / Math.max(1, sceneCount));
  for (let i = 0; i < sceneCount; i++) {
    const isAi = i < aiCount;
    plan.push({
      sceneNumber: i + 1,
      sceneType: isAi ? 'AI_VIDEO' : 'PHOTO_MOTION',
      photoIndex: i,
      durationSeconds: isAi ? VIDEO_POLICY.clipSeconds : perScene,
    });
  }
  return plan;
}
