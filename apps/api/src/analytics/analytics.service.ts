import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { AnalyticsLatest, AnalyticsResponse, AnalyticsSnapshotStatus } from '@app/shared';
import { PrismaService } from '../infra/prisma.service';
import { ANALYTICS_JOBS, type AnalyticsComputeJob, QUEUES } from '../queues/queues';

export const ANALYTICS_PERIODS = [30, 90, 365] as const;

function toStatus(r: {
  id: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  error: string | null;
}): AnalyticsSnapshotStatus {
  return {
    id: r.id,
    status: r.status as AnalyticsSnapshotStatus['status'],
    requestedAt: r.requestedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    error: r.error,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PROPERTIES = 500;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.analytics) private readonly queue: Queue,
  ) {}

  /** Queues a run unless one is already running for this period. */
  async start(tenantId: string, days: number): Promise<AnalyticsSnapshotStatus> {
    const running = await this.prisma.analyticsSnapshot.findFirst({
      where: { tenantId, days, status: 'RUNNING' },
      orderBy: { requestedAt: 'desc' },
    });
    if (running) return toStatus(running);
    const snap = await this.prisma.analyticsSnapshot.create({
      data: { tenantId, days, status: 'RUNNING' },
    });
    const job: AnalyticsComputeJob = { snapshotId: snap.id, tenantId, days };
    await this.queue.add(ANALYTICS_JOBS.compute, job);
    return toStatus(snap);
  }

  /** The newest run, and the newest finished result for the period. */
  async latest(tenantId: string, days: number): Promise<AnalyticsLatest> {
    const [run, done] = await Promise.all([
      this.prisma.analyticsSnapshot.findFirst({
        where: { tenantId, days },
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.analyticsSnapshot.findFirst({
        where: { tenantId, days, status: 'DONE' },
        orderBy: { completedAt: 'desc' },
      }),
    ]);
    return {
      run: run ? toStatus(run) : null,
      data: done?.payloadJson ? (done.payloadJson as unknown as AnalyticsResponse) : null,
      computedAt: done?.completedAt?.toISOString() ?? null,
    };
  }

  /** Background job body: compute, store, keep only the newest finished result. */
  async runSnapshot(job: AnalyticsComputeJob): Promise<void> {
    try {
      const result = await this.compute(job.tenantId, job.days);
      await this.prisma.$transaction(async (tx) => {
        await tx.analyticsSnapshot.update({
          where: { id: job.snapshotId },
          data: {
            status: 'DONE',
            completedAt: new Date(),
            payloadJson: result as unknown as object,
            error: null,
          },
        });
        await tx.analyticsSnapshot.deleteMany({
          where: {
            tenantId: job.tenantId,
            days: job.days,
            status: 'DONE',
            id: { not: job.snapshotId },
          },
        });
      });
    } catch (err) {
      this.logger.error({ err: String(err), snapshotId: job.snapshotId }, 'analytics run failed');
      await this.prisma.analyticsSnapshot.update({
        where: { id: job.snapshotId },
        data: { status: 'FAILED', completedAt: new Date(), error: 'Analiz hesaplanamadı.' },
      });
      throw err;
    }
  }

  /** Daily refresh for every workspace, both main periods. */
  async refreshAll(): Promise<number> {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const t of tenants) {
      for (const days of [30, 90]) await this.start(t.id, days);
    }
    return tenants.length;
  }

  async compute(tenantId: string, days: number): Promise<AnalyticsResponse> {
    const since = new Date(Date.now() - days * DAY_MS);
    const [properties, leadsAll, leadsPeriod, videos] = await Promise.all([
      this.prisma.property.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: MAX_PROPERTIES,
        select: {
          id: true,
          title: true,
          listingType: true,
          createdAt: true,
          description: true,
          dataCoverageScore: true,
          _count: { select: { assets: true } },
        },
      }),
      this.prisma.lead.groupBy({
        by: ['propertyId', 'status'],
        where: { tenantId, propertyId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['propertyId'],
        where: { tenantId, propertyId: { not: null }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.videoGeneration.findMany({
        where: { tenantId, stage: 'COMPLETED' },
        select: { videoProject: { select: { propertyId: true } } },
        take: 20000,
      }),
    ]);

    const statusCount = new Map<string, Record<string, number>>();
    for (const row of leadsAll) {
      if (!row.propertyId) continue;
      const m = statusCount.get(row.propertyId) ?? {};
      m[row.status] = row._count._all;
      statusCount.set(row.propertyId, m);
    }
    const periodCount = new Map(leadsPeriod.map((r) => [r.propertyId as string, r._count._all]));
    const videoCount = new Map<string, number>();
    for (const v of videos) {
      const id = v.videoProject.propertyId;
      videoCount.set(id, (videoCount.get(id) ?? 0) + 1);
    }

    const now = Date.now();
    const rows = properties.map((p) => {
      const st = statusCount.get(p.id) ?? {};
      const open = (st['NEW'] ?? 0) + (st['CONTACTED'] ?? 0) + (st['QUALIFIED'] ?? 0);
      const won = st['WON'] ?? 0;
      const lost = st['LOST'] ?? 0;
      return {
        id: p.id,
        title: p.title,
        listingType: p.listingType,
        ageDays: Math.max(0, Math.floor((now - p.createdAt.getTime()) / DAY_MS)),
        photoCount: p._count.assets,
        hasDescription: !!p.description?.trim(),
        coverageScore: p.dataCoverageScore,
        videoCount: videoCount.get(p.id) ?? 0,
        leadsInPeriod: periodCount.get(p.id) ?? 0,
        leadsOpen: open,
        leadsWon: won,
        leadsLost: lost,
        leadsTotal: open + won + lost,
      };
    });

    return {
      days,
      summary: {
        properties: rows.length,
        leadsInPeriod: rows.reduce((a, r) => a + r.leadsInPeriod, 0),
        leadsWon: rows.reduce((a, r) => a + r.leadsWon, 0),
        leadsLost: rows.reduce((a, r) => a + r.leadsLost, 0),
        propertiesWithVideo: rows.filter((r) => r.videoCount > 0).length,
        propertiesWithoutLeads: rows.filter((r) => r.leadsTotal === 0).length,
      },
      properties: rows,
      coverage: { leads: true, videos: true, portalViews: false, priceHistory: false },
    };
  }
}
