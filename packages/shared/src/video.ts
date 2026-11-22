import { z } from 'zod';
import { billingTypeSchema } from './credits';

export const VIDEO_STAGES = [
  'QUEUED',
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
  'FAILED',
] as const;
export const videoStageSchema = z.enum(VIDEO_STAGES);
export type VideoStage = z.infer<typeof videoStageSchema>;

/** Failure codes from blueprint §12.4 (only those M4 can produce). */
export const VIDEO_FAILURE_CODES = [
  'PROVIDER_JOB_FAILED',
  'PROVIDER_TIMEOUT',
  'LLM_SCHEMA_INVALID',
  'INVALID_MEDIA',
  'QUALITY_REJECTED',
  'RENDER_FAILED',
  'PROVIDER_RATE_LIMIT',
  'PROVIDER_AUTH_ERROR',
  'ASSET_DOWNLOAD_FAILED',
  'MUSIC_LICENSE_OR_ASSET_ERROR',
  'INTERNAL_ERROR',
] as const;
export const videoFailureCodeSchema = z.enum(VIDEO_FAILURE_CODES);
export type VideoFailureCode = z.infer<typeof videoFailureCodeSchema>;

export const videoGenerationSchema = z.object({
  id: z.uuid(),
  videoProjectId: z.uuid(),
  generationNumber: z.number().int(),
  status: z.enum(['RESERVED', 'CAPTURED', 'RELEASED']),
  billingType: billingTypeSchema,
  stage: videoStageSchema,
  progress: z.number().int().min(0).max(100),
  durationSeconds: z.number().int(),
  failureCode: videoFailureCodeSchema.nullable(),
  failureMessage: z.string().nullable(),
  /** Always true until the renderer exists (M5). The UI must label outputs as placeholders. */
  isMock: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type VideoGeneration = z.infer<typeof videoGenerationSchema>;

export const videoProjectSchema = z.object({
  id: z.uuid(),
  propertyId: z.uuid(),
  title: z.string(),
  freeRegenerationUsed: z.boolean(),
  generationCount: z.number().int(),
  createdAt: z.iso.datetime(),
  generations: z.array(videoGenerationSchema),
});
export type VideoProject = z.infer<typeof videoProjectSchema>;

export const videoGenerationEventSchema = z.object({
  id: z.uuid(),
  stage: videoStageSchema,
  progress: z.number().int(),
  status: z.enum(['RESERVED', 'CAPTURED', 'RELEASED']),
  failureCode: videoFailureCodeSchema.nullable(),
  failureMessage: z.string().nullable(),
  terminal: z.boolean(),
});
export type VideoGenerationEvent = z.infer<typeof videoGenerationEventSchema>;

export const TERMINAL_VIDEO_STAGES: readonly VideoStage[] = ['COMPLETED', 'FAILED'];
