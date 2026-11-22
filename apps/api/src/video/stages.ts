import type { VideoStage } from '@app/shared';

/** Stages a pipeline run passes through, in order. QUEUED and FAILED are not run as jobs. */
export const RUN_ORDER: readonly VideoStage[] = [
  'VALIDATING',
  'ANALYZING_PHOTOS',
  'PLANNING_SCENES',
  'GENERATING_SCRIPT',
  'GENERATING_AI_SCENES',
  'GENERATING_VOICE',
  'SELECTING_MUSIC',
  'COMPOSING_VIDEO',
  'RENDERING',
  'QUALITY_CHECK',
  'COMPLETED',
];

/** Progress shown to users: the percentage of work finished when a stage starts. */
export const STAGE_PROGRESS: Record<VideoStage, number> = {
  QUEUED: 0,
  VALIDATING: 5,
  ANALYZING_PHOTOS: 12,
  PLANNING_SCENES: 22,
  GENERATING_SCRIPT: 30,
  GENERATING_AI_SCENES: 40,
  GENERATING_VOICE: 75,
  SELECTING_MUSIC: 80,
  COMPOSING_VIDEO: 85,
  RENDERING: 92,
  QUALITY_CHECK: 97,
  COMPLETED: 100,
  FAILED: 100,
};

export function nextStage(stage: VideoStage): VideoStage | null {
  const i = RUN_ORDER.indexOf(stage);
  return i >= 0 && i < RUN_ORDER.length - 1 ? (RUN_ORDER[i + 1] ?? null) : null;
}

/** True when `done` is at or after `stage` in the run order (the stage already ran). */
export function isAtOrAfter(done: VideoStage, stage: VideoStage): boolean {
  const a = RUN_ORDER.indexOf(done);
  const b = RUN_ORDER.indexOf(stage);
  if (done === 'FAILED') return true;
  if (a === -1) return false;
  return a >= b;
}
