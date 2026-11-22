import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppError } from '../../common/http/app-error';
import { decryptSecret, encryptSecret } from '../../common/secret-cipher';
import { PrismaService } from '../../infra/prisma.service';
import {
  CRM_SYNC_JOBS,
  QUEUES,
  type LeadPilotPushJob,
  type LeadPilotSyncJob,
} from '../../queues/queues';
import {
  assertBaseUrl,
  fetchFeedPage,
  LeadPilotConnectionInfo,
  LeadPilotError,
  pushLead,
  type FeedProperty,
} from './leadpilot.client';
import { mapFeedProperty, withoutManualFields } from './leadpilot.mapping';
import { recomputeCoverage } from '../../properties/property-writer';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { checkPhoto } from '../../properties/photos';
import { StorageService } from '../../infra/storage.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { randomUUID } from 'node:crypto';
import { downloadPhoto } from './leadpilot.client';

const MAX_PAGES_PER_RUN = 50;

type StoredLeadPilot = LeadPilotConnectionInfo;

export type SyncRunView = {
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  stage: string | null;
  totalRows: number;
  processedRows: number;
  recordsCreated: number;
  recordsUpdated: number;
  photosAdded: number;
  photosSkipped: number;
  errorSummary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

function toRunView(r: {
  status: string;
  stage: string | null;
  totalRows: number;
  processedRows: number;
  recordsCreated: number;
  recordsUpdated: number;
  photosAdded: number;
  photosSkipped: number;
  errorSummary: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}): SyncRunView {
  return {
    status: r.status as SyncRunView['status'],
    stage: r.stage,
    totalRows: r.totalRows,
    processedRows: r.processedRows,
    recordsCreated: r.recordsCreated,
    recordsUpdated: r.recordsUpdated,
    photosAdded: r.photosAdded,
    photosSkipped: r.photosSkipped,
    errorSummary: r.errorSummary,
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class LeadPilotService {
  private readonly logger = new Logger(LeadPilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.crmSync) private readonly queue: Queue,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Saves a LeadPilot connection after a live check. The secret is stored encrypted only. */
  async connect(
    tenantId: string,
    input: { name: string; baseUrl: string; connectionId: string; signingSecret: string },
  ) {
    let baseUrl: string;
    try {
      baseUrl = assertBaseUrl(input.baseUrl);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const info: StoredLeadPilot = {
      baseUrl,
      connectionId: input.connectionId.trim(),
      signingSecret: input.signingSecret.trim(),
    };
    let test: { ok: boolean; message: string };
    try {
      await fetchFeedPage(info, { limit: 1 });
      test = { ok: true, message: 'Bağlantı doğrulandı.' };
    } catch (err) {
      test = {
        ok: false,
        message: err instanceof LeadPilotError ? err.message : 'Bağlantı doğrulanamadı.',
      };
    }
    const row = await this.prisma.crmConnection.create({
      data: {
        tenantId,
        provider: 'LEADPILOT',
        name: input.name.trim(),
        status: test.ok ? 'ACTIVE' : 'PENDING',
        encryptedCredentials: encryptSecret(JSON.stringify(info)),
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });
    if (test.ok) await this.enqueueSync(tenantId, row.id);
    return {
      connection: {
        id: row.id,
        provider: row.provider,
        name: row.name,
        status: row.status,
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        lastRun: null,
        lastCheck: { ...test, at: new Date().toISOString() },
        createdAt: row.createdAt.toISOString(),
      },
      test,
    };
  }

  /** Latest sync runs of the workspace's LeadPilot connections, newest first. */
  async latestRuns(tenantId: string, connectionIds: string[]) {
    if (connectionIds.length === 0) return new Map<string, SyncRunView>();
    const runs = await this.prisma.syncRun.findMany({
      where: { tenantId, kind: 'API_SYNC', crmConnectionId: { in: connectionIds } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        crmConnectionId: true,
        status: true,
        stage: true,
        totalRows: true,
        processedRows: true,
        recordsCreated: true,
        recordsUpdated: true,
        photosAdded: true,
        photosSkipped: true,
        errorSummary: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    const out = new Map<string, SyncRunView>();
    for (const r of runs) {
      if (!out.has(r.crmConnectionId)) out.set(r.crmConnectionId, toRunView(r));
    }
    return out;
  }

  /**
   * Pulls properties changed since the last run and records what it does on a sync run, so the
   * screen can show the current step. One run at a time per connection.
   */
  async sync(tenantId: string, connectionId: string): Promise<number> {
    const conn = await this.prisma.crmConnection.findFirst({
      where: { id: connectionId, tenantId, provider: 'LEADPILOT' },
      select: { id: true, status: true, lastSyncAt: true, encryptedCredentials: true },
    });
    if (!conn || conn.status !== 'ACTIVE' || !conn.encryptedCredentials) return 0;
    const running = await this.prisma.syncRun.findFirst({
      where: { crmConnectionId: connectionId, kind: 'API_SYNC', status: 'RUNNING' },
      select: { id: true },
    });
    if (running) return 0;

    const run = await this.prisma.syncRun.create({
      data: {
        tenantId,
        crmConnectionId: connectionId,
        kind: 'API_SYNC',
        status: 'RUNNING',
        stage: 'Bağlantı kontrol ediliyor',
        startedAt: new Date(),
      },
      select: { id: true },
    });
    const progress = (data: Record<string, unknown>) =>
      this.prisma.syncRun.update({ where: { id: run.id }, data });

    try {
      const info = JSON.parse(decryptSecret(conn.encryptedCredentials)) as StoredLeadPilot;
      const startedAt = new Date();
      let since = conn.lastSyncAt?.toISOString() ?? null;
      let total = 0;
      let created = 0;
      let updated = 0;
      let photos = 0;
      let skipped = 0;
      const { maxPhotosPerProperty } = await this.entitlements.limits(tenantId);
      for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
        await progress({ stage: 'Mülkler alınıyor' });
        const result = await fetchFeedPage(info, { updatedSince: since, limit: 200 });
        await progress({ totalRows: { increment: result.items.length } });
        for (const item of result.items) {
          await progress({ stage: `Mülk kaydediliyor: ${item.title}` });
          const existed = await this.prisma.property.findFirst({
            where: { tenantId, crmConnectionId: connectionId, externalId: item.id },
            select: { id: true },
          });
          const propertyId = await this.upsertProperty(tenantId, connectionId, item);
          if (existed) updated++;
          else created++;
          const result = await this.importPhotos(
            tenantId,
            propertyId,
            item,
            maxPhotosPerProperty,
            async (done, of) => {
              await progress({ stage: `Fotoğraflar indiriliyor (${done}/${of}): ${item.title}` });
            },
          );
          photos += result.added;
          skipped += result.skipped;
          total++;
          since = item.updatedAt;
          await progress({
            processedRows: total,
            recordsCreated: created,
            recordsUpdated: updated,
            photosAdded: photos,
            photosSkipped: skipped,
          });
        }
        if (!result.hasMore) break;
      }
      await this.prisma.crmConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: startedAt },
      });
      await progress({ status: 'COMPLETED', stage: 'Tamamlandı', finishedAt: new Date() });
      return total;
    } catch (err) {
      // Our own errors carry a short, safe message; show it so the cause is visible on the card.
      const raw = err instanceof Error ? err.message : String(err);
      const message =
        err instanceof LeadPilotError
          ? err.message
          : `Senkron tamamlanamadı: ${raw.replace(/\s+/g, ' ').slice(-400)}`;
      this.logger.warn({ connectionId, err: String(err) }, 'leadpilot sync failed');
      await progress({
        status: 'FAILED',
        stage: 'Hata',
        errorSummary: message,
        finishedAt: new Date(),
      });
      await this.notifications.notifyTeam(tenantId, {
        kind: 'crm.sync_failed',
        title: 'CRM senkronu başarısız',
        body: message,
        link: '/integrations',
      });
      return 0;
    }
  }

  private async upsertProperty(
    tenantId: string,
    connectionId: string,
    item: FeedProperty,
  ): Promise<string> {
    const mapped = mapFeedProperty(item);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.property.findFirst({
        where: { tenantId, crmConnectionId: connectionId, externalId: item.id },
        select: { id: true, manualFields: true },
      });
      if (existing) {
        const data = withoutManualFields(mapped, existing.manualFields);
        await tx.property.update({
          where: { id: existing.id },
          data: { ...data, lastSyncedAt: new Date(), sourceUpdatedAt: new Date(item.updatedAt) },
        });
        await recomputeCoverage(tx, existing.id);
        return existing.id;
      }
      const created = await tx.property.create({
        data: {
          tenantId,
          crmConnectionId: connectionId,
          externalId: item.id,
          ...mapped,
          lastSyncedAt: new Date(),
          sourceUpdatedAt: new Date(item.updatedAt),
        },
        select: { id: true },
      });
      await recomputeCoverage(tx, created.id);
      return created.id;
    });
  }

  /**
   * Adds the feed's photos we do not have yet. Each one is checked by content, stored like an
   * upload, and remembered by its LeadPilot id so it is never downloaded twice.
   */
  private async importPhotos(
    tenantId: string,
    propertyId: string,
    item: FeedProperty,
    limit: number,
    onProgress: (done: number, of: number) => Promise<void>,
  ): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    let done = 0;
    const existing = await this.prisma.propertyAsset.count({ where: { propertyId } });
    for (const photo of item.photos) {
      done++;
      await onProgress(done, item.photos.length);
      const sourceUrl = `leadpilot:${photo.id}`;
      try {
        const known = await this.prisma.propertyAsset.findFirst({
          where: { propertyId, sourceUrl },
          select: { id: true },
        });
        if (known) continue;
        // The package's photo cap: new photos beyond it are skipped and reported on the run.
        if (existing + added >= limit) {
          skipped++;
          continue;
        }
        const buf = await downloadPhoto(photo.url);
        if (!buf) {
          this.logger.warn({ propertyId, photo: photo.id }, 'leadpilot photo download failed');
          continue;
        }
        const check = await checkPhoto(buf);
        if (!check.ok) {
          this.logger.warn(
            { propertyId, photo: photo.id, reason: check.reason },
            'leadpilot photo rejected',
          );
          continue;
        }
        // Same bytes already on this property (uploaded or imported before): nothing to add.
        const duplicate = await this.prisma.propertyAsset.findFirst({
          where: { propertyId, checksum: check.checksum },
          select: { id: true },
        });
        if (duplicate) continue;

        const assetId = randomUUID();
        const prefix = `${tenantId}/${propertyId}/photos/${assetId}`;
        const storageKey = `raw/${prefix}.${check.ext}`;
        const previewStorageKey = `normalized/${prefix}-640.webp`;
        await this.storage.put(storageKey, buf, check.mimeType);
        await this.storage.put(previewStorageKey, check.thumbnail, 'image/webp');
        await this.prisma.$transaction(async (tx) => {
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
              fileSize: buf.length,
              checksum: check.checksum,
              sortOrder: (last._max.sortOrder ?? -1) + 1,
              sourceType: 'CRM',
              sourceUrl,
            },
          });
          await recomputeCoverage(tx, propertyId);
        });
        added++;
      } catch (err) {
        // One bad photo must not stop the whole property or the sync.
        this.logger.warn(
          { propertyId, photo: photo.id, err: String(err) },
          'leadpilot photo import failed',
        );
      }
    }
    return { added, skipped };
  }

  /** Sends a lead to every active LeadPilot connection of the workspace. */
  async pushLead(tenantId: string, leadId: string): Promise<number> {
    const [lead, connections] = await Promise.all([
      this.prisma.lead.findFirst({
        where: { id: leadId, tenantId },
        select: {
          id: true,
          label: true,
          email: true,
          phone: true,
          propertyId: true,
          property: { select: { title: true, city: true, district: true, propertyType: true } },
          notes: { orderBy: { createdAt: 'asc' }, select: { body: true } },
        },
      }),
      this.prisma.crmConnection.findMany({
        where: { tenantId, provider: 'LEADPILOT', status: 'ACTIVE' },
        select: { encryptedCredentials: true },
      }),
    ]);
    if (!lead) return 0;
    const notes = lead.notes.map((n) => n.body).join('\n');
    const propertyLine = lead.property
      ? `Mülk: ${lead.property.title}${lead.property.district ? ` (${lead.property.district})` : ''}`
      : null;
    const payload = {
      event_id: lead.id,
      lead: {
        name: (lead.label ?? '').trim().length >= 2 ? lead.label : 'Lead',
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        language: 'tr',
        notes: [propertyLine, notes].filter(Boolean).join('\n') || undefined,
        preferredLocation: lead.property
          ? [lead.property.city, lead.property.district].filter(Boolean).join(', ') || undefined
          : undefined,
        propertyType: lead.property?.propertyType ?? undefined,
        projectName: lead.property?.title ?? undefined,
      },
    };
    let sent = 0;
    for (const c of connections) {
      if (!c.encryptedCredentials) continue;
      const info = JSON.parse(decryptSecret(c.encryptedCredentials)) as StoredLeadPilot;
      await pushLead(info, payload);
      sent++;
    }
    return sent;
  }

  /** Queues a sync for every active LeadPilot connection (hourly schedule). */
  async syncAll(): Promise<number> {
    const rows = await this.prisma.crmConnection.findMany({
      where: { provider: 'LEADPILOT', status: 'ACTIVE' },
      select: { id: true, tenantId: true },
    });
    for (const r of rows) await this.enqueueSync(r.tenantId, r.id);
    return rows.length;
  }

  async enqueueSync(tenantId: string, connectionId: string): Promise<void> {
    const job: LeadPilotSyncJob = { tenantId, connectionId };
    await this.queue.add(CRM_SYNC_JOBS.leadpilotSync, job, {
      jobId: `sync-${connectionId}-${Date.now()}`,
    });
  }

  async enqueuePush(tenantId: string, leadId: string): Promise<void> {
    const job: LeadPilotPushJob = { tenantId, leadId };
    await this.queue.add(CRM_SYNC_JOBS.leadpilotPush, job);
  }

  /** Manual "sync now" from the UI; refuses if the connection is not active. */
  async requestSync(tenantId: string, connectionId: string): Promise<void> {
    const conn = await this.prisma.crmConnection.findFirst({
      where: { id: connectionId, tenantId, provider: 'LEADPILOT' },
      select: { status: true },
    });
    if (!conn) throw AppError.notFound('Connection not found');
    if (conn.status !== 'ACTIVE') throw new BadRequestException('Bağlantı etkin değil.');
    await this.enqueueSync(tenantId, connectionId);
  }
}
