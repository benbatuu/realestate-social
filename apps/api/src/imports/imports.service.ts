import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  type ImportMapping,
  type ImportPreview,
  type ImportRowError,
  type ImportSummary,
  type ImportUploadResponse,
} from '@app/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/http/app-error';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { StorageService } from '../infra/storage.service';
import { planRow } from '../properties/property-writer';
import { CRM_SYNC_JOBS, type FileImportCommitJob, QUEUES } from '../queues/queues';
import { ensureFileImportSource } from './import-source';
import { FileReadError, readTabularFile, type TabularFile } from './parsing/file-reader';
import { suggestColumns, suggestNumberFormat, validateMapping } from './parsing/mapping';
import { parseRows } from './parsing/rows';

type SyncRunRow = Prisma.SyncRunGetPayload<{
  include: { createdBy: { select: { id: true; name: true } } };
}>;

const PREVIEW_ERROR_LIMIT = 100;
const PREVIEW_SAMPLE_SIZE = 5;
const ERROR_REPORT_LIMIT = 20_000;

export function toImportSummary(run: SyncRunRow): ImportSummary {
  return {
    id: run.id,
    fileName: run.fileName ?? '',
    format: run.fileFormat ?? 'CSV',
    status: run.status,
    totalRows: run.totalRows,
    created: run.recordsCreated,
    updated: run.recordsUpdated,
    unchanged: run.recordsUnchanged,
    failed: run.recordsFailed,
    processedRows: run.processedRows,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdBy: run.createdBy,
  };
}

/** Strips directories and control characters; keeps the user's file name readable. */
function safeFileName(name: string): string {
  // Multer decodes multipart file names as latin1; restore UTF-8 (Turkish characters).
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  const base = path.basename(utf8.includes('�') ? name : utf8);
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  return base.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || 'dosya';
}

function example(file: TabularFile, column: number): string | null {
  for (const row of file.rows) {
    const cell = row[column];
    if (cell === null || cell === undefined || cell === '') continue;
    const text = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell);
    return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  return null;
}

