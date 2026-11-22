import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { projectManifestV1Schema, type VideoFormat } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { PipelineError } from '../video/errors';
import { PrismaService } from '../infra/prisma.service';
import { StorageService } from '../infra/storage.service';
import { buildRenderArgs, FRAME, RENDERER_VERSION, runFfmpeg, type RenderInput } from './ffmpeg';

const FORMAT_FILE: Record<VideoFormat, string> = {
  PORTRAIT_9_16: 'portrait.mp4',
  LANDSCAPE_16_9: 'landscape.mp4',
};

/**
 * Renders both formats for one generation. Reads only the stored manifest, so the output can be
 * rebuilt from it. Each finished format is recorded before the next starts, so a retry skips it.
 */
@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async render(tenantId: string, generationId: string): Promise<void> {
    const gen = await this.prisma.videoGeneration.findFirstOrThrow({
      where: { id: generationId, tenantId },
      include: {
        videoProject: { select: { id: true } },
        scenes: { orderBy: { sceneNumber: 'asc' } },
      },
    });
    const parsed = projectManifestV1Schema.safeParse(gen.manifestJson);
    if (!parsed.success) throw new PipelineError('INTERNAL_ERROR', false, '');
    const manifest = parsed.data;

    const assetIds = manifest.scenes.map((s) => s.asset).filter((a): a is string => !!a);
    const assets = await this.prisma.propertyAsset.findMany({
      where: { id: { in: assetIds }, tenantId },
      select: { id: true, storageKey: true },
    });
    const keyOf = new Map(assets.map((a) => [a.id, a.storageKey]));

    const dir = await mkdtemp(path.join(tmpdir(), 'render-'));
    try {
      const inputs: RenderInput[] = [];
      for (const scene of manifest.scenes) {
        if (scene.clipSource === 'provider' && scene.clipKey) {
          const file = path.join(dir, `clip-${scene.n}.mp4`);
          await writeFile(file, await this.storage.getBuffer(scene.clipKey));
          inputs.push({ path: file, kind: 'video', seconds: scene.seconds });
          continue;
        }
        const key = scene.asset ? keyOf.get(scene.asset) : undefined;
        if (!key) throw new PipelineError('INVALID_MEDIA', false, '');
        const file = path.join(dir, `scene-${scene.n}${path.extname(key) || '.jpg'}`);
        await writeFile(file, await this.storage.getBuffer(key));
        inputs.push({ path: file, kind: 'image', seconds: scene.seconds });
      }

      const audio = { voicePath: null as string | null, musicPath: null as string | null };
      if (manifest.voice?.storageKey) {
        audio.voicePath = path.join(dir, 'voice.mp3');
        await writeFile(audio.voicePath, await this.storage.getBuffer(manifest.voice.storageKey));
      }
      if (manifest.music?.storageKey) {
        audio.musicPath = path.join(dir, 'music.mp3');
        await writeFile(audio.musicPath, await this.storage.getBuffer(manifest.music.storageKey));
      }

      for (const format of manifest.formats) {
        const existing = await this.prisma.videoOutput.findUnique({
          where: { videoGenerationId_format: { videoGenerationId: generationId, format } },
        });
        if (existing) continue;

        const out = path.join(dir, FORMAT_FILE[format]);
        try {
          await runFfmpeg(buildRenderArgs(format, inputs, audio, out));
        } catch (err) {
          this.logger.warn(
            {
              generationId,
              format,
              err: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
            },
            'render failed',
          );
          throw new PipelineError('RENDER_FAILED', true, '');
        }
        const bytes = await readFile(out);
        const key = `generations/${tenantId}/${gen.videoProject.id}/${generationId}/renders/${FORMAT_FILE[format]}`;
        await this.storage.put(key, bytes, 'video/mp4');
        await this.prisma.videoOutput.create({
          data: {
            tenantId,
            videoGenerationId: generationId,
            format,
            storageKey: key,
            mimeType: 'video/mp4',
            fileSize: bytes.length,
            durationSeconds: manifest.totalSeconds,
            width: FRAME[format].width,
            height: FRAME[format].height,
            checksum: createHash('sha256').update(bytes).digest('hex'),
            rendererVersion: RENDERER_VERSION,
          },
        });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
