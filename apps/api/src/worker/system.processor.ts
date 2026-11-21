import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES, SYSTEM_JOBS } from '../queues/queues';

export interface NoopJobData {
  echo: string;
}

/** Proves the API → Redis → worker path. Real pipeline processors arrive in later milestones. */
@Processor(QUEUES.system)
export class SystemProcessor extends WorkerHost {
  private readonly logger = new Logger(SystemProcessor.name);

  async process(job: Job<NoopJobData>): Promise<{ ok: true; echo: string }> {
    if (job.name !== SYSTEM_JOBS.noop) {
      throw new Error(`Unknown job ${job.name} on ${QUEUES.system}`);
    }
    this.logger.log({ jobId: job.id, jobName: job.name }, 'processed system job');
    return { ok: true, echo: job.data.echo };
  }
}
