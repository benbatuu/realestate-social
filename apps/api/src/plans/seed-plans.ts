import type { PrismaClient } from '../generated/prisma/client';
import { PLAN_CATALOG } from './plan-catalog';

/** Idempotent: upserts every catalogue plan by code. Safe to run on every deploy. */
export async function seedPlans(prisma: Pick<PrismaClient, 'plan'>): Promise<number> {
  for (const plan of PLAN_CATALOG) {
    const { features, code, ...rest } = plan;
    await prisma.plan.upsert({
      where: { code },
      create: { code, ...rest, featuresJson: features },
      update: { ...rest, featuresJson: features },
    });
  }
  return PLAN_CATALOG.length;
}
