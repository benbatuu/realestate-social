import { NotificationsService } from '../notifications/notifications.service';
import type { VideoStage } from '@app/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { Queue } from 'bullmq';
import { StorageService } from '../infra/storage.service';
import { CreditsService } from '../credits/credits.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { QUEUES, type VideoStageJob } from '../queues/queues';
import { ProviderRegistry } from './providers/registry';
import { RenderService } from '../render/render.service';
import { ProviderError } from './providers/types';
import { PipelineError, SAFE_MESSAGES } from './errors';
import type { VideoFailureCode } from './failure';
import { I2V_PROMPT, planScenes, VIDEO_POLICY } from './policy';
import { clipCacheKey } from './clip-cache';
import { SpendGuard } from './spend-guard.service';
import { isAtOrAfter, nextStage, STAGE_PROGRESS } from './stages';
import { unsupportedNumbers } from './script-check';

/**
 * Runs one pipeline stage at a time (blueprint §12.3). Each stage is its own BullMQ job, keyed by
 * generation and stage, so duplicates collapse. Progress lives in the database; a retried job
 * skips finished work (scenes already generated, provider jobs already submitted).
 */
@Injectable()
export class PipelineRunner {
  private readonly logger = new Logger(PipelineRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly providers: ProviderRegistry,
    private readonly renderer: RenderService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly spend: SpendGuard,
    @InjectQueue(QUEUES.video) private readonly queue: Queue<VideoStageJob>,
  ) {}

