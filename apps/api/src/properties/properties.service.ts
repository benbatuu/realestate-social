import { randomUUID } from 'node:crypto';
import type {
  AssetUploadResponse,
  PhotoOrderRequest,
  PropertyUpdate,
  Currency,
  PropertyDetail,
  PropertyListItem,
  PropertyListQuery,
  PropertyListResponse,
} from '@app/shared';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/http/app-error';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { StorageService } from '../infra/storage.service';
import { computeCoverage } from './coverage';
import sharp from 'sharp';
import { checkPhoto } from './photos';
import { recomputeCoverage } from './property-writer';

/** Maps the API's number/null fields onto Prisma's column types. */
function toColumns(input: PropertyUpdate): Prisma.PropertyUncheckedUpdateInput {
  const { priceMinor, ...rest } = input;
  const out: Record<string, unknown> = { ...rest };
  if (priceMinor !== undefined) out['priceMinor'] = priceMinor === null ? null : BigInt(priceMinor);
  return out as Prisma.PropertyUncheckedUpdateInput;
}

const listInclude = {
  _count: { select: { assets: true } },
  assets: {
    orderBy: { sortOrder: 'asc' },
    take: 1,
    select: { previewStorageKey: true, storageKey: true },
  },
} satisfies Prisma.PropertyInclude;

type ListRow = Prisma.PropertyGetPayload<{ include: typeof listInclude }>;

const num = (d: Prisma.Decimal | null): number | null => (d === null ? null : d.toNumber());

