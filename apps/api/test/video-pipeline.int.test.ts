import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/prisma.service';
import {
  type Agent,
  createTenant,
  createTestApp,
  createTestWorker,
  registerAgent,
  resetState,
  scoped,
  subscribe,
  TURKISH_CSV,
  waitForImport,
} from './helpers';

const photo = (seed: number) =>
  sharp({
    create: {
      width: 1600,
      height: 1067,
      channels: 3,
      background: { r: seed * 30, g: 120, b: 180 },
    },
  })
    .jpeg()
    .toBuffer();

async function waitForGeneration(agent: Agent, tenantId: string, id: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await scoped(agent, tenantId).get(`/api/v1/video-generations/${id}`).expect(200);
    const stage = (res.body as { stage: string }).stage;
    if (stage === 'COMPLETED' || stage === 'FAILED') return res.body as Record<string, unknown>;
    if (Date.now() > deadline) throw new Error(`generation ${id} stuck at ${stage}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe('video pipeline (mock providers)', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let owner: Agent;
  let tenantId: string;
  let propertyId: string;
  const api = () => scoped(owner, tenantId);
  const prisma = () => app.get(PrismaService);

  async function balance() {
    const res = await api().get('/api/v1/credits').expect(200);
    return res.body as {
      credits: { available: number; reserved: number };
      freeRegenerations: { available: number; reserved: number };
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    worker = await createTestWorker();
  });
  afterEach(() => {
    delete process.env['MOCK_FAILURE_STAGE'];
  });
  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  beforeEach(async () => {
    await resetState(app);
    owner = (await registerAgent(app)).agent;
    tenantId = await createTenant(owner);
    await subscribe(app, tenantId, 'growth'); // 30 credits, 10 free regenerations
    const up = await api()
      .post('/api/v1/imports')
      .attach('file', Buffer.from(TURKISH_CSV), 'p.csv')
      .expect(201);
    await api()
      .post(`/api/v1/imports/${up.body.import.id}/commit`)
      .send({ mapping: up.body.suggestedMapping })
      .expect(202);
    await waitForImport(owner, tenantId, up.body.import.id);
    const list = await api().get('/api/v1/properties?q=P-100').expect(200);
    propertyId = list.body.items[0].id;
    for (let i = 0; i < 4; i++) {
      await api()
        .post(`/api/v1/properties/${propertyId}/assets`)
        .attach('files', await photo(i + 1), `p${i}.jpg`)
        .expect(201);
    }
  });

  it('runs a full mock pipeline and captures one credit (acceptance #5, mock)', async () => {
    const before = await balance();
    const res = await api()
      .post(`/api/v1/properties/${propertyId}/video-projects`)
      .set('Idempotency-Key', 'first-run-0001')
      .expect(201);
    const genId = res.body.generations[0].id as string;
    const done = await waitForGeneration(owner, tenantId, genId);

    expect(done).toMatchObject({
      stage: 'COMPLETED',
      progress: 100,
      status: 'CAPTURED',
      isMock: true,
      billingType: 'INITIAL_CREDIT',
    });
    const after = await balance();
    expect(after.credits.available).toBe(before.credits.available - 1);
    expect(after.credits.reserved).toBe(0);

    const scenes = await prisma().videoScene.findMany({ where: { videoGenerationId: genId } });
    expect(scenes.filter((s) => s.sceneType === 'AI_VIDEO').length).toBe(4); // 30 s policy
    expect(scenes.every((s) => s.status === 'DONE' || s.sceneType !== 'AI_VIDEO')).toBe(true);
    const usages = await prisma().providerUsage.findMany({ where: { videoGenerationId: genId } });
    expect(usages.length).toBeGreaterThan(0);
    expect(usages.every((u) => u.isMock)).toBe(true);
  });

  it('idempotency key: same request twice spends one credit and returns the same generation', async () => {
    const before = await balance();
    const first = await api()
      .post(`/api/v1/properties/${propertyId}/video-projects`)
      .set('Idempotency-Key', 'same-key-0002')
      .expect(201);
    const second = await api()
      .post(`/api/v1/properties/${propertyId}/video-projects`)
      .set('Idempotency-Key', 'same-key-0002')
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
    await waitForGeneration(owner, tenantId, first.body.generations[0].id);
    expect((await balance()).credits.available).toBe(before.credits.available - 1);
  });

  it('regeneration: first uses the free pool, second in the same project costs a credit, scenes are new (§3.7)', async () => {
    const created = await api()
      .post(`/api/v1/properties/${propertyId}/video-projects`)
      .set('Idempotency-Key', 'proj-create-03')
      .expect(201);
    const projectId = created.body.id as string;
    const g1 = created.body.generations[0].id as string;
    await waitForGeneration(owner, tenantId, g1);
    const start = await balance();

    const r1 = await api()
      .post(`/api/v1/video-projects/${projectId}/generations`)
      .set('Idempotency-Key', 'regen-one-0001')
      .expect(202);
    await waitForGeneration(owner, tenantId, r1.body.id);
    expect(r1.body.billingType).toBe('FREE_REGENERATION');
    const afterFree = await balance();
    expect(afterFree.freeRegenerations.available).toBe(start.freeRegenerations.available - 1);
    expect(afterFree.credits.available).toBe(start.credits.available);

    const r2 = await api()
      .post(`/api/v1/video-projects/${projectId}/generations`)
      .set('Idempotency-Key', 'regen-two-0002')
      .expect(202);
    await waitForGeneration(owner, tenantId, r2.body.id);
    expect(r2.body.billingType).toBe('PAID_REGENERATION');
    expect((await balance()).credits.available).toBe(start.credits.available - 1);

    const jobs = await prisma().videoScene.findMany({
      where: {
        videoGenerationId: { in: [g1, r1.body.id as string, r2.body.id as string] },
        externalJobId: { not: null },
      },
      select: { externalJobId: true },
    });
    const ids = jobs.map((j) => j.externalJobId);
    expect(new Set(ids).size).toBe(ids.length); // no provider job reused across generations
  }, 60_000); // three full renders, ~7 s each

  it('system failure refunds the credit and restores the free right (acceptance #10)', async () => {
    const start = await balance();
    process.env['MOCK_FAILURE_STAGE'] = 'GENERATING_AI_SCENES';
    const created = await api()
      .post(`/api/v1/properties/${propertyId}/video-projects`)
      .set('Idempotency-Key', 'failing-run-004')
      .expect(201);
    const failed = await waitForGeneration(owner, tenantId, created.body.generations[0].id);
    expect(failed).toMatchObject({
      stage: 'FAILED',
      status: 'RELEASED',
      failureCode: 'PROVIDER_JOB_FAILED',
    });
    expect(String(failed['failureMessage'])).not.toMatch(/mock|Error|stack/i);
    expect((await balance()).credits.available).toBe(start.credits.available);
    expect((await balance()).credits.reserved).toBe(0);

    // Project free right is released too, so the next regeneration can use it again.
    delete process.env['MOCK_FAILURE_STAGE'];
    const projectId = created.body.id as string;
    const retry = await api()
      .post(`/api/v1/video-projects/${projectId}/generations`)
      .set('Idempotency-Key', 'retry-after-fail-5')
      .expect(202);
    expect(retry.body.billingType).toBe('FREE_REGENERATION');
    await waitForGeneration(owner, tenantId, retry.body.id);
  });

  it('refuses to start without credits and creates nothing (acceptance #12)', async () => {
    await api()
      .post(`/api/v1/credits/adjustments`)
      .send({ amount: -30, reason: 'Test için bakiye sıfırlama' })
      .expect(201);
    const before = await prisma().videoProject.count({ where: { tenantId } });
    const res = await api()
      .post(`/api/v1/properties/${propertyId}/video-projects`)
      .set('Idempotency-Key', 'no-credit-key-6')
      .expect(402);
    expect(res.body.code).toBe('INSUFFICIENT_CREDITS');
    expect(await prisma().videoProject.count({ where: { tenantId } })).toBe(before);
  });

  it('refuses without an active plan and without photos', async () => {
    const other = await registerAgent(app);
    const otherTenant = await createTenant(other.agent, 'Planlı Değil');
    const up = await scoped(other.agent, otherTenant)
      .post('/api/v1/imports')
      .attach('file', Buffer.from(TURKISH_CSV), 'p.csv')
      .expect(201);
    await scoped(other.agent, otherTenant)
      .post(`/api/v1/imports/${up.body.import.id}/commit`)
      .send({ mapping: up.body.suggestedMapping })
      .expect(202);
    await waitForImport(other.agent, otherTenant, up.body.import.id);
    const list = await scoped(other.agent, otherTenant)
      .get('/api/v1/properties?q=P-100')
      .expect(200);
    const noPlanProperty = list.body.items[0].id as string;
    await scoped(other.agent, otherTenant)
      .post(`/api/v1/properties/${noPlanProperty}/assets`)
      .attach('files', await photo(9), 'x.jpg')
      .expect(201);
    const noPlan = await scoped(other.agent, otherTenant)
      .post(`/api/v1/properties/${noPlanProperty}/video-projects`)
      .set('Idempotency-Key', 'no-plan-key-0007')
      .expect(409);
    expect(noPlan.body.code).toBe('NO_ACTIVE_PLAN');

    const noPhotos = await api()
      .post(
        `/api/v1/properties/${(await api().get('/api/v1/properties?q=P-101').expect(200)).body.items[0].id}/video-projects`,
      )
      .set('Idempotency-Key', 'no-photos-key-8')
      .expect(422);
    expect(noPhotos.body.code).toBe('NO_PHOTOS');
  });

  it('requires an Idempotency-Key', async () => {
    const res = await api().post(`/api/v1/properties/${propertyId}/video-projects`).expect(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });
});