  /** Queues a stage. Same generation and stage always map to one job. */
  async enqueue(tenantId: string, generationId: string, stage: VideoStage): Promise<void> {
    await this.queue.add(
      stage,
      { generationId, tenantId },
      {
        jobId: `${generationId}-${stage}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
      },
    );
  }

  /** Runs a stage. Throws PipelineError for failures the caller must act on. */
  async runStage(
    tenantId: string,
    generationId: string,
    stage: VideoStage,
    poll = 0,
  ): Promise<void> {
    const gen = await this.prisma.videoGeneration.findFirst({
      where: { id: generationId, tenantId },
    });
    if (!gen || gen.stage === 'COMPLETED' || gen.stage === 'FAILED') return;
    // A later stage already ran. The current stage may run again: a retry or a provider poll.
    if (gen.stage !== stage && isAtOrAfter(gen.stage, stage)) return;

    if (gen.stage !== stage) {
      await this.prisma.videoGeneration.update({
        where: { id: gen.id },
        data: { stage, progress: STAGE_PROGRESS[stage], startedAt: gen.startedAt ?? new Date() },
      });
    }

    const outcome = await this.handle(tenantId, gen.id, stage, poll);
    if (outcome === 'wait') {
      // Check again later without spending a failure attempt.
      await this.queue.add(
        stage,
        { generationId, tenantId, poll: poll + 1 },
        {
          jobId: `${generationId}-${stage}-poll-${poll + 1}`,
          delay: VIDEO_POLICY.pollDelayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        },
      );
      return;
    }

    const next = nextStage(stage);
    if (next === 'COMPLETED') {
      await this.complete(tenantId, gen.id);
    } else if (next) {
      await this.prisma.videoGeneration.update({
        where: { id: gen.id },
        data: { progress: STAGE_PROGRESS[next] },
      });
      await this.enqueue(tenantId, gen.id, next);
    }
  }

  /** Final failure: record a safe reason and give the reserved credit or free regeneration back. */
  async fail(tenantId: string, generationId: string, code: VideoFailureCode): Promise<void> {
    const gen = await this.prisma.videoGeneration.findFirst({
      where: { id: generationId, tenantId },
    });
    if (!gen || gen.stage === 'COMPLETED' || gen.stage === 'FAILED') return;
    await this.prisma.videoGeneration.update({
      where: { id: gen.id },
      data: {
        stage: 'FAILED',
        progress: 100,
        failureCode: code,
        failureMessage: SAFE_MESSAGES[code] ?? null,
        completedAt: new Date(),
      },
    });
    if (gen.status === 'RESERVED') await this.credits.release(tenantId, gen.id, code);
    await this.notifyCreator(
      tenantId,
      gen.id,
      'video.failed',
      'Video üretilemedi',
      SAFE_MESSAGES[code] ?? 'Bir hata oluştu.',
    );
    this.logger.warn({ generationId: gen.id, code }, 'video generation failed');
  }

  private async complete(tenantId: string, generationId: string): Promise<void> {
    await this.prisma.videoGeneration.update({
      where: { id: generationId },
      data: { stage: 'COMPLETED', progress: 100, completedAt: new Date() },
    });
    await this.credits.capture(tenantId, generationId);
    await this.notifyCreator(
      tenantId,
      generationId,
      'video.completed',
      'Videonuz hazır',
      'Video üretimi tamamlandı.',
    );
    await this.checkCreditsLow(tenantId);
  }

  /** Warns the team once per period when credits fall below 20% of the monthly amount. */
  private async checkCreditsLow(tenantId: string): Promise<void> {
    const balance = await this.credits.balance(tenantId);
    const monthly = balance.credits.monthly;
    if (monthly <= 0 || balance.credits.available / monthly >= 0.2 || !balance.periodStart) return;
    const already = await this.prisma.notification.count({
      where: { tenantId, kind: 'credits.low', createdAt: { gte: new Date(balance.periodStart) } },
    });
    if (already > 0) return;
    await this.notifications.notifyTeam(tenantId, {
      kind: 'credits.low',
      title: 'Kredi azaldı',
      body: `Kalan kredi ${balance.credits.available} / ${monthly}.`,
      link: '/billing',
    });
  }

  /** Tells the person who started the video. Silent when nobody is recorded. */
  private async notifyCreator(
    tenantId: string,
    generationId: string,
    kind: string,
    title: string,
    body: string,
  ) {
    const gen = await this.prisma.videoGeneration.findFirst({
      where: { id: generationId, tenantId },
      select: { videoProject: { select: { propertyId: true, createdByUserId: true } } },
    });
    const userId = gen?.videoProject.createdByUserId;
    if (!userId) return;
    await this.notifications.create(this.prisma, {
      tenantId,
      userId,
      kind,
      title,
      body,
      link: `/properties/${gen?.videoProject.propertyId}?tab=videolar`,
    });
  }

  private async handle(
    tenantId: string,
    generationId: string,
    stage: VideoStage,
    poll: number,
  ): Promise<'wait' | void> {
    const gen = await this.prisma.videoGeneration.findFirstOrThrow({
      where: { id: generationId, tenantId },
      include: { videoProject: true },
    });
    const propertyId = gen.videoProject.propertyId;

    switch (stage) {
      case 'VALIDATING': {
        const property = await this.prisma.property.findFirst({
          where: { id: propertyId, tenantId },
        });
        const photos = await this.prisma.propertyAsset.count({ where: { propertyId, tenantId } });
        if (!property || photos === 0) throw new PipelineError('INVALID_MEDIA', false, '');
        const snapshot = {
          title: property.title,
          listingType: property.listingType,
          roomLayout: property.roomLayout,
          grossAreaM2: property.grossAreaM2?.toString() ?? null,
          netAreaM2: property.netAreaM2?.toString() ?? null,
          district: property.district,
          city: property.city,
          neighborhood: property.neighborhood,
          buildingAge: property.buildingAge,
          priceText:
            property.priceMinor === null || property.priceCurrency === null
              ? null
              : `${Number(property.priceMinor) / 100} ${property.priceCurrency}`,
        };
        await this.prisma.videoGeneration.update({
          where: { id: generationId },
          data: { propertySnapshotJson: snapshot },
        });
        return;
      }

      case 'ANALYZING_PHOTOS': {
        const photos = await this.prisma.propertyAsset.findMany({
          where: { propertyId, tenantId },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, width: true, height: true },
        });
        if (photos.length === 0) throw new PipelineError('INVALID_MEDIA', false, '');
        await this.prisma.videoGeneration.update({
          where: { id: generationId },
          data: {
            manifestJson: {
              photos: photos.map((p) => ({ assetId: p.id, width: p.width, height: p.height })),
            },
          },
        });
        return;
      }

      case 'PLANNING_SCENES': {
        const photos = await this.photoIds(tenantId, propertyId);
        const plan = planScenes(
          photos.length,
          gen.durationSeconds as (typeof VIDEO_POLICY.allowedDurations)[number],
        );
        await this.prisma.videoScene.deleteMany({ where: { videoGenerationId: generationId } });
        await this.prisma.videoScene.createMany({
          data: plan.map((s) => ({
            tenantId,
            videoGenerationId: generationId,
            sceneNumber: s.sceneNumber,
            sceneType: s.sceneType,
            sourceAssetId: photos[s.photoIndex] ?? null,
            durationSeconds: s.durationSeconds,
          })),
        });
        return;
      }

      case 'GENERATING_SCRIPT': {
        const facts = (gen.propertySnapshotJson ?? {}) as Record<string, unknown>;
        let text: string;
        try {
          const out = await this.providers.llm.generateScript({
            facts: facts as Record<string, string | number | boolean | null>,
            durationSeconds: gen.durationSeconds,
          });
          text = out.text;
          await this.recordUsage(tenantId, generationId, out.usage, 'SUCCEEDED');
        } catch (err) {
          throw this.providerFailure(err);
        }
        const invented = unsupportedNumbers(text, facts);
        if (invented.length > 0) throw new PipelineError('LLM_SCHEMA_INVALID', false, '');
        await this.prisma.videoGeneration.update({
          where: { id: generationId },
          data: { scriptJson: { text, facts: Object.keys(facts) } },
        });
        return;
      }

      case 'GENERATING_AI_SCENES': {
        const scenes = await this.prisma.videoScene.findMany({
          where: { videoGenerationId: generationId, sceneType: 'AI_VIDEO' },
          orderBy: { sceneNumber: 'asc' },
        });
        let stillRunning = false;
        for (const scene of scenes) {
          if (scene.status === 'DONE') continue;
          const done = await this.advanceAiScene(
            tenantId,
            generationId,
            scene,
            gen.generationNumber === 1,
          );
          if (!done) stillRunning = true;
        }
        if (!stillRunning) return;
        if (poll < VIDEO_POLICY.maxPolls) return 'wait';
        // Waited long enough: unfinished scenes show the photo. Their cost stays counted.
        const late = await this.prisma.videoScene.findMany({
          where: {
            videoGenerationId: generationId,
            sceneType: 'AI_VIDEO',
            status: { not: 'DONE' },
          },
          select: { id: true },
        });
        for (const s of late) await this.toPhotoMotion(s.id, 'provider too slow');
        return;
      }

      case 'GENERATING_VOICE': {
        const script = (gen.scriptJson ?? {}) as { text?: string };
        if (!script.text) throw new PipelineError('INTERNAL_ERROR', false, '');
        try {
          const out = await this.providers.tts.synthesize({
            idempotencyKey: `${generationId}:voice`,
            text: script.text,
            language: 'tr',
          });
          await this.recordUsage(tenantId, generationId, out.usage, 'SUCCEEDED');
          let storageKey: string | null = null;
          if (out.audio) {
            storageKey = this.key(tenantId, generationId, 'audio/voice.mp3');
            await this.storage.put(storageKey, out.audio, 'audio/mpeg');
          }
          await this.mergeManifest(generationId, {
            voice: { externalJobId: out.externalJobId, characters: script.text.length, storageKey },
          });
        } catch (err) {
          throw this.providerFailure(err);
        }
        return;
      }

      case 'SELECTING_MUSIC': {
        try {
          const out = await this.providers.music.select({
            mood: 'warm',
            durationSeconds: gen.durationSeconds,
          });
          await this.recordUsage(tenantId, generationId, out.usage, 'SUCCEEDED');
          let storageKey: string | null = null;
          if (out.file) {
            storageKey = this.key(tenantId, generationId, 'audio/music.mp3');
            await this.storage.put(storageKey, await readFile(out.file), 'audio/mpeg');
          }
          await this.mergeManifest(generationId, {
            music: { trackId: out.trackId, license: out.license, storageKey },
          });
        } catch (err) {
          throw this.providerFailure(err);
        }
        return;
      }

      case 'COMPOSING_VIDEO': {
        const scenes = await this.prisma.videoScene.findMany({
          where: { videoGenerationId: generationId },
          orderBy: { sceneNumber: 'asc' },
        });
        const total = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
        const script = (gen.scriptJson ?? {}) as { text?: string };
        if (total < 20 || total > 60 || !script.text)
          throw new PipelineError('INTERNAL_ERROR', false, '');
        await this.mergeManifest(generationId, {
          schemaVersion: 1,
          scriptText: script.text,
          formats: ['PORTRAIT_9_16', 'LANDSCAPE_16_9'],
          totalSeconds: total,
          scenes: scenes.map((s) => ({
            n: s.sceneNumber,
            type: s.sceneType,
            seconds: s.durationSeconds,
            asset: s.sourceAssetId,
            clipSource:
              s.sceneType === 'AI_VIDEO' ? (s.clipStorageKey ? 'provider' : 'mock') : 'photo',
            clipKey: s.clipStorageKey,
          })),
        });
        return;
      }

      case 'RENDERING': {
        await this.renderer.render(tenantId, generationId);
        return;
      }

      case 'QUALITY_CHECK': {
        if (process.env['MOCK_FAILURE_STAGE'] === 'QUALITY_CHECK') {
          throw new PipelineError('QUALITY_REJECTED', false, '');
        }
        return;
      }

      default:
        throw new PipelineError('INTERNAL_ERROR', false, '');
    }
  }

  /**
   * Moves one AI scene forward. Returns true when the scene is settled (clip stored, reused from
   * the cache, or turned into a photo-motion scene), false while the provider is still working.
   * A scene never fails the whole video: when both models fail or the budget refuses, the photo
   * is shown with the motion template instead (plan-08).
   */
  private async advanceAiScene(
    tenantId: string,
    generationId: string,
    scene: {
      id: string;
      sceneNumber: number;
      sourceAssetId: string | null;
      durationSeconds: number;
      externalJobId: string | null;
      model: string | null;
    },
    reuseCache: boolean,
  ): Promise<boolean> {
    const primary = this.providers.imageToVideo;
    const fallback = this.providers.imageToVideoFallback;

    // Mock provider: the original free path, no guard, no cache.
    if (primary.name === 'mock') {
      return this.advanceMockScene(tenantId, generationId, scene);
    }

    const provider = scene.model && fallback && scene.model === fallback.model ? fallback : primary;

    if (!scene.externalJobId) {
      const asset = scene.sourceAssetId
        ? await this.prisma.propertyAsset.findFirst({
            where: { id: scene.sourceAssetId, tenantId },
            select: { storageKey: true, checksum: true },
          })
        : null;
      if (!asset) throw new PipelineError('INVALID_MEDIA', false, '');

      const cacheKey = clipCacheKey({
        tenantId,
        checksum: asset.checksum,
        model: provider.model,
        prompt: I2V_PROMPT,
        seconds: scene.durationSeconds,
        settings: this.providers.imageToVideoSettings,
      });
      // A regeneration is a request for new clips (§3.7): the cache serves first generations only.
      const cached = reuseCache
        ? await this.prisma.videoScene.findFirst({
            where: { tenantId, cacheKey, status: 'DONE', clipStorageKey: { not: null } },
            select: { clipStorageKey: true },
          })
        : null;
      if (cached?.clipStorageKey) {
        const clipKey = this.key(tenantId, generationId, `clips/scene-${scene.sceneNumber}.mp4`);
        await this.storage.put(
          clipKey,
          await this.storage.getBuffer(cached.clipStorageKey),
          'video/mp4',
        );
        await this.prisma.videoScene.update({
          where: { id: scene.id },
          data: {
            status: 'DONE',
            clipStorageKey: clipKey,
            cacheKey,
            provider: provider.name,
            model: provider.model,
            costMicroUsd: 0,
          },
        });
        return true;
      }

      let estimate: number;
      try {
        estimate = await (provider.estimateCostMicroUsd?.(scene.durationSeconds) ??
          Promise.resolve(scene.durationSeconds * VIDEO_POLICY.i2vMicroUsdPerSecond));
      } catch {
        return this.toPhotoMotion(scene.id, 'no price');
      }
      const decision = await this.spend.reserve({
        tenantId,
        generationId,
        provider: provider.name,
        model: provider.model,
        operation: 'image_to_video',
        units: scene.durationSeconds,
        unitType: 'seconds',
        estimateMicroUsd: estimate,
      });
      if (!decision.ok) return this.toPhotoMotion(scene.id, decision.reason);

      const imageUrl = await this.storage.signedGetUrl(asset.storageKey);
      let out: Awaited<ReturnType<typeof provider.generate>>;
      try {
        out = await provider.generate({
          idempotencyKey: `${generationId}:scene:${scene.sceneNumber}:${provider.model}`,
          imageUrl,
          durationSeconds: scene.durationSeconds,
          prompt: I2V_PROMPT,
        });
      } catch (err) {
        this.logger.warn(
          `Scene ${scene.sceneNumber} submit failed on ${provider.model}: ${errorText(err)}`,
        );
        if (err instanceof ProviderError && !err.retryable) {
          // Rejected outright (4xx): nothing was billed. Try the other model once.
          await this.spend.settle(decision.usageId, { status: 'REFUSED', actualMicroUsd: 0 });
          return this.switchToFallbackOrPhoto(scene.id, provider, fallback);
        }
        // Timeout or 5xx: the job may exist and be billed. Keep the estimate counted and do not
        // submit again anywhere; the photo is shown instead.
        await this.spend.settle(decision.usageId, { status: 'UNKNOWN' });
        return this.toPhotoMotion(scene.id, 'submit outcome unknown');
      }
      await this.spend.settle(decision.usageId, {
        status: 'SUBMITTED',
        externalRequestId: out.externalJobId,
      });
      await this.prisma.videoScene.update({
        where: { id: scene.id },
        data: {
          externalJobId: out.externalJobId,
          provider: provider.name,
          model: provider.model,
          cacheKey,
          costMicroUsd: out.usage.estimatedCostMicroUsd,
        },
      });
      return false;
    }

    let job: Awaited<ReturnType<typeof provider.getJob>>;
    try {
      job = await provider.getJob(scene.externalJobId);
    } catch (err) {
      if (err instanceof ProviderError && err.retryable) return false;
      this.logger.warn(`Scene ${scene.sceneNumber} poll failed: ${errorText(err)}`);
      return this.switchToFallbackOrPhoto(scene.id, provider, fallback);
    }
    if (job.status === 'RUNNING') return false;

    await this.prisma.providerUsage.updateMany({
      where: { externalRequestId: scene.externalJobId, status: 'SUBMITTED' },
      data: {
        status: job.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
        ...(job.costMicroUsd !== undefined ? { actualCostMicroUsd: job.costMicroUsd } : {}),
      },
    });
    if (job.status === 'FAILED') {
      this.logger.warn(
        `Scene ${scene.sceneNumber} failed on ${provider.model}: ${job.error ?? ''}`,
      );
      return this.switchToFallbackOrPhoto(scene.id, provider, fallback);
    }

    let clipKey: string;
    try {
      const bytes = provider.downloadOutput
        ? await provider.downloadOutput(scene.externalJobId)
        : null;
      clipKey = bytes
        ? await this.putClip(tenantId, generationId, scene.sceneNumber, bytes)
        : await this.storeClip(tenantId, generationId, scene.sceneNumber, job.outputUrl ?? '');
    } catch {
      // Paid for and finished: retry the download, never the generation.
      throw new PipelineError('ASSET_DOWNLOAD_FAILED', true, '');
    }
    await this.prisma.videoScene.update({
      where: { id: scene.id },
      data: {
        status: 'DONE',
        clipStorageKey: clipKey,
        ...(job.costMicroUsd !== undefined ? { costMicroUsd: job.costMicroUsd } : {}),
      },
    });
    return true;
  }

  /** The original mock path: submit, poll once, store whatever the mock returns. */
  private async advanceMockScene(
    tenantId: string,
    generationId: string,
    scene: {
      id: string;
      sceneNumber: number;
      sourceAssetId: string | null;
      durationSeconds: number;
      externalJobId: string | null;
    },
  ): Promise<boolean> {
    let externalJobId = scene.externalJobId;
    try {
      if (!externalJobId) {
        const out = await this.providers.imageToVideo.generate({
          idempotencyKey: `${generationId}:scene:${scene.sceneNumber}`,
          imageUrl: '',
          durationSeconds: scene.durationSeconds,
          prompt: I2V_PROMPT,
        });
        externalJobId = out.externalJobId;
        await this.prisma.videoScene.update({
          where: { id: scene.id },
          data: {
            externalJobId,
            provider: out.usage.provider,
            model: out.usage.model,
            costMicroUsd: out.usage.estimatedCostMicroUsd,
          },
        });
        await this.recordUsage(tenantId, generationId, out.usage, 'SUBMITTED');
      }
      const job = await this.providers.imageToVideo.getJob(externalJobId);
      if (job.status === 'RUNNING') return false;
      if (job.status === 'FAILED')
        throw new ProviderError('PROVIDER_JOB_FAILED', false, job.error ?? 'failed');
      const clipKey = job.outputUrl
        ? await this.storeClip(tenantId, generationId, scene.sceneNumber, job.outputUrl)
        : null;
      await this.prisma.videoScene.update({
        where: { id: scene.id },
        data: { status: 'DONE', clipStorageKey: clipKey },
      });
      return true;
    } catch (err) {
      throw this.providerFailure(err);
    }
  }

  /** One retry on the other model; after that, the photo with the motion template. */
  private async switchToFallbackOrPhoto(
    sceneId: string,
    failed: { model: string },
    fallback: { name: string; model: string } | null,
  ): Promise<boolean> {
    if (fallback && failed.model !== fallback.model) {
      await this.prisma.videoScene.update({
        where: { id: sceneId },
        data: { externalJobId: null, provider: fallback.name, model: fallback.model },
      });
      return false;
    }
    return this.toPhotoMotion(sceneId, 'models failed');
  }

  private async toPhotoMotion(sceneId: string, reason: string): Promise<boolean> {
    this.logger.log(`Scene ${sceneId} uses photo motion (${reason}).`);
    await this.prisma.videoScene.update({
      where: { id: sceneId },
      data: {
        sceneType: 'PHOTO_MOTION',
        status: 'DONE',
        externalJobId: null,
        clipStorageKey: null,
      },
    });
    return true;
  }

  private async putClip(
    tenantId: string,
    generationId: string,
    sceneNumber: number,
    bytes: Buffer,
  ): Promise<string> {
    const key = this.key(tenantId, generationId, `clips/scene-${sceneNumber}.mp4`);
    await this.storage.put(key, bytes, 'video/mp4');
    return key;
  }

  private key(tenantId: string, generationId: string, file: string): string {
    return `generations/${tenantId}/${generationId}/${file}`;
  }

  /** Downloads a provider clip with a size cap and stores it. Failures are asset errors, not provider errors. */
  private async storeClip(
    tenantId: string,
    generationId: string,
    sceneNumber: number,
    url: string,
  ): Promise<string> {
    const MAX_BYTES = 50 * 1024 * 1024;
    let bytes: Buffer;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > MAX_BYTES) throw new Error('too large');
      bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error('bad size');
    } catch {
      throw new PipelineError('ASSET_DOWNLOAD_FAILED', true, '');
    }
    const key = this.key(tenantId, generationId, `clips/scene-${sceneNumber}.mp4`);
    await this.storage.put(key, bytes, 'video/mp4');
    return key;
  }

  private async photoIds(tenantId: string, propertyId: string): Promise<string[]> {
    const rows = await this.prisma.propertyAsset.findMany({
      where: { propertyId, tenantId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async mergeManifest(generationId: string, patch: Record<string, unknown>): Promise<void> {
    const gen = await this.prisma.videoGeneration.findUniqueOrThrow({
      where: { id: generationId },
    });
    const current = (gen.manifestJson ?? {}) as Record<string, unknown>;
    await this.prisma.videoGeneration.update({
      where: { id: generationId },
      data: { manifestJson: { ...current, ...patch } as Prisma.InputJsonValue },
    });
  }

  private async recordUsage(
    tenantId: string,
    generationId: string,
    usage: {
      provider: string;
      model: string;
      operation: string;
      externalRequestId: string | null;
      units: number;
      unitType: string;
      estimatedCostMicroUsd: number;
      isMock: boolean;
    },
    status: string,
  ): Promise<void> {
    await this.prisma.providerUsage.create({
      data: {
        tenantId,
        videoGenerationId: generationId,
        provider: usage.provider,
        model: usage.model,
        operation: usage.operation,
        externalRequestId: usage.externalRequestId,
        units: usage.units,
        unitType: usage.unitType,
        estimatedCostMicroUsd: usage.estimatedCostMicroUsd,
        status,
        isMock: usage.isMock,
      },
    });
  }

  /** Maps provider and internal errors onto the pipeline taxonomy. */
  private providerFailure(err: unknown): PipelineError {
    if (err instanceof PipelineError) return err;
    if (err instanceof ProviderError) {
      return new PipelineError(err.code, err.retryable, '');
    }
    return new PipelineError('INTERNAL_ERROR', false, '');
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown';
}
