import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CreditsService } from '../src/credits/credits.service';
import { PrismaService } from '../src/infra/prisma.service';
import {
  type Agent,
  createTenant,
  createTestApp,
  registerAgent,
  resetState,
  scoped,
  subscribe,
  uniqueEmail,
} from './helpers';

/** Blueprint §4 rules, checked against the real service and database. */
describe('credits and free regenerations (blueprint §4)', () => {
  let app: INestApplication;
  let owner: Agent;
  let tenantId: string;
  let ownerId: string;
  const credits = () => app.get(CreditsService);
  const prisma = () => app.get(PrismaService);

  async function ledgerSum(): Promise<number> {
    const rows = await prisma().creditLedger.findMany({
      where: { tenantId },
      select: { amount: true },
    });
    return rows.reduce((sum, r) => sum + r.amount, 0);
  }

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app?.close());

  beforeEach(async () => {
    await resetState(app);
    const user = await registerAgent(app, uniqueEmail('credits'));
    owner = user.agent;
    ownerId = user.userId;
    tenantId = await createTenant(owner);
    await subscribe(app, tenantId, 'growth'); // 30 credits, 10 free regenerations
  });

  it('grants the period once: monthly credits and free regenerations', async () => {
    const b = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(b.body.credits).toMatchObject({ monthly: 30, available: 30, reserved: 0 });
    expect(b.body.freeRegenerations).toMatchObject({ granted: 10, available: 10, reserved: 0 });
    await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    const grants = await prisma().creditLedger.count({ where: { tenantId, type: 'GRANT' } });
    expect(grants).toBe(1);
  });

  it('reserve then release restores the credit (acceptance #10 rule)', async () => {
    const project = await prisma().property.create({
      data: { tenantId, title: 'Test', listingType: 'SALE' },
    });
    const gen = await credits().reserveNewProject(
      tenantId,
      ownerId,
      project.id,
      'reserve-release-01',
      30,
    );
    expect(gen.billingType).toBe('INITIAL_CREDIT');
    let b = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(b.body.credits).toMatchObject({ available: 29, reserved: 1 });

    await credits().release(tenantId, gen.id, 'test');
    b = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(b.body.credits).toMatchObject({ available: 30, reserved: 0 });
    // Idempotent: a second release changes nothing.
    await credits().release(tenantId, gen.id, 'test');
    b = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(b.body.credits.available).toBe(30);
  });

  it('capture keeps the charge and consumes the reservation', async () => {
    const project = await prisma().property.create({
      data: { tenantId, title: 'Test', listingType: 'SALE' },
    });
    const gen = await credits().reserveNewProject(
      tenantId,
      ownerId,
      project.id,
      'capture-keep-0001',
      30,
    );
    await credits().capture(tenantId, gen.id);
    const b = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(b.body.credits).toMatchObject({ available: 29, reserved: 0 });
  });

  it('free regeneration: first in a project uses the pool, the second costs a credit, and the project flag is claimed once (acceptance #6, #8, #11)', async () => {
    const project = await prisma().property.create({
      data: { tenantId, title: 'Test', listingType: 'SALE' },
    });
    const first = await credits().reserveNewProject(
      tenantId,
      ownerId,
      project.id,
      'proj-first-00001',
      30,
    );
    await credits().capture(tenantId, first.id);
    const vp = first.videoProjectId;

    const r1 = await credits().reserveRegeneration(tenantId, ownerId, vp, 'regen-free-000001', 30);
    expect(r1.billingType).toBe('FREE_REGENERATION');
    const r2 = await credits().reserveRegeneration(tenantId, ownerId, vp, 'regen-paid-000002', 30);
    expect(r2.billingType).toBe('PAID_REGENERATION');

    const b = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(b.body.freeRegenerations).toMatchObject({ available: 9, reserved: 1 });
    expect(b.body.credits).toMatchObject({ available: 28, reserved: 1 });
  });

  it('parallel requests cannot both take the one free regeneration (acceptance #11)', async () => {
    const project = await prisma().property.create({
      data: { tenantId, title: 'Test', listingType: 'SALE' },
    });
    const first = await credits().reserveNewProject(
      tenantId,
      ownerId,
      project.id,
      'par-first-000001',
      30,
    );
    await credits().capture(tenantId, first.id);
    const vp = first.videoProjectId;

    const results = await Promise.allSettled([
      credits().reserveRegeneration(tenantId, ownerId, vp, 'par-a-00000000001', 30),
      credits().reserveRegeneration(tenantId, ownerId, vp, 'par-b-00000000002', 30),
    ]);
    const billing = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.billingType] : []));
    expect(billing.filter((b) => b === 'FREE_REGENERATION')).toHaveLength(1);
    expect(billing.length).toBe(2);
  });

  it('refuses at zero credits and creates nothing (acceptance #12)', async () => {
    await scoped(owner, tenantId)
      .post('/api/v1/credits/adjustments')
      .send({ amount: -30, reason: 'Test için sıfırlama' })
      .expect(201);
    const project = await prisma().property.create({
      data: { tenantId, title: 'Test', listingType: 'SALE' },
    });
    await expect(
      credits().reserveNewProject(tenantId, ownerId, project.id, 'zero-credit-00001', 30),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    });
    expect(await prisma().videoProject.count({ where: { propertyId: project.id } })).toBe(0);
  });

  it('the ledger always reconciles with the balance (§4.5)', async () => {
    const project = await prisma().property.create({
      data: { tenantId, title: 'Test', listingType: 'SALE' },
    });
    const gen = await credits().reserveNewProject(
      tenantId,
      ownerId,
      project.id,
      'recon-0000000001',
      30,
    );
    await credits().capture(tenantId, gen.id);
    await scoped(owner, tenantId)
      .post('/api/v1/credits/adjustments')
      .send({ amount: 5, reason: 'Hediye kredi' })
      .expect(201);
    const account = await prisma().creditAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(await ledgerSum()).toBe(account.available);
  });

  it('a new period expires the leftovers and grants the new allowance once (§4.7)', async () => {
    await scoped(owner, tenantId)
      .post('/api/v1/credits/adjustments')
      .send({ amount: 5, reason: 'Dönem öncesi düzeltme' })
      .expect(201);
    const before = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(before.body.credits.available).toBe(35);

    // Move the subscription to a new period: next read rolls it over.
    const sub = await prisma().subscription.findFirstOrThrow({ where: { tenantId } });
    await prisma().subscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: new Date(sub.currentPeriodStart.getTime() + 30 * 24 * 3600 * 1000),
        currentPeriodEnd: new Date(sub.currentPeriodEnd.getTime() + 30 * 24 * 3600 * 1000),
      },
    });
    const after = await scoped(owner, tenantId).get('/api/v1/credits').expect(200);
    expect(after.body.credits.available).toBe(30);
    expect(after.body.freeRegenerations).toMatchObject({ available: 10, granted: 10 });
    expect(await prisma().creditLedger.count({ where: { tenantId, type: 'EXPIRE' } })).toBe(1);
  });

  it('only the owner can adjust, and the balance cannot go negative', async () => {
    const email = uniqueEmail('admin');
    const invite = await owner
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email, role: 'ADMIN' })
      .expect(201);
    const admin = await registerAgent(app, email);
    await admin.agent
      .post('/api/v1/invitations/accept')
      .send({ token: new URL(invite.body.acceptUrl).hash.replace('#token=', '') })
      .expect(200);
    await scoped(admin.agent, tenantId)
      .post('/api/v1/credits/adjustments')
      .send({ amount: 1, reason: 'Yönetici deneme' })
      .expect(403);
    const neg = await scoped(owner, tenantId)
      .post('/api/v1/credits/adjustments')
      .send({ amount: -999, reason: 'Fazla düşüş' })
      .expect(402);
    expect(neg.body.code).toBe('INSUFFICIENT_CREDITS');
  });
});
