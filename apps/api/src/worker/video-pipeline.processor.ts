import { type VideoStage } from '@app/shared';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PipelineError } from '../video/errors';
import { PipelineRunner } from '../video/pipeline.runner';
import { ProviderError } from '../video/providers/types';
import { RUN_ORDER } from '../video/stages';
import { QUEUES, type VideoStageJob } from '../queues/queues';

/**
 * Runs one stage per job. Retryable failures rethrow so BullMQ backs off; the final attempt or any
 * permanent failure marks the generation FAILED and refunds it. Nothing is thrown after that, so
 * the job is not retried again.
 */
@Processor(QUEUES.video)
export class VideoPipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoPipelineProcessor.name);

  constructor(private readonly runner: PipelineRunner) {
    super();
  }

  async process(job: Job<VideoStageJob>): Promise<void> {
    const stage = job.name as VideoStage;
    if (!RUN_ORDER.includes(stage)) throw new Error(`Unknown stage ${job.name}`);
    const { generationId, tenantId, poll = 0 } = job.data;
    try {
      await this.runner.runStage(tenantId, generationId, stage, poll);
    } catch (err) {
      const failure =
        err instanceof PipelineError
          ? err
          : err instanceof ProviderError
            ? new PipelineError(err.code, err.retryable, '')
            : new PipelineError('INTERNAL_ERROR', true, '');
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (failure.retryable && !finalAttempt) throw err;
      this.logger.warn({ generationId, stage, code: failure.code }, 'pipeline stage failed');
      await this.runner.fail(tenantId, generationId, failure.code);
    }
  }
}
