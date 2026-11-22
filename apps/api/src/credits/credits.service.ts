import { randomUUID } from 'node:crypto';
import type {
  BillingType,
  CreditAdjustmentRequest,
  CreditBalance,
  CreditLedgerQuery,
  CreditLedgerResponse,
} from '@app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/http/app-error';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';

type Tx = Prisma.TransactionClient;

export interface ActivePeriod {
  periodStart: Date;
  periodEnd: Date;
  planCode: string;
  monthlyCredits: number;
  freeRegenerationAllowance: number;
}

export interface GenerationRef {
  id: string;
  videoProjectId: string;
  generationNumber: number;
  status: 'RESERVED' | 'CAPTURED' | 'RELEASED';
  billingType: BillingType;
  replayed: boolean;
}

const USABLE = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;
const insufficient = () =>
  new AppError(HttpStatus.PAYMENT_REQUIRED, 'INSUFFICIENT_CREDITS', 'Not enough credits');
const invalidState = () =>
  new AppError(
    HttpStatus.CONFLICT,
    'GENERATION_STATE_INVALID',
    'Generation is not in a valid state',
  );

/**
 * Credits and free regenerations (blueprint §4).
 *
 * Every balance-changing operation runs in one transaction that first locks the tenant's
 * credit account row, so operations on one workspace are serialised. Ledgers are append-only and
 * each entry carries a unique idempotency key, so replays cannot double-charge.
 */
