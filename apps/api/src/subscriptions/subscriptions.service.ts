import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { PackageOption, PlanSummary, SubscriptionView } from '@app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/http/app-error';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PrismaService } from '../infra/prisma.service';

const ACTIVE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

type PlanRow = {
  id: string;
  code: string;
  name: string;
  monthlyPriceMinor: number;
  currency: string;
  monthlyCredits: number;
  freeRegenerationAllowance: number;
  maxSeats: number;
  maxWorkspaces: number;
  maxCrmConnections: number;
  retentionDays: number;
  featuresJson: unknown;
};

function toPlan(p: PlanRow): PlanSummary {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    monthlyPriceMinor: p.monthlyPriceMinor,
    currency: p.currency,
    monthlyCredits: p.monthlyCredits,
    freeRegenerationAllowance: p.freeRegenerationAllowance,
    maxSeats: p.maxSeats,
    maxWorkspaces: p.maxWorkspaces,
    maxCrmConnections: p.maxCrmConnections,
    retentionDays: p.retentionDays,
    features: p.featuresJson as PlanSummary['features'],
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly credits: CreditsService,
  ) {}

  /** The workspace's package, what is pending, usage, and every package with what it would take. */
  async view(tenantId: string): Promise<SubscriptionView> {
    const [sub, plans, usage] = await Promise.all([
      this.activeSubscription(tenantId),
      this.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { monthlyPriceMinor: 'asc' },
      }),
      this.usage(tenantId),
    ]);
    const current = sub?.plan ? toPlan(sub.plan as PlanRow) : null;
    const pending =
      sub?.pendingPlan && sub.planChangeAt
        ? { plan: toPlan(sub.pendingPlan as PlanRow), effectiveAt: sub.planChangeAt.toISOString() }
        : null;
    return {
      current,
      status: sub?.status ?? null,
      periodEnd: sub?.currentPeriodEnd.toISOString() ?? null,
      pending,
      usage,
      options: plans.map((p) => this.option(toPlan(p), current, usage)),
    };
  }

  /**
   * Upgrade: applies now, clears any pending downgrade. Downgrade: applies at period end, refused
   * while usage is above the smaller package. With no package yet, starts one (no payment yet).
   */
  async change(
    tenantId: string,
    userId: string,
    planCode: string,
    requestId: string | undefined,
  ): Promise<SubscriptionView> {
    const target = await this.prisma.plan.findFirst({ where: { code: planCode, isActive: true } });
    if (!target) throw AppError.notFound('Package not found');
    const sub = await this.activeSubscription(tenantId);
    const now = new Date();

    if (!sub) {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.subscription.create({
          data: {
            tenantId,
            planId: target.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + MONTH_MS),
          },
        });
        await this.audit.record(tx, {
          action: 'subscription.started',
          tenantId,
          actorUserId: userId,
          targetType: 'subscription',
          targetId: created.id,
          metadata: { planCode: target.code, status: 'ACTIVE', source: 'plan_selection' },
          requestId,
        });
      });
      return this.view(tenantId);
    }

    if (sub.planId === target.id) {
      if (!sub.pendingPlanId)
        throw new AppError(HttpStatus.CONFLICT, 'VALIDATION_FAILED', 'Bu zaten mevcut paketiniz.');
      // Keeping the current package cancels a pending downgrade to another one.
      return this.cancelPendingInternal(tenantId, userId, sub.id, requestId);
    }

    const currentPrice = sub.plan.monthlyPriceMinor;
    if (target.monthlyPriceMinor > currentPrice) {
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { planId: target.id, pendingPlanId: null, planChangeAt: null },
        });
        // The new package's extra monthly credits are available now, not next period.
        await this.credits.grantUpgradeDifference(
          tx,
          tenantId,
          target.monthlyCredits - sub.plan.monthlyCredits,
          `upgrade:${sub.id}:${target.id}`,
          `${target.name} yükseltme farkı`,
        );
        await this.audit.record(tx, {
          action: 'subscription.upgraded',
          tenantId,
          actorUserId: userId,
          targetType: 'subscription',
          targetId: sub.id,
          metadata: { fromPlan: sub.plan.code, toPlan: target.code },
          requestId,
        });
      });
      await this.notifications.notifyTeam(tenantId, {
        kind: 'subscription.changed',
        title: 'Paket yükseltildi',
        body: `${sub.plan.name} → ${target.name}`,
        link: '/billing',
      });
      return this.view(tenantId);
    }

    const usage = await this.usage(tenantId);
    const blockers = this.blockers(toPlan(target as PlanRow), usage);
    if (blockers.length > 0) {
      throw new AppError(
        HttpStatus.CONFLICT,
        'SEAT_LIMIT_REACHED',
        `Bu pakete geçilemez: ${blockers.join(' ')}`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { pendingPlanId: target.id, planChangeAt: sub.currentPeriodEnd },
      });
      await this.audit.record(tx, {
        action: 'subscription.downgrade_scheduled',
        tenantId,
        actorUserId: userId,
        targetType: 'subscription',
        targetId: sub.id,
        metadata: { fromPlan: sub.plan.code, toPlan: target.code },
        requestId,
      });
    });
    await this.notifications.notifyTeam(tenantId, {
      kind: 'subscription.changed',
      title: 'Paket düşürme planlandı',
      body: `${target.name} paketine ${sub.currentPeriodEnd.toLocaleDateString('tr-TR')} tarihinde geçilecek.`,
      link: '/billing',
    });
    return this.view(tenantId);
  }

  async cancelPending(
    tenantId: string,
    userId: string,
    requestId: string | undefined,
  ): Promise<SubscriptionView> {
    const sub = await this.activeSubscription(tenantId);
    if (!sub || !sub.pendingPlanId) throw AppError.notFound('No pending change');
    return this.cancelPendingInternal(tenantId, userId, sub.id, requestId);
  }

  /** Hourly: a downgrade whose day has come takes effect. Idempotent. */
  async applyDueChanges(): Promise<number> {
    const due = await this.prisma.subscription.findMany({
      where: { pendingPlanId: { not: null }, planChangeAt: { lte: new Date() } },
      select: { id: true, tenantId: true, pendingPlanId: true, plan: { select: { code: true } } },
    });
    for (const sub of due) {
      const next = await this.prisma.plan.findUnique({
        where: { id: sub.pendingPlanId as string },
        select: { code: true },
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { planId: sub.pendingPlanId as string, pendingPlanId: null, planChangeAt: null },
        });
        await this.audit.record(tx, {
          action: 'subscription.downgraded',
          tenantId: sub.tenantId,
          targetType: 'subscription',
          targetId: sub.id,
          metadata: { fromPlan: sub.plan.code, toPlan: next?.code ?? null },
        });
      });
      await this.notifications.notifyTeam(sub.tenantId, {
        kind: 'subscription.changed',
        title: 'Paket düşürüldü',
        body: `Yeni paket: ${next?.code ?? '—'}`,
        link: '/billing',
      });
    }
    return due.length;
  }

  private async cancelPendingInternal(
    tenantId: string,
    userId: string,
    subId: string,
    requestId: string | undefined,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subId },
        data: { pendingPlanId: null, planChangeAt: null },
      });
      await this.audit.record(tx, {
        action: 'subscription.downgrade_cancelled',
        tenantId,
        actorUserId: userId,
        targetType: 'subscription',
        targetId: subId,
        requestId,
      });
    });
    return this.view(tenantId);
  }

  private option(
    plan: PlanSummary,
    current: PlanSummary | null,
    usage: { seats: number; crmConnections: number },
  ): PackageOption {
    if (!current) return { plan, relation: 'upgrade', blockers: [] };
    if (plan.id === current.id) return { plan, relation: 'current', blockers: [] };
    if (plan.monthlyPriceMinor > current.monthlyPriceMinor)
      return { plan, relation: 'upgrade', blockers: [] };
    return { plan, relation: 'downgrade', blockers: this.blockers(plan, usage) };
  }

  private blockers(plan: PlanSummary, usage: { seats: number; crmConnections: number }): string[] {
    const out: string[] = [];
    if (usage.seats > plan.maxSeats)
      out.push(
        `Önce ${usage.seats - plan.maxSeats} kullanıcıyı çıkarın (en fazla ${plan.maxSeats}).`,
      );
    if (usage.crmConnections > plan.maxCrmConnections) {
      out.push(
        `Önce ${usage.crmConnections - plan.maxCrmConnections} CRM bağlantısını kaldırın (en fazla ${plan.maxCrmConnections}).`,
      );
    }
    return out;
  }

  private async usage(tenantId: string) {
    const [seats, crm] = await Promise.all([
      this.entitlements.seatUsage(tenantId).then((u) => u.members + u.pendingInvitations),
      this.prisma.crmConnection.count({ where: { tenantId, systemKey: null } }),
    ]);
    return { seats, crmConnections: crm };
  }

  private activeSubscription(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true, pendingPlan: true },
    });
  }
}
