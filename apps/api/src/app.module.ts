import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CreditsModule } from './credits/credits.module';
import { VideoModule } from './video/video.module';
import { ApiErrorFilter } from './common/http/error.filter';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/config.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports/imports.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LeadsModule } from './leads/leads.module';
import { InfraModule } from './infra/infra.module';
import { PropertiesModule } from './properties/properties.module';
import { bullRootModule } from './queues/queues';
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
    bullRootModule,
    TenantsModule,
    ImportsModule,
    PropertiesModule,
    CreditsModule,
    VideoModule,
    LeadsModule,
    AnalyticsModule,
    IntegrationsModule,
    SubscriptionsModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