@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Period handling
  // -------------------------------------------------------------------------

  async activePeriod(tx: Tx, tenantId: string, now = new Date()): Promise<ActivePeriod | null> {
    const sub = await tx.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [...USABLE] },
        currentPeriodStart: { lte: now },
        currentPeriodEnd: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        currentPeriodStart: true,
        currentPeriodEnd: true,
        plan: { select: { code: true, monthlyCredits: true, freeRegenerationAllowance: true } },
      },
    });
    if (!sub) return null;
    return {
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      planCode: sub.plan.code,
      monthlyCredits: sub.plan.monthlyCredits,
      freeRegenerationAllowance: sub.plan.freeRegenerationAllowance,
    };
  }

  /**
   * Locks the tenant's credit account and makes sure the current period is granted. Expired
   * periods lose their unused credits and free regenerations (no rollover, §4.7). Must run inside
   * a transaction.
   */
  private async lockAndRoll(tx: Tx, tenantId: string, now = new Date()) {
    await tx.creditAccount.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
    // Column is "tenantId" (Prisma keeps field names unless @map is used).
    await tx.$queryRaw`SELECT id FROM credit_accounts WHERE "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const period = await this.activePeriod(tx, tenantId, now);
    if (period) await this.grantPeriod(tx, tenantId, period);
    return period;
  }

  private async grantPeriod(tx: Tx, tenantId: string, period: ActivePeriod): Promise<void> {
    const iso = period.periodStart.toISOString();
    const existing = await tx.freeRegenerationAccount.findUnique({
      where: { tenantId_periodStart: { tenantId, periodStart: period.periodStart } },
    });
    if (existing) return;

    // Expire whatever is left from earlier periods.
    const stale = await tx.freeRegenerationAccount.findMany({
      where: { tenantId, periodStart: { lt: period.periodStart }, available: { gt: 0 } },
    });
    for (const acct of stale) {
      await tx.freeRegenerationAccount.update({ where: { id: acct.id }, data: { available: 0 } });
      await this.freeLedger(
        tx,
        tenantId,
        acct.id,
        'EXPIRE',
        -acct.available,
        `free-expire:${acct.id}`,
      );
    }
    const account = await tx.creditAccount.findUniqueOrThrow({ where: { tenantId } });
    if (account.available > 0) {
      await tx.creditAccount.update({
        where: { tenantId },
        data: { available: 0 },
      });
      await this.creditLedger(tx, tenantId, 'EXPIRE', -account.available, `credit-expire:${iso}`, {
        description: 'Önceki dönem kredisi sona erdi',
      });
    }

    await tx.creditAccount.update({
      where: { tenantId },
      data: { available: { increment: period.monthlyCredits } },
    });
    await this.creditLedger(tx, tenantId, 'GRANT', period.monthlyCredits, `grant:${iso}`, {
      description: `${period.planCode} paketi aylık kredisi`,
    });

    const free = await tx.freeRegenerationAccount.create({
      data: {
        tenantId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        granted: period.freeRegenerationAllowance,
        available: period.freeRegenerationAllowance,
      },
    });
    await this.freeLedger(
      tx,
      tenantId,
      free.id,
      'GRANT',
      period.freeRegenerationAllowance,
      `free-grant:${iso}`,
    );
  }

  // -------------------------------------------------------------------------
  // Ledger writers (always called inside the same transaction as the balance change)
  // -------------------------------------------------------------------------

  /** Adds the credits a package upgrade gives right away. Idempotent per key. */
  async grantUpgradeDifference(
    tx: Tx,
    tenantId: string,
    amount: number,
    idempotencyKey: string,
    description: string,
  ): Promise<void> {
    if (amount <= 0) return;
    await tx.creditAccount.update({
      where: { tenantId },
      data: { available: { increment: amount } },
    });
    await this.creditLedger(tx, tenantId, 'GRANT', amount, idempotencyKey, { description });
  }

  private creditLedger(
    tx: Tx,
    tenantId: string,
    type: 'GRANT' | 'RESERVE' | 'RELEASE' | 'CAPTURE' | 'EXPIRE' | 'ADMIN_ADJUSTMENT',
    amount: number,
    idempotencyKey: string,
    extra: { referenceId?: string; description?: string; userId?: string | undefined } = {},
  ) {
    return tx.creditLedger.create({
      data: {
        tenantId,
        type,
        amount,
        idempotencyKey,
        referenceType: extra.referenceId ? 'video_generation' : null,
        referenceId: extra.referenceId ?? null,
        description: extra.description ?? null,
        createdByUserId: extra.userId ?? null,
      },
    });
  }

  private freeLedger(
    tx: Tx,
    tenantId: string,
    accountId: string,
    type: 'GRANT' | 'RESERVE' | 'RELEASE' | 'CONSUME' | 'EXPIRE',
    amount: number,
    idempotencyKey: string,
    referenceId?: string,
  ) {
    return tx.freeRegenerationLedger.create({
      data: { tenantId, accountId, type, amount, idempotencyKey, referenceId: referenceId ?? null },
    });
  }

  // -------------------------------------------------------------------------
  // Reservation, capture, release (called by video generation; M4 wires the pipeline)
  // -------------------------------------------------------------------------

  /** First generation of a new video project: always 1 credit. */
  async reserveNewProject(
    tenantId: string,
    userId: string,
    propertyId: string,
    idempotencyKey: string,
    durationSeconds = 30,
  ): Promise<GenerationRef> {
    return this.retryOnKeyRace(tenantId, idempotencyKey, () =>
      this.prisma.$transaction(async (tx) => {
        const replay = await this.findByKey(tx, tenantId, idempotencyKey);
        if (replay) return replay;

        const property = await tx.property.findFirst({
          where: { id: propertyId, tenantId },
          select: { id: true, title: true },
        });
        if (!property) throw AppError.notFound('Property not found');
        const period = await this.lockAndRoll(tx, tenantId);
        if (!period) throw new AppError(HttpStatus.CONFLICT, 'NO_ACTIVE_PLAN', 'No active plan');

        await this.takeCredit(tx, tenantId);
        const project = await tx.videoProject.create({
          data: {
            tenantId,
            propertyId,
            createdByUserId: userId,
            title: property.title,
            generationCount: 1,
          },
        });
        const gen = await tx.videoGeneration.create({
          data: {
            tenantId,
            videoProjectId: project.id,
            generationNumber: 1,
            status: 'RESERVED',
            billingType: 'INITIAL_CREDIT',
            idempotencyKey,
            durationSeconds,
          },
        });
        await this.creditLedger(tx, tenantId, 'RESERVE', -1, `reserve:${gen.id}`, {
          referenceId: gen.id,
          userId,
        });
        return this.toRef(gen, false);
      }),
    );
  }

  /**
   * Regeneration inside an existing project. Uses the free regeneration only if the workspace
   * pool has one and this project has not used its own (§4.2). Both checks happen under the
   * tenant lock, and the project flag is claimed with a conditional update.
   */
  async reserveRegeneration(
    tenantId: string,
    userId: string,
    projectId: string,
    idempotencyKey: string,
    durationSeconds = 30,
  ): Promise<GenerationRef> {
    return this.retryOnKeyRace(tenantId, idempotencyKey, () =>
      this.prisma.$transaction(async (tx) => {
        const replay = await this.findByKey(tx, tenantId, idempotencyKey);
        if (replay) return replay;

        const project = await tx.videoProject.findFirst({ where: { id: projectId, tenantId } });
        if (!project) throw AppError.notFound('Project not found');
        const period = await this.lockAndRoll(tx, tenantId);
        if (!period) throw new AppError(HttpStatus.CONFLICT, 'NO_ACTIVE_PLAN', 'No active plan');

        const pool = await tx.freeRegenerationAccount.findUnique({
          where: { tenantId_periodStart: { tenantId, periodStart: period.periodStart } },
        });
        let billing: BillingType = 'PAID_REGENERATION';
        let freeAccountId: string | null = null;

        if (pool && pool.available >= 1 && !project.freeRegenerationUsed) {
          const claimed = await tx.videoProject.updateMany({
            where: { id: project.id, freeRegenerationUsed: false },
            data: { freeRegenerationUsed: true },
          });
          const took = await tx.freeRegenerationAccount.updateMany({
            where: { id: pool.id, available: { gte: 1 } },
            data: { available: { decrement: 1 }, reserved: { increment: 1 } },
          });
          if (claimed.count === 1 && took.count === 1) {
            billing = 'FREE_REGENERATION';
            freeAccountId = pool.id;
          } else if (claimed.count === 1 || took.count === 1) {
            throw invalidState();
          }
        }

        if (billing === 'PAID_REGENERATION') await this.takeCredit(tx, tenantId);

        const updated = await tx.videoProject.update({
          where: { id: project.id },
          data: { generationCount: { increment: 1 } },
          select: { generationCount: true },
        });
        const gen = await tx.videoGeneration.create({
          data: {
            tenantId,
            videoProjectId: project.id,
            generationNumber: updated.generationCount,
            status: 'RESERVED',
            billingType: billing,
            idempotencyKey,
            durationSeconds,
          },
        });
        if (freeAccountId) {
          await this.freeLedger(
            tx,
            tenantId,
            freeAccountId,
            'RESERVE',
            -1,
            `reserve:${gen.id}`,
            gen.id,
          );
        } else {
          await this.creditLedger(tx, tenantId, 'RESERVE', -1, `reserve:${gen.id}`, {
            referenceId: gen.id,
            userId,
          });
        }
        return this.toRef(gen, false);
      }),
    );
  }

  /** Generation succeeded and reached the user: keep the charge. Idempotent. */
  async capture(tenantId: string, generationId: string): Promise<GenerationRef> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAndRoll(tx, tenantId);
      const gen = await this.findGeneration(tx, tenantId, generationId);
      if (gen.status === 'CAPTURED') return this.toRef(gen, true);
      if (gen.status !== 'RESERVED') throw invalidState();

      const done = await tx.videoGeneration.update({
        where: { id: gen.id },
        data: { status: 'CAPTURED', completedAt: new Date() },
      });
      if (gen.billingType === 'FREE_REGENERATION') {
        const accountId = await this.reservationAccount(tx, tenantId, gen.id);
        await tx.freeRegenerationAccount.update({
          where: { id: accountId },
          data: { reserved: { decrement: 1 }, consumed: { increment: 1 } },
        });
        await this.freeLedger(tx, tenantId, accountId, 'CONSUME', 0, `consume:${gen.id}`, gen.id);
      } else {
        await tx.creditAccount.update({
          where: { tenantId },
          data: { reserved: { decrement: 1 } },
        });
        await this.creditLedger(tx, tenantId, 'CAPTURE', 0, `capture:${gen.id}`, {
          referenceId: gen.id,
        });
      }
      return this.toRef(done, false);
    });
  }

  /** System failure: give the credit or free regeneration back. Idempotent. */
  async release(tenantId: string, generationId: string, reason: string): Promise<GenerationRef> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAndRoll(tx, tenantId);
      const gen = await this.findGeneration(tx, tenantId, generationId);
      if (gen.status === 'RELEASED') return this.toRef(gen, true);
      if (gen.status !== 'RESERVED') throw invalidState();

      const done = await tx.videoGeneration.update({
        where: { id: gen.id },
        data: { status: 'RELEASED', completedAt: new Date() },
      });
      if (gen.billingType === 'FREE_REGENERATION') {
        const accountId = await this.reservationAccount(tx, tenantId, gen.id);
        await tx.freeRegenerationAccount.update({
          where: { id: accountId },
          data: { available: { increment: 1 }, reserved: { decrement: 1 } },
        });
        await tx.videoProject.update({
          where: { id: gen.videoProjectId },
          data: { freeRegenerationUsed: false },
        });
        await this.freeLedger(tx, tenantId, accountId, 'RELEASE', 1, `release:${gen.id}`, gen.id);
      } else {
        await tx.creditAccount.update({
          where: { tenantId },
          data: { available: { increment: 1 }, reserved: { decrement: 1 } },
        });
        await this.creditLedger(tx, tenantId, 'RELEASE', 1, `release:${gen.id}`, {
          referenceId: gen.id,
          description: reason.slice(0, 200),
        });
      }
      return this.toRef(done, false);
    });
  }

  // -------------------------------------------------------------------------
  // Reads and manual corrections
  // -------------------------------------------------------------------------

  async balance(tenantId: string): Promise<CreditBalance> {
    return this.prisma.$transaction(async (tx) => {
      const period = await this.lockAndRoll(tx, tenantId);
      const account = await tx.creditAccount.findUniqueOrThrow({ where: { tenantId } });
      const pool = period
        ? await tx.freeRegenerationAccount.findUnique({
            where: { tenantId_periodStart: { tenantId, periodStart: period.periodStart } },
          })
        : null;
      return {
        planCode: period?.planCode ?? null,
        periodStart: period?.periodStart.toISOString() ?? null,
        periodEnd: period?.periodEnd.toISOString() ?? null,
        credits: {
          monthly: period?.monthlyCredits ?? 0,
          available: account.available,
          reserved: account.reserved,
        },
        freeRegenerations: {
          granted: pool?.granted ?? 0,
          available: pool?.available ?? 0,
          reserved: pool?.reserved ?? 0,
          consumed: pool?.consumed ?? 0,
        },
      };
    });
  }

  async ledger(tenantId: string, query: CreditLedgerQuery): Promise<CreditLedgerResponse> {
    const [total, rows] = await Promise.all([
      this.prisma.creditLedger.count({ where: { tenantId } }),
      this.prisma.creditLedger.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Owner-only correction. Never lets available credits go negative. Audited. */
  async adjust(
    tenantId: string,
    userId: string,
    input: CreditAdjustmentRequest,
    requestId: string | undefined,
  ): Promise<CreditBalance> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAndRoll(tx, tenantId);
      const account = await tx.creditAccount.findUniqueOrThrow({ where: { tenantId } });
      if (account.available + input.amount < 0) {
        throw new AppError(
          HttpStatus.PAYMENT_REQUIRED,
          'INSUFFICIENT_CREDITS',
          'Balance cannot go negative',
        );
      }
      await tx.creditAccount.update({
        where: { tenantId },
        data: { available: { increment: input.amount } },
      });
      await this.creditLedger(
        tx,
        tenantId,
        'ADMIN_ADJUSTMENT',
        input.amount,
        `adjust:${randomUUID()}`,
        {
          userId,
          description: input.reason,
        },
      );
      await this.audit.record(tx, {
        action: 'credits.adjusted',
        tenantId,
        actorUserId: userId,
        targetType: 'credit_account',
        targetId: account.id,
        metadata: { amount: input.amount },
        requestId,
      });
    });
    return this.balance(tenantId);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Atomically moves one credit from available to reserved; fails at zero. */
  private async takeCredit(tx: Tx, tenantId: string): Promise<void> {
    const took = await tx.creditAccount.updateMany({
      where: { tenantId, available: { gte: 1 } },
      data: { available: { decrement: 1 }, reserved: { increment: 1 } },
    });
    if (took.count !== 1) throw insufficient();
  }

  private async findByKey(tx: Tx, tenantId: string, key: string): Promise<GenerationRef | null> {
    const gen = await tx.videoGeneration.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
    });
    return gen ? this.toRef(gen, true) : null;
  }

  private async findGeneration(tx: Tx, tenantId: string, id: string) {
    const gen = await tx.videoGeneration.findFirst({ where: { id, tenantId } });
    if (!gen) throw AppError.notFound('Generation not found');
    return gen;
  }

  /** The free-pool account a reservation was taken from, read from its ledger row. */
  private async reservationAccount(
    tx: Tx,
    tenantId: string,
    generationId: string,
  ): Promise<string> {
    const row = await tx.freeRegenerationLedger.findFirst({
      where: { tenantId, type: 'RESERVE', referenceId: generationId },
      select: { accountId: true },
    });
    if (!row) throw invalidState();
    return row.accountId;
  }

  /** Two requests with the same key can race past the replay check; the loser retries as a replay. */
  private async retryOnKeyRace<T extends GenerationRef>(
    tenantId: string,
    key: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.videoGeneration.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
        });
        if (existing) return this.toRef(existing, true) as T;
      }
      throw err;
    }
  }

  private toRef(
    gen: {
      id: string;
      videoProjectId: string;
      generationNumber: number;
      status: GenerationRef['status'];
      billingType: BillingType;
    },
    replayed: boolean,
  ): GenerationRef {
    return {
      id: gen.id,
      videoProjectId: gen.videoProjectId,
      generationNumber: gen.generationNumber,
      status: gen.status,
      billingType: gen.billingType,
      replayed,
    };
  }
}
