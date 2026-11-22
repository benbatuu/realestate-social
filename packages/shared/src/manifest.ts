import { z } from 'zod';

export const videoFormatSchema = z.enum(['PORTRAIT_9_16', 'LANDSCAPE_16_9']);
export type VideoFormat = z.infer<typeof videoFormatSchema>;

/**
 * Project manifest v1 (blueprint §8.7: versioned, rebuildable). Renders read only this document,
 * so a render can be reproduced from it.
 */
export const projectManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  scriptText: z.string().min(1).max(2_000),
  totalSeconds: z.number().int().min(20).max(60),
  formats: z.tuple([z.literal('PORTRAIT_9_16'), z.literal('LANDSCAPE_16_9')]),
  scenes: z
    .array(
      z.object({
        n: z.number().int().min(1),
        type: z.enum(['AI_VIDEO', 'PHOTO_MOTION']),
        seconds: z.number().int().min(1).max(60),
        asset: z.uuid().nullable(),
        /** Where the moving picture came from. `mock` until a real image-to-video provider (M6). */
        clipSource: z.enum(['provider', 'mock', 'photo']),
        /** Storage key of the provider clip, when clipSource is 'provider'. */
        clipKey: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(12),
  voice: z
    .object({
      externalJobId: z.string(),
      characters: z.number().int(),
      storageKey: z.string().nullable(),
    })
    .optional(),
  music: z
    .object({ trackId: z.string(), license: z.string(), storageKey: z.string().nullable() })
    .optional(),
});
export type ProjectManifestV1 = z.infer<typeof projectManifestV1Schema>;

/** Output file record as the API returns it. Download links are short-lived. */
export const videoOutputSchema = z.object({
  format: videoFormatSchema,
  mimeType: z.string(),
  fileSize: z.number().int(),
  durationSeconds: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  checksum: z.string(),
  downloadUrl: z.url(),
  /** Always true until M6 (real clips) and M7 (review). Shown as a draft to users. */
  isMock: z.boolean(),
});
export type VideoOutput = z.infer<typeof videoOutputSchema>;
