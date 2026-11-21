import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ApiErrorFilter } from './common/http/error.filter';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/config.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { HealthModule } from './health/health.module';
import { InfraModule } from './infra/infra.module';
import { TenantsModule } from './tenants/tenants.module';

/** HTTP API process. Domain modules from blueprint §8.2 are added milestone by milestone. */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    InfraModule,
    AuditModule,
    EntitlementsModule,
    AuthModule,
    TenantsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
