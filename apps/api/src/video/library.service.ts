import type { VideoLibraryItem, VideoLibraryQuery, VideoLibraryResponse } from '@app/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { StorageService } from '../infra/storage.service';

const startOfDay = (d: string) => new Date(`${d}T00:00:00.000Z`);
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999Z`);

/** The workspace's finished videos, filtered and paged, with signed play and download links. */
@Injectable()
export class VideoLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(tenantId: string, query: VideoLibraryQuery): Promise<VideoLibraryResponse> {
    const where: Prisma.VideoGenerationWhereInput = {
      tenantId,
      stage: 'COMPLETED',
      outputs: { some: query.format ? { format: query.format } : {} },
    };
    if (query.from || query.to) {
      where.completedAt = {
        ...(query.from ? { gte: startOfDay(query.from) } : {}),
        ...(query.to ? { lte: endOfDay(query.to) } : {}),
      };
    }
    const project: Prisma.VideoProjectWhereInput = {};
    if (query.propertyId) project.propertyId = query.propertyId;
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      project.OR = [{ title: contains }, { property: { title: contains } }];
    }
    where.videoProject = project;

    const [total, rows, storage] = await Promise.all([
      this.prisma.videoGeneration.count({ where }),
      this.prisma.videoGeneration.findMany({
        where,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          outputs: { orderBy: { format: 'asc' } },
          videoProject: {
            select: {
              propertyId: true,
              property: { select: { title: true, folderCoverStorageKey: true } },
            },
          },
          scenes: { where: { sceneNumber: 1 }, select: { sourceAssetId: true } },
        },
      }),
      this.prisma.videoOutput.aggregate({ where: { tenantId }, _sum: { fileSize: true } }),
    ]);

    const assetIds = rows.map((r) => r.scenes[0]?.sourceAssetId).filter((a): a is string => !!a);
    const assets = await this.prisma.propertyAsset.findMany({
      where: { id: { in: assetIds }, tenantId },
      select: { id: true, storageKey: true, previewStorageKey: true },
    });
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const items: VideoLibraryItem[] = await Promise.all(
      rows.map(async (g) => {
        const thumb = g.scenes[0]?.sourceAssetId
          ? assetById.get(g.scenes[0].sourceAssetId)
          : undefined;
        return {
          generationId: g.id,
          projectId: g.videoProjectId,
          propertyId: g.videoProject.propertyId,
          propertyTitle: g.videoProject.property.title,
          generationNumber: g.generationNumber,
          completedAt: g.completedAt?.toISOString() ?? null,
          durationSeconds: g.durationSeconds,
          thumbnailUrl: thumb
            ? await this.storage.signedGetUrl(thumb.previewStorageKey ?? thumb.storageKey)
            : null,
          folderCoverUrl: g.videoProject.property.folderCoverStorageKey
            ? await this.storage.signedGetUrl(g.videoProject.property.folderCoverStorageKey)
            : null,
          isMock: g.isMock,
          formats: await Promise.all(
            g.outputs.map(async (o) => ({
              format: o.format as VideoLibraryItem['formats'][number]['format'],
              width: o.width,
              height: o.height,
              durationSeconds: o.durationSeconds,
              fileSize: o.fileSize,
              playUrl: await this.storage.signedGetUrl(o.storageKey),
              downloadUrl: await this.storage.signedGetUrl(o.storageKey, {
                fileName: `${g.videoProject.property.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60)}-${o.format === 'PORTRAIT_9_16' ? 'dikey' : 'yatay'}.mp4`,
              }),
            })),
          ),
        };
      }),
    );

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      storageBytes: storage._sum.fileSize ?? 0,
    };
  }
}
