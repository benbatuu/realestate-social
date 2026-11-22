import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { ProviderError, type MusicProvider } from './types';

const catalogSchema = z.array(
  z.object({
    id: z.string().min(1),
    mood: z.string().min(1),
    file: z.string().min(1),
    /** Licence name and the document that proves commercial use and redistribution rights. */
    license: z.string().min(1),
    licenseDocument: z.string().min(1),
  }),
);

/**
 * Licensed music only (blueprint §3.8). Tracks come from a catalogue file with documented rights.
 * No catalogue entry means no music, which fails the generation instead of using unlicensed audio.
 */
export class CatalogMusic implements MusicProvider {
  readonly name = 'catalog';
  readonly model = 'licensed-catalog-v1';

  constructor(private readonly catalogPath: string) {}

  async select(input: { mood: string; durationSeconds: number }) {
    const tracks = catalogSchema.parse(JSON.parse(await readFile(this.catalogPath, 'utf8')));
    const track = tracks.find((t) => t.mood === input.mood) ?? tracks[0];
    if (!track) throw new ProviderError('PROVIDER_JOB_FAILED', false, 'empty music catalog');
    return {
      trackId: track.id,
      license: track.license,
      file: track.file,
      externalJobId: `catalog-${track.id}`,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'select',
        externalRequestId: null,
        units: 1,
        unitType: 'calls' as const,
        estimatedCostMicroUsd: 0,
        isMock: false,
      },
    };
  }
}