const notEditable = () =>
  new AppError(HttpStatus.CONFLICT, 'IMPORT_NOT_EDITABLE', 'Import is no longer editable');

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectQueue(QUEUES.crmSync) private readonly queue: Queue<FileImportCommitJob>,
  ) {}

  private include = { createdBy: { select: { id: true, name: true } } } as const;

  private async getRun(tenantId: string, id: string): Promise<SyncRunRow> {
    const run = await this.prisma.syncRun.findFirst({
      where: { id, tenantId, kind: 'FILE_IMPORT' },
      include: this.include,
    });
    if (!run) throw AppError.notFound('Import not found');
    return run;
  }

  private async read(buffer: Buffer, fileName: string): Promise<TabularFile> {
    try {
      return await readTabularFile(buffer, fileName, this.config.IMPORT_MAX_ROWS);
    } catch (err) {
      if (err instanceof FileReadError) {
        throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, err.code, err.message);
      }
      throw err;
    }
  }

  private async loadFile(run: SyncRunRow): Promise<TabularFile> {
    if (run.status !== 'UPLOADED' || !run.fileStorageKey) throw notEditable();
    const buffer = await this.storage.getBuffer(run.fileStorageKey);
    return this.read(buffer, run.fileName ?? (run.fileFormat === 'XLSX' ? 'f.xlsx' : 'f.csv'));
  }

  private assertMapping(mapping: ImportMapping, file: TabularFile): void {
    const problems = validateMapping(mapping, file.headers);
    if (problems.length > 0) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'MAPPING_INVALID',
        'Column mapping is invalid',
        problems.map((p) => ({ path: p.field ?? 'columns', message: p.message })),
      );
    }
  }

  async upload(
    tenantId: string,
    userId: string,
    upload: Express.Multer.File | undefined,
    requestId: string | undefined,
  ): Promise<ImportUploadResponse> {
    if (!upload) throw new AppError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'A file is required');
    if (upload.size > this.config.IMPORT_MAX_FILE_MB * 1024 * 1024) {
      throw new AppError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', 'File is too large');
    }
    const fileName = safeFileName(upload.originalname);
    const file = await this.read(upload.buffer, fileName);

    const id = randomUUID();
    const ext = file.format === 'XLSX' ? 'xlsx' : 'csv';
    const key = `imports/${tenantId}/${id}/source.${ext}`;
    await this.storage.put(key, upload.buffer, 'application/octet-stream');

    let run: SyncRunRow;
    try {
      run = await this.prisma.$transaction(async (tx) => {
        const source = await ensureFileImportSource(tx, tenantId);
        const created = await tx.syncRun.create({
          data: {
            id,
            tenantId,
            crmConnectionId: source.id,
            kind: 'FILE_IMPORT',
            status: 'UPLOADED',
            fileName,
            fileFormat: file.format,
            fileStorageKey: key,
            fileSize: upload.size,
            totalRows: file.rows.length,
            createdByUserId: userId,
            expiresAt: new Date(Date.now() + this.config.IMPORT_TTL_HOURS * 3600_000),
          },
          include: this.include,
        });
        await this.audit.record(tx, {
          action: 'import.uploaded',
          tenantId,
          actorUserId: userId,
          targetType: 'sync_run',
          targetId: id,
          metadata: { format: file.format, rows: file.rows.length },
          requestId,
        });
        return created;
      });
    } catch (err) {
      await this.storage.delete([key]).catch(() => undefined);
      throw err;
    }

    const columns = suggestColumns(file.headers);
    const numericColumns = [columns.price, columns.grossAreaM2, columns.netAreaM2]
      .filter((h): h is string => !!h)
      .map((h) => file.headers.indexOf(h));
    const numberFormat = suggestNumberFormat(
      file.rows.flatMap((r) => numericColumns.map((i) => r[i] ?? null)),
    );

    return {
      import: toImportSummary(run),
      columns: file.headers.map((name, i) => ({ name, example: example(file, i) })),
      suggestedMapping: { columns, numberFormat, defaultCurrency: null },
      detected: { encoding: file.encoding, delimiter: file.delimiter },
    };
  }

  async preview(tenantId: string, id: string, mapping: ImportMapping): Promise<ImportPreview> {
    const run = await this.getRun(tenantId, id);
    const file = await this.loadFile(run);
    this.assertMapping(mapping, file);
    const rows = parseRows(file, mapping);

    const ids = rows.flatMap((r) => (r.data ? [r.data.externalId] : []));
    const existing = new Map<string, Prisma.PropertyGetPayload<object>>();
    for (let i = 0; i < ids.length; i += 1000) {
      const found = await this.prisma.property.findMany({
        where: {
          tenantId,
          crmConnectionId: run.crmConnectionId,
          externalId: { in: ids.slice(i, i + 1000) },
        },
      });
      for (const p of found) if (p.externalId) existing.set(p.externalId, p);
    }

    const counts = { create: 0, update: 0, unchanged: 0 };
    const errors: ImportRowError[] = [];
    const sample: ImportPreview['sample'] = [];
    let failed = 0;
    for (const row of rows) {
      if (!row.data) {
        failed++;
        if (errors.length < PREVIEW_ERROR_LIMIT)
          errors.push(...row.errors.slice(0, PREVIEW_ERROR_LIMIT - errors.length));
        continue;
      }
      const action = planRow(existing.get(row.data.externalId), row.data);
      counts[action]++;
      if (sample.length < PREVIEW_SAMPLE_SIZE) {
        const d = row.data;
        sample.push({
          rowNumber: row.rowNumber,
          externalId: d.externalId,
          title: d.title,
          listingType: d.listingType,
          price:
            d.priceMinor && d.priceCurrency
              ? `${(Number(d.priceMinor) / 100).toLocaleString('tr-TR')} ${d.priceCurrency}`
              : null,
          location: [d.neighborhood, d.district, d.city].filter(Boolean).join(', ') || null,
          action,
        });
      }
    }
    return {
      totalRows: rows.length,
      valid: rows.length - failed,
      ...counts,
      failed,
      errors,
      sample,
    };
  }

  async commit(
    tenantId: string,
    userId: string,
    id: string,
    mapping: ImportMapping,
    requestId: string | undefined,
  ): Promise<ImportSummary> {
    const run = await this.getRun(tenantId, id);
    const file = await this.loadFile(run);
    this.assertMapping(mapping, file);

    await this.prisma.$transaction(async (tx) => {
      // Conditional transition: a double-clicked or replayed commit queues the import once.
      const moved = await tx.syncRun.updateMany({
        where: { id, tenantId, status: 'UPLOADED' },
        data: { status: 'QUEUED', mappingJson: mapping, totalRows: file.rows.length },
      });
      if (moved.count !== 1) throw notEditable();
      await this.audit.record(tx, {
        action: 'import.queued',
        tenantId,
        actorUserId: userId,
        targetType: 'sync_run',
        targetId: id,
        requestId,
      });
    });
    await this.queue.add(
      CRM_SYNC_JOBS.fileImportCommit,
      { syncRunId: id, tenantId },
      { jobId: `file-import-${id}`, attempts: 3 },
    );
    this.logger.log({ syncRunId: id }, 'file import queued');
    return toImportSummary(await this.getRun(tenantId, id));
  }

  async get(tenantId: string, id: string): Promise<ImportSummary> {
    return toImportSummary(await this.getRun(tenantId, id));
  }

  async list(tenantId: string): Promise<ImportSummary[]> {
    const runs = await this.prisma.syncRun.findMany({
      where: { tenantId, kind: 'FILE_IMPORT' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: this.include,
    });
    return runs.map(toImportSummary);
  }

  async errors(tenantId: string, id: string): Promise<ImportRowError[]> {
    await this.getRun(tenantId, id);
    const rows = await this.prisma.syncRunRowError.findMany({
      where: { syncRunId: id, tenantId },
      orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }],
      take: ERROR_REPORT_LIMIT,
    });
    return rows.map((r) => ({
      rowNumber: r.rowNumber,
      field: (r.field as ImportRowError['field']) ?? null,
      message: r.message,
    }));
  }
}
