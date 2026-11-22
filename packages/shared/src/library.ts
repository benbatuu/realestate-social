import { z } from 'zod';
import { videoFormatSchema } from './manifest';

export const videoLibraryQuerySchema = z.object({
  format: videoFormatSchema.optional(),
  propertyId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  /** Calendar dates (YYYY-MM-DD), inclusive, UTC. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type VideoLibraryQuery = z.infer<typeof videoLibraryQuerySchema>;

export const videoLibraryFormatSchema = z.object({
  format: videoFormatSchema,
  width: z.number().int(),
  height: z.number().int(),
  durationSeconds: z.number().int(),
  fileSize: z.number().int(),
  /** Short-lived. Plays inline in the browser. */
  playUrl: z.url(),
  /** Short-lived. Forces a file download with a readable name. */
  downloadUrl: z.url(),
});

export const videoLibraryItemSchema = z.object({
  generationId: z.uuid(),
  projectId: z.uuid(),
  propertyId: z.uuid(),
  propertyTitle: z.string(),
  generationNumber: z.number().int(),
  completedAt: z.iso.datetime().nullable(),
  durationSeconds: z.number().int(),
  /** Thumbnail from the first photo. Null when the property has no photo. */
  thumbnailUrl: z.url().nullable(),
  /** Custom folder cover of the property, when one is set. */
  folderCoverUrl: z.url().nullable(),
  formats: z.array(videoLibraryFormatSchema),
  /** Always true until a real renderer and real clips are used in production (M5/M6). */
  isMock: z.boolean(),
});
export type VideoLibraryItem = z.infer<typeof videoLibraryItemSchema>;

export const videoLibraryResponseSchema = z.object({
  items: z.array(videoLibraryItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** Bytes used by all finished videos in this workspace. */
  storageBytes: z.number().int(),
});
export type VideoLibraryResponse = z.infer<typeof videoLibraryResponseSchema>;
