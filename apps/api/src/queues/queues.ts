import { BullModule } from '@nestjs/bullmq';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { redisConnectionOptions } from '../infra/redis';

/**
 * Queue names. The blueprint's pipeline queues (§8.3) are added with the features that need
 * them; `system` exists so M0 can prove the API → Redis → worker path end to end.
 */
export const QUEUES = {
  system: 'system',
} as const;

export const SYSTEM_JOBS = {
  noop: 'noop',
} as const;

export const bullRootModule = BullModule.forRootAsync({
  inject: [APP_CONFIG],
  useFactory: (config: AppConfig) => ({
    connection: redisConnectionOptions(config.REDIS_URL),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000, jitter: 0.5 },
      removeOnComplete: { age: 24 * 3600, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }),
});
