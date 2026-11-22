import { BullModule } from '@nestjs/bullmq';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { redisConnectionOptions } from '../infra/redis';

/**
 * Queue names. The blueprint's pipeline queues (§8.3) are added with the features that need
 * them; `system` exists so M0 can prove the API → Redis → worker path end to end.
 */
export const QUEUES = {
  system: 'system',
  crmSync: 'crm-sync',
  video: 'video-pipeline',
  analytics: 'analytics',
} as const;

export const ANALYTICS_JOBS = {
  compute: 'compute',
  refreshAll: 'refresh-all',
} as const;

export interface AnalyticsComputeJob {
  snapshotId: string;
  tenantId: string;
  days: number;
}

export interface VideoStageJob {
  generationId: string;
  tenantId: string;
  /** How many times this stage has waited on a provider (AI clips take minutes). */
  poll?: number;
}

export const SYSTEM_JOBS = {
  noop: 'noop',
  expireImports: 'expire-imports',
  deleteAccounts: 'delete-accounts',
  applyPlanChanges: 'apply-plan-changes',
  notifyOverdueFollowups: 'notify-overdue-followups',
} as const;

export const CRM_SYNC_JOBS = {
  fileImportCommit: 'file-import-commit',
  leadpilotSync: 'leadpilot-sync',
  leadpilotPush: 'leadpilot-push',
  leadpilotSyncAll: 'leadpilot-sync-all',
} as const;

export interface LeadPilotSyncJob {
  tenantId: string;
  connectionId: string;
}

export interface LeadPilotPushJob {
  tenantId: string;
  leadId: string;
}

export interface FileImportCommitJob {
  syncRunId: string;
  tenantId: string;
}

export function queuePrefix(nodeEnv: string): string {
  return `bull-${nodeEnv}`;
}

export const bullRootModule = BullModule.forRootAsync({
  inject: [APP_CONFIG],
  useFactory: (config: AppConfig) => ({
    connection: redisConnectionOptions(config.REDIS_URL),
    // Per-environment prefix so test runs never share queues with a running dev worker.
    prefix: queuePrefix(config.NODE_ENV),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000, jitter: 0.5 },
      removeOnComplete: { age: 24 * 3600, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }),
});