function orderBy(sort: PropertyListQuery['sort']): Prisma.PropertyOrderByWithRelationInput[] {
  switch (sort) {
    case 'coverage_asc':
      return [{ dataCoverageScore: 'asc' }, { updatedAt: 'desc' }];
    case 'coverage_desc':
      return [{ dataCoverageScore: 'desc' }, { updatedAt: 'desc' }];
    case 'price_desc':
      return [{ priceMinor: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }];
    case 'price_asc':
      return [{ priceMinor: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }];
    default:
      return [{ updatedAt: 'desc' }, { id: 'desc' }];
  }
}

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async toListItem(p: ListRow): Promise<PropertyListItem> {
    const cover = p.assets[0];
    return {
      id: p.id,
      externalId: p.externalId,
      title: p.title,
      listingType: p.listingType,
      propertyType: p.propertyType,
      status: p.status,
      // BigInt does not JSON-serialise; realistic prices are far below 2^53 minor units.
      priceMinor: p.priceMinor === null ? null : Number(p.priceMinor),
      priceCurrency: p.priceCurrency as Currency | null,
      roomLayout: p.roomLayout,
      grossAreaM2: num(p.grossAreaM2),
      city: p.city,
      district: p.district,
      neighborhood: p.neighborhood,
      coverageScore: p.dataCoverageScore,
      photoCount: p._count.assets,
      coverThumbnailUrl: cover
        ? await this.storage.signedGetUrl(cover.previewStorageKey ?? cover.storageKey)
        : null,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async list(tenantId: string, query: PropertyListQuery): Promise<PropertyListResponse> {
    const where: Prisma.PropertyWhereInput = { tenantId };
    if (query.listingType) where.listingType = query.listingType;
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      where.OR = [
        { title: contains },
        { externalId: contains },
        { city: contains },
        { district: contains },
        { neighborhood: contains },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        include: listInclude,
        orderBy: orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: await Promise.all(rows.map((r) => this.toListItem(r))),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Every lookup filters by tenant as well as ID (tenant-scoped header routes, ADR 0007). */
  private async findOwned(tenantId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, tenantId },
      include: {
        ...listInclude,
        assets: { orderBy: { sortOrder: 'asc' } },
        crmConnection: { select: { name: true } },
      },
    });
    if (!property) throw AppError.notFound('Property not found');
    return property;
  }

  async detail(tenantId: string, id: string): Promise<PropertyDetail> {
    const p = await this.findOwned(tenantId, id);
    const base = await this.toListItem({ ...p, assets: p.assets.slice(0, 1) });
    const assets = await Promise.all(
      p.assets.map(async (a) => ({
        id: a.id,
        width: a.width,
        height: a.height,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        sortOrder: a.sortOrder,
        url: await this.storage.signedGetUrl(a.storageKey),
        thumbnailUrl: await this.storage.signedGetUrl(a.previewStorageKey ?? a.storageKey),
        createdAt: a.createdAt.toISOString(),
      })),
    );
    return {
      ...base,
      description: p.description,
      netAreaM2: num(p.netAreaM2),
      bedroomCount: p.bedroomCount,
      bathroomCount: p.bathroomCount,
      floor: p.floor,
      totalFloors: p.totalFloors,
      buildingAge: p.buildingAge,
      heatingType: p.heatingType,
      furnished: p.furnished,
      inComplex: p.inComplex,
      listedAt: p.listedAt?.toISOString() ?? null,
      coverage: computeCoverage({ ...p, photoCount: p.assets.length }),
      assets,
      source: {
        name: p.crmConnection?.name ?? null,
        lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
        lastImportId: p.lastSyncRunId,
      },
      createdAt: p.createdAt.toISOString(),
    };
  }

  /**
   * Partial update by hand. Every edited field is recorded in `manualFields`, so a later
   * import keeps the user's value. Audit stores field names only, never values.
   */
  async update(
    tenantId: string,
    userId: string,
    propertyId: string,
    input: PropertyUpdate,
    requestId: string | undefined,
  ): Promise<PropertyDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.property.findFirst({ where: { id: propertyId, tenantId } });
      if (!current) throw AppError.notFound('Property not found');
      const fields = Object.keys(input);
      const manualFields = Array.from(new Set([...current.manualFields, ...fields]));
      await tx.property.update({
        where: { id: current.id },
        data: { ...toColumns(input), manualFields },
      });
      await recomputeCoverage(tx, current.id);
      await this.audit.record(tx, {
        action: 'property.updated',
        tenantId,
        actorUserId: userId,
        targetType: 'property',
        targetId: propertyId,
        metadata: { fields: fields.join(',') },
        requestId,
      });
    });
    return this.detail(tenantId, propertyId);
  }

  async addPhotos(
    tenantId: string,
    userId: string,
    propertyId: string,
    files: Express.Multer.File[],
    requestId: string | undefined,
  ): Promise<AssetUploadResponse> {
    if (files.length === 0) throw new AppError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'No files');
    await this.findOwned(tenantId, propertyId);
    const maxBytes = this.config.PHOTO_MAX_FILE_MB * 1024 * 1024;
    const results: AssetUploadResponse['results'] = [];

    for (const file of files) {
      const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200);
      const reject = (reason: string) =>
        results.push({ fileName, outcome: 'rejected', reason, assetId: null });
      if (file.size > maxBytes) {
        reject(`Dosya ${this.config.PHOTO_MAX_FILE_MB} MB sınırını aşıyor.`);
        continue;
      }
      const check = await checkPhoto(file.buffer);
      if (!check.ok) {
        reject(check.reason);
        continue;
      }
      const duplicate = await this.prisma.propertyAsset.findUnique({
        where: { propertyId_checksum: { propertyId, checksum: check.checksum } },
        select: { id: true },
      });
      if (duplicate) {
        results.push({
          fileName,
          outcome: 'duplicate',
          reason: 'Bu fotoğraf zaten ekli.',
          assetId: duplicate.id,
        });
        continue;
      }

      // Objects first, then the row: a failed insert leaves no row pointing at nothing, and
      // its objects are deleted right away.
      const assetId = randomUUID();
      const prefix = `${tenantId}/${propertyId}/photos/${assetId}`;
      const storageKey = `raw/${prefix}.${check.ext}`;
      const previewStorageKey = `normalized/${prefix}-640.webp`;
      await this.storage.put(storageKey, file.buffer, check.mimeType);
      await this.storage.put(previewStorageKey, check.thumbnail, 'image/webp');
      try {
        await this.prisma.$transaction(async (tx) => {
          // Serialise uploads per property so the photo limit and sort order hold.
          await tx.$queryRaw`SELECT id FROM properties WHERE id = ${propertyId}::uuid FOR UPDATE`;
          const count = await tx.propertyAsset.count({ where: { propertyId } });
          if (count >= this.config.PHOTO_MAX_PER_PROPERTY) {
            throw new AppError(HttpStatus.CONFLICT, 'PHOTO_LIMIT_REACHED', 'Photo limit reached');
          }
          const last = await tx.propertyAsset.aggregate({
            where: { propertyId },
            _max: { sortOrder: true },
          });
          await tx.propertyAsset.create({
            data: {
              id: assetId,
              tenantId,
              propertyId,
              storageKey,
              previewStorageKey,
              mimeType: check.mimeType,
              width: check.width,
              height: check.height,
              fileSize: file.size,
              checksum: check.checksum,
              sortOrder: (last._max.sortOrder ?? -1) + 1,
              sourceType: 'UPLOAD',
              uploadedByUserId: userId,
            },
          });
          await recomputeCoverage(tx, propertyId);
          await this.audit.record(tx, {
            action: 'property.photo_added',
            tenantId,
            actorUserId: userId,
            targetType: 'property_asset',
            targetId: assetId,
            metadata: { propertyId },
            requestId,
          });
        });
        results.push({ fileName, outcome: 'created', reason: null, assetId });
      } catch (err) {
        await this.storage.delete([storageKey, previewStorageKey]).catch(() => undefined);
        if (err instanceof AppError && err.code === 'PHOTO_LIMIT_REACHED') {
          reject(`Bir mülke en fazla ${this.config.PHOTO_MAX_PER_PROPERTY} fotoğraf eklenebilir.`);
          continue;
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          results.push({
            fileName,
            outcome: 'duplicate',
            reason: 'Bu fotoğraf zaten ekli.',
            assetId: null,
          });
          continue;
        }
        throw err;
      }
    }
    return { results };
  }

  /** Custom cover for the property's video folder: 640x480 WebP. Replaces the earlier one. */
  async setFolderCover(tenantId: string, id: string, source: Buffer): Promise<PropertyDetail> {
    const property = await this.findOwned(tenantId, id);
    const out = await toFolderCover(source);
    const key = `folder-covers/${tenantId}/${id}/${Date.now()}.webp`;
    await this.storage.put(key, out, 'image/webp');
    await this.prisma.property.update({ where: { id }, data: { folderCoverStorageKey: key } });
    if (property.folderCoverStorageKey) {
      await this.storage.delete([property.folderCoverStorageKey]).catch(() => undefined);
    }
    return this.detail(tenantId, id);
  }

  /** Uses one of the property's own photos as the folder cover (copied, so a photo delete is safe). */
  async pickFolderCoverFromPhoto(
    tenantId: string,
    id: string,
    assetId: string,
  ): Promise<PropertyDetail> {
    await this.findOwned(tenantId, id);
    const asset = await this.prisma.propertyAsset.findFirst({
      where: { id: assetId, tenantId, propertyId: id },
      select: { storageKey: true, previewStorageKey: true },
    });
    if (!asset) throw AppError.notFound('Photo not found');
    const source = await this.storage.getBuffer(asset.previewStorageKey ?? asset.storageKey);
    return this.setFolderCover(tenantId, id, source);
  }

  /** Back to the default: the first photo. */
  async resetFolderCover(tenantId: string, id: string): Promise<PropertyDetail> {
    const property = await this.findOwned(tenantId, id);
    if (property.folderCoverStorageKey) {
      await this.prisma.property.update({ where: { id }, data: { folderCoverStorageKey: null } });
      await this.storage.delete([property.folderCoverStorageKey]).catch(() => undefined);
    }
    return this.detail(tenantId, id);
  }

  async deletePhoto(
    tenantId: string,
    userId: string,
    propertyId: string,
    assetId: string,
    requestId: string | undefined,
  ): Promise<void> {
    // Row first, then objects: a failed object delete leaves an orphan file, never a broken row.
    const asset = await this.prisma.$transaction(async (tx) => {
      const found = await tx.propertyAsset.findFirst({
        where: { id: assetId, propertyId, tenantId },
      });
      if (!found) throw AppError.notFound('Photo not found');
      await tx.propertyAsset.delete({ where: { id: found.id } });
      await recomputeCoverage(tx, propertyId);
      await this.audit.record(tx, {
        action: 'property.photo_deleted',
        tenantId,
        actorUserId: userId,
        targetType: 'property_asset',
        targetId: assetId,
        metadata: { propertyId },
        requestId,
      });
      return found;
    });
    const keys = [asset.storageKey, asset.previewStorageKey].filter((k): k is string => !!k);
    await this.storage.delete(keys).catch((err: unknown) => {
      this.logger.warn(
        { assetId, err: err instanceof Error ? err.name : 'unknown' },
        'photo object delete failed',
      );
    });
  }

  /** Sets the photo order. The list must contain exactly this property's photos. */
  async reorderPhotos(
    tenantId: string,
    userId: string,
    propertyId: string,
    input: PhotoOrderRequest,
    requestId: string | undefined,
  ): Promise<void> {
    await this.findOwned(tenantId, propertyId);
    const current = await this.prisma.propertyAsset.findMany({
      where: { propertyId, tenantId },
      select: { id: true },
    });
    const ids = new Set(current.map((a) => a.id));
    if (
      input.assetIds.length !== ids.size ||
      new Set(input.assetIds).size !== input.assetIds.length
    ) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Order must list every photo once',
      );
    }
    if (!input.assetIds.every((id) => ids.has(id))) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Order contains an unknown photo',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      for (const [index, id] of input.assetIds.entries()) {
        await tx.propertyAsset.update({ where: { id }, data: { sortOrder: index } });
      }
      await this.audit.record(tx, {
        action: 'property.photos_reordered',
        tenantId,
        actorUserId: userId,
        targetType: 'property',
        targetId: propertyId,
        metadata: { count: input.assetIds.length },
        requestId,
      });
    });
  }

  /**
   * All of the workspace's properties as CSV (Turkish headers, semicolon, UTF-8 with BOM).
   * Formula-looking cells are neutralised, as in the import error report.
   */
  async exportCsv(
    tenantId: string,
    userId: string,
    requestId: string | undefined,
  ): Promise<string> {
    const rows = await this.prisma.property.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 20_000,
      include: { _count: { select: { assets: true } } },
    });
    const header = [
      'İlan No',
      'Başlık',
      'İlan Türü',
      'Durum',
      'Emlak Tipi',
      'Fiyat',
      'Para Birimi',
      'Brüt m²',
      'Net m²',
      'Oda Sayısı',
      'Kat',
      'Bina Yaşı',
      'Isıtma',
      'İl',
      'İlçe',
      'Mahalle',
      'Foto Sayısı',
      'Veri Doluluğu',
      'Son Güncelleme',
    ];
    const lines = [header.join(';')];
    for (const p of rows) {
      const cells = [
        p.externalId ?? '',
        p.title,
        p.listingType === 'SALE' ? 'Satılık' : 'Kiralık',
        p.status,
        p.propertyType ?? '',
        p.priceMinor === null ? '' : (Number(p.priceMinor) / 100).toFixed(2).replace('.', ','),
        p.priceCurrency ?? '',
        p.grossAreaM2?.toString().replace('.', ',') ?? '',
        p.netAreaM2?.toString().replace('.', ',') ?? '',
        p.roomLayout ?? '',
        p.floor ?? '',
        p.buildingAge?.toString() ?? '',
        p.heatingType ?? '',
        p.city ?? '',
        p.district ?? '',
        p.neighborhood ?? '',
        String(p._count.assets),
        String(p.dataCoverageScore),
        p.updatedAt.toISOString().slice(0, 10),
      ];
      lines.push(cells.map(csvCell).join(';'));
    }
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(tx, {
        action: 'property.exported',
        tenantId,
        actorUserId: userId,
        targetType: 'property',
        metadata: { count: rows.length },
        requestId,
      });
    });
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }
}

/** Quotes a cell when needed and neutralises spreadsheet formulas (=, +, -, @). */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Validates by content, crops to a 640x480 WebP cover. */
async function toFolderCover(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer, { limitInputPixels: 50_000_000 }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '')) {
      throw new AppError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_UNSUPPORTED',
        'Yalnızca JPEG, PNG veya WebP yüklenebilir.',
      );
    }
    return await sharp(buffer, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(640, 480, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'FILE_UNSUPPORTED', 'Görsel okunamadı.');
  }
}
