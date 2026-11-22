import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AnalyticsService } from '../analytics/analytics.service';
import { ANALYTICS_JOBS, type AnalyticsComputeJob, QUEUES } from '../queues/queues';

/** Analysis runs in the worker, so the API never waits for it. */
@Processor(QUEUES.analytics)
export class AnalyticsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    private readonly analytics: AnalyticsService,
    @InjectQueue(QUEUES.analytics) private readonly queue: Queue,
  ) {
    super();
  }

  /** Once a day, every workspace gets a fresh result. Idempotent to register. */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      ANALYTICS_JOBS.refreshAll,
      { every: 24 * 60 * 60 * 1000 },
      { name: ANALYTICS_JOBS.refreshAll },
    );
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case ANALYTICS_JOBS.compute: {
        await this.analytics.runSnapshot(job.data as AnalyticsComputeJob);
        this.logger.log({ jobId: job.id }, 'analytics snapshot done');
        return { ok: true };
      }
      case ANALYTICS_JOBS.refreshAll: {
        const tenants = await this.analytics.refreshAll();
        this.logger.log({ tenants }, 'daily analytics refresh queued');
        return { tenants };
      }
      default:
        throw new Error(`Unknown job ${job.name} on ${QUEUES.analytics}`);
    }
  }
}
