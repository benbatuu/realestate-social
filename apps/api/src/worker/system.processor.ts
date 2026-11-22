import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { ImportRunnerService } from '../imports/import-runner.service';
import { AccountDeletionService } from '../auth/account-deletion.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QUEUES, SYSTEM_JOBS } from '../queues/queues';

export interface NoopJobData {
  echo: string;
}

/** Housekeeping jobs. `noop` proves the API → Redis → worker path. */
@Processor(QUEUES.system)
export class SystemProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemProcessor.name);

  constructor(
    private readonly imports: ImportRunnerService,
    private readonly accounts: AccountDeletionService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.system) private readonly queue: Queue,
  ) {
    super();
  }

  /** Hourly clean-up of expired uploads and leftover import files. Idempotent to register. */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      SYSTEM_JOBS.expireImports,
      { every: 60 * 60 * 1000 },
      { name: SYSTEM_JOBS.expireImports },
    );
    await this.queue.upsertJobScheduler(
      SYSTEM_JOBS.applyPlanChanges,
      { every: 60 * 60 * 1000 },
      { name: SYSTEM_JOBS.applyPlanChanges },
    );
    await this.queue.upsertJobScheduler(
      SYSTEM_JOBS.notifyOverdueFollowups,
      { every: 60 * 60 * 1000 },
      { name: SYSTEM_JOBS.notifyOverdueFollowups },
    );
    await this.queue.upsertJobScheduler(
      SYSTEM_JOBS.deleteAccounts,
      { every: 60 * 60 * 1000 },
      { name: SYSTEM_JOBS.deleteAccounts },
    );
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case SYSTEM_JOBS.noop: {
        const data = job.data as NoopJobData;
        this.logger.log({ jobId: job.id, jobName: job.name }, 'processed system job');
        return { ok: true, echo: data.echo };
      }
      case SYSTEM_JOBS.expireImports: {
        const cleaned = await this.imports.expireAndCleanUp();
        if (cleaned > 0) this.logger.log({ cleaned }, 'import files cleaned up');
        return { cleaned };
      }
      case SYSTEM_JOBS.applyPlanChanges: {
        const applied = await this.subscriptions.applyDueChanges();
        if (applied > 0) this.logger.log({ applied }, 'downgrades applied');
        return { applied };
      }
      case SYSTEM_JOBS.notifyOverdueFollowups: {
        const notified = await this.notifications.notifyOverdueFollowups();
        if (notified > 0) this.logger.log({ notified }, 'overdue follow-ups notified');
        return { notified };
      }
      case SYSTEM_JOBS.deleteAccounts: {
        const result = await this.accounts.runDue();
        if (result.deleted > 0 || result.skipped > 0)
          this.logger.log(result, 'account deletions run');
        return result;
      }
      default:
        throw new Error(`Unknown job ${job.name} on ${QUEUES.system}`);
    }
  }
}
