import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { InfraModule } from './infra/infra.module';

/** HTTP API process. Domain modules from blueprint §8.2 are added milestone by milestone. */
@Module({
  imports: [AppConfigModule, LoggingModule, InfraModule, HealthModule],
})
export class AppModule {}
