import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { ImportRunnerService } from '../imports/import-runner.service';
import { LeadPilotService } from '../integrations/leadpilot/leadpilot.service';
import {
  CRM_SYNC_JOBS,
  type FileImportCommitJob,
  type LeadPilotPushJob,
  type LeadPilotSyncJob,
  QUEUES,
} from '../queues/queues';

@Processor(QUEUES.crmSync)
export class CrmSyncProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(CrmSyncProcessor.name);

  constructor(
    private readonly runner: ImportRunnerService,
    private readonly leadpilot: LeadPilotService,
    @InjectQueue(QUEUES.crmSync) private readonly queue: Queue,
  ) {
    super();
  }

  /** Every hour, every active LeadPilot connection is synced. Idempotent to register. */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      CRM_SYNC_JOBS.leadpilotSyncAll,
      { every: 60 * 60 * 1000 },
      { name: CRM_SYNC_JOBS.leadpilotSyncAll },
    );
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case CRM_SYNC_JOBS.fileImportCommit: {
        const data = job.data as FileImportCommitJob;
        try {
          await this.runner.run(data.syncRunId, data.tenantId);
        } catch (err) {
          const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
          if (finalAttempt) await this.runner.markFailed(data.syncRunId, data.tenantId, err);
          throw err;
        }
        return undefined;
      }
      case CRM_SYNC_JOBS.leadpilotSync: {
        const data = job.data as LeadPilotSyncJob;
        const count = await this.leadpilot.sync(data.tenantId, data.connectionId);
        this.logger.log({ connectionId: data.connectionId, count }, 'leadpilot portfolio synced');
        return { count };
      }
      case CRM_SYNC_JOBS.leadpilotPush: {
        const data = job.data as LeadPilotPushJob;
        const sent = await this.leadpilot.pushLead(data.tenantId, data.leadId);
        return { sent };
      }
      case CRM_SYNC_JOBS.leadpilotSyncAll: {
        const connections = await this.leadpilot.syncAll();
        return { connections };
      }
      default:
        throw new Error(`Unknown job ${job.name} on ${QUEUES.crmSync}`);
    }
  }
}
