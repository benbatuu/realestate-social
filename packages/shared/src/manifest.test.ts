import { describe, expect, it } from 'vitest';
import { projectManifestV1Schema } from './manifest';

const valid = {
  schemaVersion: 1,
  scriptText: 'Moda’da 3+1 daire.',
  totalSeconds: 30,
  formats: ['PORTRAIT_9_16', 'LANDSCAPE_16_9'],
  scenes: [
    {
      n: 1,
      type: 'PHOTO_MOTION',
      seconds: 6,
      asset: '0195a5a4-1111-7000-8000-000000000001',
      clipSource: 'photo',
    },
  ],
};

describe('projectManifestV1Schema', () => {
  it('accepts a v1 manifest', () => {
    expect(projectManifestV1Schema.safeParse(valid).success).toBe(true);
  });

  it('rejects another schema version and wrong formats', () => {
    expect(projectManifestV1Schema.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(false);
    expect(
      projectManifestV1Schema.safeParse({ ...valid, formats: ['PORTRAIT_9_16'] }).success,
    ).toBe(false);
  });
});
