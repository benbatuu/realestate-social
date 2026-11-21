import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LoggingModule } from '../common/logging/logging.module';
import { AppConfigModule } from '../config/config.module';
import { InfraModule } from '../infra/infra.module';
import { bullRootModule, QUEUES } from '../queues/queues';
import { SystemProcessor } from './system.processor';

/**
 * Background worker process (blueprint §8.3): same codebase as the API, separate process so it
 * scales and fails independently. Render-heavy processors will get their own entrypoint later.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    InfraModule,
    bullRootModule,
    BullModule.registerQueue({ name: QUEUES.system }),
  ],
  providers: [SystemProcessor],
})
export class WorkerModule {}
