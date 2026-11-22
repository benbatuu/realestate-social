import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { PrismaService } from '../infra/prisma.service';

/** Advisory lock id for spend reservations, so two workers cannot both pass the cap. */
const SPEND_LOCK = 0x5e_9d_08;

export type SpendDecision =
  { ok: true; usageId: string } | { ok: false; reason: 'disabled' | 'daily_cap' | 'monthly_cap' };

/**
 * Platform-wide spend ceiling for paid AI calls (plan-08). Before a paid call, `reserve` writes a
 * usage row with the estimate; after it, `settle` records what the provider billed. Spend so far
 * counts the billed cost where known and the estimate otherwise. Caps are in USD, for all
 * workspaces together, since they protect our account balance.
 */
@Injectable()
export class SpendGuard {
  private readonly logger = new Logger(SpendGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async reserve(input: {
    tenantId: string;
    generationId: string;
    provider: string;
    model: string;
    operation: string;
    units: number;
    unitType: string;
    estimateMicroUsd: number;
  }): Promise<SpendDecision> {
    if (!this.config.AI_PAID_CALLS_ENABLED) return { ok: false, reason: 'disabled' };
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dailyCap = Math.round(this.config.AI_DAILY_BUDGET_USD * 1_000_000);
    const monthlyCap = Math.round(this.config.AI_MONTHLY_BUDGET_USD * 1_000_000);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SPEND_LOCK})`;
      const spent = async (since: Date) => {
        const rows = await tx.$queryRaw<{ total: bigint | null }[]>`
          SELECT SUM(COALESCE("actualCostMicroUsd", "estimatedCostMicroUsd"))::bigint AS total
          FROM provider_usages
          WHERE "isMock" = false AND "createdAt" >= ${since} AND status <> 'REFUSED'`;
        return Number(rows[0]?.total ?? 0);
      };
      if ((await spent(dayStart)) + input.estimateMicroUsd > dailyCap) {
        this.logger.warn(`Daily AI budget reached; ${input.operation} refused.`);
        return { ok: false as const, reason: 'daily_cap' as const };
      }
      if ((await spent(monthStart)) + input.estimateMicroUsd > monthlyCap) {
        this.logger.warn(`Monthly AI budget reached; ${input.operation} refused.`);
        return { ok: false as const, reason: 'monthly_cap' as const };
      }
      const row = await tx.providerUsage.create({
        data: {
          tenantId: input.tenantId,
          videoGenerationId: input.generationId,
          provider: input.provider,
          model: input.model,
          operation: input.operation,
          externalRequestId: null,
          units: input.units,
          unitType: input.unitType,
          estimatedCostMicroUsd: input.estimateMicroUsd,
          status: 'RESERVED',
          isMock: false,
        },
        select: { id: true },
      });
      return { ok: true as const, usageId: row.id };
    });
  }

  /** Records the outcome of a reserved call. A refused submit costs nothing. */
  async settle(
    usageId: string,
    outcome: {
      status: 'SUBMITTED' | 'SUCCEEDED' | 'FAILED' | 'REFUSED' | 'UNKNOWN';
      externalRequestId?: string | null;
      actualMicroUsd?: number;
    },
  ): Promise<void> {
    await this.prisma.providerUsage.update({
      where: { id: usageId },
      data: {
        status: outcome.status,
        ...(outcome.externalRequestId !== undefined
          ? { externalRequestId: outcome.externalRequestId }
          : {}),
        ...(outcome.actualMicroUsd !== undefined
          ? { actualCostMicroUsd: outcome.actualMicroUsd }
          : {}),
      },
    });
  }
}
