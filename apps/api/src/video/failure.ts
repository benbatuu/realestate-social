import { videoFailureCodeSchema, type VideoFailureCode } from '@app/shared';

export type { VideoFailureCode };
export const isFailureCode = (v: unknown): v is VideoFailureCode =>
  videoFailureCodeSchema.safeParse(v).success;
