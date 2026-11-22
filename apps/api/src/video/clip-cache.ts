import { createHash } from 'node:crypto';

/**
 * Key for reusing a paid clip (plan-08). Everything that changes the output is part of it, and
 * the workspace is too: clips are never shared between workspaces.
 */
export function clipCacheKey(input: {
  tenantId: string;
  checksum: string;
  model: string;
  prompt: string;
  seconds: number;
  settings: string;
}): string {
  return createHash('sha256')
    .update(
      [
        'v1',
        input.tenantId,
        input.checksum,
        input.model,
        input.seconds,
        input.settings,
        input.prompt,
      ].join('\n'),
    )
    .digest('hex');
}
