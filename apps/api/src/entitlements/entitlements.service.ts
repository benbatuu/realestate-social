import type { Entitlements } from '@app/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';

export interface PlanLimits {
  planCode: string | null;
  planName: string | null;
  maxSeats: number;
}

/**
 * Limits for a workspace with no usable subscription. The blueprint defines no free tier, so
 * this only lets the owner sign in and look around: one seat, nothing billable.
 */
export const NO_PLAN_LIMITS: PlanLimits = { planCode: null, planName: null, maxSeats: 1 };

const USABLE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;

/** Reads plan limits from the database (§10.1: limits are never hard-coded in the frontend). */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async limits(tenantId: string, tx: Prisma.TransactionClient = this.prisma): Promise<PlanLimits> {
    const now = new Date();
    const subscription = await tx.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [...USABLE_STATUSES] },
        currentPeriodStart: { lte: now },
        currentPeriodEnd: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { plan: { select: { code: true, name: true, maxSeats: true } } },
    });
    if (!subscription) return NO_PLAN_LIMITS;
    const { plan } = subscription;
    return { planCode: plan.code, planName: plan.name, maxSeats: plan.maxSeats };
  }

  async seatUsage(
    tenantId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{ members: number; pendingInvitations: number }> {
    const [members, pendingInvitations] = await Promise.all([
      tx.membership.count({ where: { tenantId } }),
      tx.invitation.count({
        where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
      }),
    ]);
    return { members, pendingInvitations };
  }

  async summary(tenantId: string): Promise<Entitlements> {
    const [limits, usage] = await Promise.all([this.limits(tenantId), this.seatUsage(tenantId)]);
    return {
      planCode: limits.planCode,
      planName: limits.planName,
      maxSeats: limits.maxSeats,
      usedSeats: usage.members,
      pendingInvitations: usage.pendingInvitations,
    };
  }
}
