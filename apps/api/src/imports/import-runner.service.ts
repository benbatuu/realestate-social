import { importMappingSchema } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../infra/prisma.service';
import { StorageService } from '../infra/storage.service';
import { applyRow } from '../properties/property-writer';
import { readTabularFile } from './parsing/file-reader';
import { parseRows } from './parsing/rows';

const CHUNK_SIZE = 200;
/** Above the configured row limit on purpose: the file was already accepted at upload. */
const RUNNER_MAX_ROWS = 1_000_000;

/**
 * Applies a queued file import in chunks. Each chunk commits its rows, row errors and progress
 * counters in one transaction, so a retried job resumes after the last committed chunk and
 * counts stay exact.
 */
@Injectable()
export class ImportRunnerService {
  private readonly logger = new Logger(ImportRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(syncRunId: string, tenantId: string): Promise<void> {
    const run = await this.prisma.syncRun.findFirst({ where: { id: syncRunId, tenantId } });
    if (!run || !['QUEUED', 'RUNNING'].includes(run.status)) return;
    if (!run.fileStorageKey) throw new Error('Import file is missing');

    await this.prisma.syncRun.update({
      where: { id: run.id },
      data: { status: 'RUNNING', startedAt: run.startedAt ?? new Date() },
    });

    const mapping = importMappingSchema.parse(run.mappingJson);
    const buffer = await this.storage.getBuffer(run.fileStorageKey);
    const file = await readTabularFile(
      buffer,
      run.fileFormat === 'XLSX' ? 'source.xlsx' : 'source.csv',
      RUNNER_MAX_ROWS,
    );
    const rows = parseRows(file, mapping);
    const ctx = {
      tenantId,
      crmConnectionId: run.crmConnectionId,
      syncRunId: run.id,
      now: new Date(),
    };

    for (let offset = run.processedRows; offset < rows.length; offset += CHUNK_SIZE) {
      const chunk = rows.slice(offset, offset + CHUNK_SIZE);
      await this.prisma.$transaction(
        async (tx) => {
          const counts = { create: 0, update: 0, unchanged: 0, failed: 0 };
          const errors = [];
          for (const row of chunk) {
            if (!row.data) {
              counts.failed++;
              errors.push(...row.errors);
              continue;
            }
            counts[await applyRow(tx, ctx, row.data)]++;
          }
          if (errors.length > 0) {
            await tx.syncRunRowError.createMany({
              data: errors.map((e) => ({
                tenantId,
                syncRunId: run.id,
                rowNumber: e.rowNumber,
                field: e.field,
                message: e.message,
              })),
            });
          }
          await tx.syncRun.update({
            where: { id: run.id },
            data: {
              processedRows: offset + chunk.length,
              recordsCreated: { increment: counts.create },
              recordsUpdated: { increment: counts.update },
              recordsUnchanged: { increment: counts.unchanged },
              recordsFailed: { increment: counts.failed },
            },
          });
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    }

    const finished = await this.prisma.$transaction(async (tx) => {
      const done = await tx.syncRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', finishedAt: new Date() },
      });
      if (run.createdByUserId) {
        await this.notifications.create(tx, {
          tenantId,
          userId: run.createdByUserId,
          kind: 'import.completed',
          title: 'İçe aktarma tamamlandı',
          body: run.fileName ?? null,
          link: '/properties/imports',
        });
      }
      await tx.crmConnection.update({
        where: { id: run.crmConnectionId },
        data: { lastSyncAt: done.finishedAt },
      });
      await this.audit.record(tx, {
        action: 'import.completed',
        tenantId,
        actorUserId: run.createdByUserId ?? undefined,
        targetType: 'sync_run',
        targetId: run.id,
        metadata: {
          created: done.recordsCreated,
          updated: done.recordsUpdated,
          unchanged: done.recordsUnchanged,
          failed: done.recordsFailed,
        },
      });
      return done;
    });
    await this.discardFile(finished.id, run.fileStorageKey);
    this.logger.log({ syncRunId: run.id, rows: rows.length }, 'file import completed');
  }

  /** Final failure: record a safe summary and drop the uploaded file. */
  async markFailed(syncRunId: string, tenantId: string, err: unknown): Promise<void> {
    const run = await this.prisma.syncRun.findFirst({ where: { id: syncRunId, tenantId } });
    if (!run || run.status === 'COMPLETED') return;
    await this.prisma.$transaction(async (tx) => {
      if (run.createdByUserId) {
        await this.notifications.create(tx, {
          tenantId,
          userId: run.createdByUserId,
          kind: 'import.failed',
          title: 'İçe aktarma başarısız oldu',
          body: run.fileName ?? null,
          link: '/properties/imports',
        });
      }
      await tx.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorSummary: err instanceof Error ? err.name : 'UnknownError',
        },
      });
      await this.audit.record(tx, {
        action: 'import.failed',
        tenantId,
        actorUserId: run.createdByUserId ?? undefined,
        targetType: 'sync_run',
        targetId: run.id,
      });
    });
    if (run.fileStorageKey) await this.discardFile(run.id, run.fileStorageKey);
  }

  /**
   * Deletes uploaded files that are no longer needed: finished runs, and uploads never
   * committed before their expiry. The source file can hold personal data in unmapped columns.
   */
  async expireAndCleanUp(now = new Date()): Promise<number> {
    const stale = await this.prisma.syncRun.findMany({
      where: {
        fileStorageKey: { not: null },
        OR: [
          { status: { in: ['COMPLETED', 'FAILED', 'EXPIRED'] } },
          { status: 'UPLOADED', expiresAt: { lt: now } },
        ],
      },
      select: { id: true, status: true, fileStorageKey: true },
      take: 500,
    });
    for (const run of stale) {
      if (run.status === 'UPLOADED') {
        await this.prisma.syncRun.updateMany({
          where: { id: run.id, status: 'UPLOADED' },
          data: { status: 'EXPIRED', finishedAt: now },
        });
      }
      if (run.fileStorageKey) await this.discardFile(run.id, run.fileStorageKey);
    }
    return stale.length;
  }

  private async discardFile(syncRunId: string, key: string): Promise<void> {
    try {
      await this.storage.delete([key]);
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: { fileStorageKey: null },
      });
    } catch (err) {
      // Left for the hourly clean-up job.
      this.logger.warn(
        { syncRunId, err: err instanceof Error ? err.name : 'unknown' },
        'import file cleanup failed',
      );
    }
  }
}
