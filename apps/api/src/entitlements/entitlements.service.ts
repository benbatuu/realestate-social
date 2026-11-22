import type { Entitlements } from '@app/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';

export interface PlanLimits {
  maxPhotosPerProperty: number;
  planCode: string | null;
  planName: string | null;
  priceMinor: number | null;
  currency: string | null;
  maxSeats: number;
  monthlyCredits: number;
  freeRegenerationAllowance: number;
  maxWorkspaces: number;
  maxCrmConnections: number;
  retentionDays: number;
  features: Entitlements['features'];
}

const NO_FEATURES: Entitlements['features'] = {
  dualFormat: false,
  portfolioAnalytics: 'none',
  teamReport: 'none',
  brandKits: 0,
  priorityQueue: false,
  apiAccess: 'none',
};

/**
 * Limits for a workspace with no usable subscription. The blueprint defines no free tier, so
 * this only lets the owner sign in and look around: one seat, nothing billable.
 */
export const NO_PLAN_LIMITS: PlanLimits = {
  maxPhotosPerProperty: 0,
  planCode: null,
  planName: null,
  priceMinor: null,
  currency: null,
  maxSeats: 1,
  monthlyCredits: 0,
  freeRegenerationAllowance: 0,
  maxWorkspaces: 1,
  maxCrmConnections: 0,
  retentionDays: 0,
  features: NO_FEATURES,
};

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
      select: { plan: true },
    });
    if (!subscription) return NO_PLAN_LIMITS;
    const { plan } = subscription;
    const f = (plan.featuresJson ?? {}) as Partial<Entitlements['features']>;
    return {
      planCode: plan.code,
      planName: plan.name,
      priceMinor: plan.monthlyPriceMinor,
      currency: plan.currency,
      maxSeats: plan.maxSeats,
      maxPhotosPerProperty: plan.maxPhotosPerProperty,
      monthlyCredits: plan.monthlyCredits,
      freeRegenerationAllowance: plan.freeRegenerationAllowance,
      maxWorkspaces: plan.maxWorkspaces,
      maxCrmConnections: plan.maxCrmConnections,
      retentionDays: plan.retentionDays,
      features: {
        dualFormat: f.dualFormat ?? true,
        portfolioAnalytics: f.portfolioAnalytics ?? 'basic',
        teamReport: f.teamReport ?? 'none',
        brandKits: f.brandKits ?? 0,
        priorityQueue: f.priorityQueue ?? false,
        apiAccess: f.apiAccess ?? 'none',
      },
    };
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
    const [limits, usage, crm] = await Promise.all([
      this.limits(tenantId),
      this.seatUsage(tenantId),
      this.prisma.crmConnection.count({ where: { tenantId, systemKey: null } }),
    ]);
    return {
      planCode: limits.planCode,
      planName: limits.planName,
      priceMinor: limits.priceMinor,
      currency: limits.currency,
      maxSeats: limits.maxSeats,
      usedSeats: usage.members,
      pendingInvitations: usage.pendingInvitations,
      monthlyCredits: limits.monthlyCredits,
      freeRegenerationAllowance: limits.freeRegenerationAllowance,
      maxWorkspaces: limits.maxWorkspaces,
      maxCrmConnections: limits.maxCrmConnections,
      usedCrmConnections: crm,
      retentionDays: limits.retentionDays,
      features: limits.features,
    };
  }
}
