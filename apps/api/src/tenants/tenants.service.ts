import type { CreateTenantRequest, Member, TenantSummary } from '@app/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { makeSlug } from './slug';

const MAX_SLUG_ATTEMPTS = 3;

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Creates a workspace with the caller as OWNER, plus the configured signup subscription. */
  async create(
    userId: string,
    input: CreateTenantRequest,
    requestId: string | undefined,
  ): Promise<TenantSummary> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.createOnce(userId, input, requestId);
      } catch (err) {
        const slugClash =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!slugClash || attempt >= MAX_SLUG_ATTEMPTS) throw err;
      }
    }
  }

  private async createOnce(
    userId: string,
    input: CreateTenantRequest,
    requestId: string | undefined,
  ): Promise<TenantSummary> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.name, slug: makeSlug(input.name) },
      });
      await tx.membership.create({ data: { tenantId: tenant.id, userId, role: 'OWNER' } });
      await this.audit.record(tx, {
        action: 'tenant.created',
        tenantId: tenant.id,
        actorUserId: userId,
        targetType: 'tenant',
        targetId: tenant.id,
        requestId,
      });
      await this.startSignupSubscription(tx, tenant.id, userId, requestId);
      return { id: tenant.id, name: tenant.name, slug: tenant.slug, role: 'OWNER' as const };
    });
  }

  /**
   * SIGNUP_PLAN_CODE is a dev/pilot setting: the blueprint defines no free trial, so production
   * leaves it empty and subscriptions come from billing (later milestone).
   */
  private async startSignupSubscription(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    requestId: string | undefined,
  ): Promise<void> {
    const code = this.config.SIGNUP_PLAN_CODE;
    if (!code) return;
    const plan = await tx.plan.findUnique({ where: { code } });
    if (!plan || !plan.isActive) {
      this.logger.warn({ planCode: code }, 'SIGNUP_PLAN_CODE does not match an active plan');
      return;
    }
    const now = new Date();
    const subscription = await tx.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'TRIALING',
        currentPeriodStart: now,
        currentPeriodEnd: addMonths(now, 1),
      },
    });
    await this.audit.record(tx, {
      action: 'subscription.started',
      tenantId,
      actorUserId: userId,
      targetType: 'subscription',
      targetId: subscription.id,
      metadata: { planCode: plan.code, status: 'TRIALING', source: 'signup_config' },
      requestId,
    });
  }

  async members(tenantId: string): Promise<Member[]> {
    const rows = await this.prisma.membership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    return rows.map((m) => ({
      membershipId: m.id,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
      user: m.user,
    }));
  }
}
