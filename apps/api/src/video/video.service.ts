import type { VideoGeneration, VideoGenerationEvent, VideoOutput, VideoProject } from '@app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/http/app-error';
import { AuditService } from '../audit/audit.service';
import { CreditsService } from '../credits/credits.service';
import { PrismaService } from '../infra/prisma.service';
import { StorageService } from '../infra/storage.service';
import { durationForPhotoCount } from './policy';
import { PipelineRunner } from './pipeline.runner';

import type { VideoGeneration as GenModel } from '../generated/prisma/client';

const toGeneration = (g: GenModel): VideoGeneration => ({
  id: g.id,
  videoProjectId: g.videoProjectId,
  generationNumber: g.generationNumber,
  status: g.status,
  billingType: g.billingType,
  stage: g.stage,
  progress: g.progress,
  durationSeconds: g.durationSeconds,
  failureCode: (g.failureCode as VideoGeneration['failureCode']) ?? null,
  failureMessage: g.failureMessage,
  isMock: g.isMock,
  createdAt: g.createdAt.toISOString(),
  completedAt: g.completedAt?.toISOString() ?? null,
});

const idempotencyKeyOrThrow = (key: string | undefined): string => {
  if (!key || key.length < 8 || key.length > 128) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key header is required (8–128 characters)',
    );
  }
  return key;
};

/** API side of video generation: starts runs and reads state. The worker does the work. */
@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly runner: PipelineRunner,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async createProject(
    tenantId: string,
    userId: string,
    propertyId: string,
    idempotencyKey: string | undefined,
  ): Promise<VideoProject> {
    const key = idempotencyKeyOrThrow(idempotencyKey);
    const photos = await this.photoCount(tenantId, propertyId);
    const duration = durationForPhotoCount(photos);
    const gen = await this.credits.reserveNewProject(tenantId, userId, propertyId, key, duration);
    await this.runner.enqueue(tenantId, gen.id, 'VALIDATING');
    await this.recordStart(tenantId, userId, propertyId, gen.id, gen.billingType);
    return this.project(tenantId, gen.videoProjectId);
  }

  async createRegeneration(
    tenantId: string,
    userId: string,
    projectId: string,
    idempotencyKey: string | undefined,
  ): Promise<VideoGeneration> {
    const key = idempotencyKeyOrThrow(idempotencyKey);
    const project = await this.prisma.videoProject.findFirst({
      where: { id: projectId, tenantId },
      select: { propertyId: true },
    });
    if (!project) throw AppError.notFound('Project not found');
    const photos = await this.photoCount(tenantId, project.propertyId);
    const gen = await this.credits.reserveRegeneration(
      tenantId,
      userId,
      projectId,
      key,
      durationForPhotoCount(photos),
    );
    await this.runner.enqueue(tenantId, gen.id, 'VALIDATING');
    await this.recordStart(tenantId, userId, project.propertyId, gen.id, gen.billingType);
    return this.generation(tenantId, gen.id);
  }

  /** Activity entry: which property, how it was paid, and what is left after it. */
  private async recordStart(
    tenantId: string,
    userId: string,
    propertyId: string,
    generationId: string,
    billingType: string,
  ): Promise<void> {
    const left = await this.credits.balance(tenantId);
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        action: 'video.generation_started',
        tenantId,
        actorUserId: userId,
        targetType: 'video_generation',
        targetId: generationId,
        metadata: {
          propertyId,
          billingType,
          creditsLeft: left.credits.available,
          freeLeft: left.freeRegenerations.available,
        },
      }),
    );
  }

  async project(tenantId: string, id: string): Promise<VideoProject> {
    const p = await this.prisma.videoProject.findFirst({
      where: { id, tenantId },
      include: { generations: { orderBy: { generationNumber: 'asc' } } },
    });
    if (!p) throw AppError.notFound('Project not found');
    return {
      id: p.id,
      propertyId: p.propertyId,
      title: p.title,
      freeRegenerationUsed: p.freeRegenerationUsed,
      generationCount: p.generationCount,
      createdAt: p.createdAt.toISOString(),
      generations: p.generations.map(toGeneration),
    };
  }

  async generation(tenantId: string, id: string): Promise<VideoGeneration> {
    const g = await this.prisma.videoGeneration.findFirst({ where: { id, tenantId } });
    if (!g) throw AppError.notFound('Generation not found');
    return toGeneration(g);
  }

  /** Snapshot for the SSE stream. `terminal` tells the stream when to close. */
  async event(tenantId: string, id: string): Promise<VideoGenerationEvent> {
    const g = await this.generation(tenantId, id);
    return {
      id: g.id,
      stage: g.stage,
      progress: g.progress,
      status: g.status,
      failureCode: g.failureCode,
      failureMessage: g.failureMessage,
      terminal: g.stage === 'COMPLETED' || g.stage === 'FAILED',
    };
  }

  /** Most recent generation for a property (any stage). Null when none exists. */
  async latestForProperty(tenantId: string, propertyId: string): Promise<VideoGeneration | null> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });
    if (!property) throw AppError.notFound('Property not found');
    const gen = await this.prisma.videoGeneration.findFirst({
      where: { tenantId, videoProject: { propertyId } },
      orderBy: { createdAt: 'desc' },
    });
    return gen ? toGeneration(gen) : null;
  }

  /** Finished files for a completed generation, with short-lived download links. */
  async outputs(tenantId: string, id: string): Promise<VideoOutput[]> {
    const gen = await this.prisma.videoGeneration.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!gen) throw AppError.notFound('Generation not found');
    const rows = await this.prisma.videoOutput.findMany({
      where: { videoGenerationId: id, tenantId },
      orderBy: { format: 'asc' },
    });
    return Promise.all(
      rows.map(async (r) => ({
        format: r.format as VideoOutput['format'],
        mimeType: r.mimeType,
        fileSize: r.fileSize,
        durationSeconds: r.durationSeconds,
        width: r.width,
        height: r.height,
        checksum: r.checksum,
        downloadUrl: await this.storage.signedGetUrl(r.storageKey),
        isMock: true,
      })),
    );
  }

  private async photoCount(tenantId: string, propertyId: string): Promise<number> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });
    if (!property) throw AppError.notFound('Property not found');
    const count = await this.prisma.propertyAsset.count({ where: { propertyId, tenantId } });
    if (count === 0) {
      throw new AppError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'NO_PHOTOS',
        'Add at least one photo before generating a video',
      );
    }
    return count;
  }
}
