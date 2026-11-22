import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditModule } from '../audit/audit.module';
import { LoggingModule } from '../common/logging/logging.module';
import { AppConfigModule } from '../config/config.module';
import { ImportRunnerService } from '../imports/import-runner.service';
import { InfraModule } from '../infra/infra.module';
import { bullRootModule, QUEUES } from '../queues/queues';
import { CreditsService } from '../credits/credits.service';
import { ProviderRegistry } from '../video/providers/registry';
import { PipelineRunner } from '../video/pipeline.runner';
import { SpendGuard } from '../video/spend-guard.service';
import { AccountDeletionService } from '../auth/account-deletion.service';
import { LeadPilotService } from '../integrations/leadpilot/leadpilot.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { RenderService } from '../render/render.service';
import { VideoPipelineProcessor } from './video-pipeline.processor';
import { CrmSyncProcessor } from './crm-sync.processor';
import { SystemProcessor } from './system.processor';
import { AnalyticsProcessor } from './analytics.processor';

/**
 * Background worker process (blueprint §8.3): same codebase as the API, separate process so it
 * scales and fails independently. Render-heavy processors will get their own entrypoint later.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    InfraModule,
    AuditModule,
    bullRootModule,
    BullModule.registerQueue(
      { name: QUEUES.system },
      { name: QUEUES.crmSync },
      { name: QUEUES.video },
      { name: QUEUES.analytics },
    ),
  ],
  providers: [
    SystemProcessor,
    CrmSyncProcessor,
    ImportRunnerService,
    VideoPipelineProcessor,
    PipelineRunner,
    RenderService,
    CreditsService,
    AccountDeletionService,
    LeadPilotService,
    SubscriptionsService,
    NotificationsService,
    EntitlementsService,
    ProviderRegistry,
    SpendGuard,
    AnalyticsService,
    AnalyticsProcessor,
  ],
})
export class WorkerModule {}
