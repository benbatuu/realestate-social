import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import { PrismaService } from '../src/infra/prisma.service';
import { VIDEO_POLICY } from '../src/video/policy';
import { ProviderRegistry } from '../src/video/providers/registry';
import { ProviderError, type ImageToVideoProvider } from '../src/video/providers/types';
import { SpendGuard } from '../src/video/spend-guard.service';
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

/**
 * The paid image-to-video path (plan-08) with a scripted provider in place of OpenRouter: spend
 * guard, polling, fallback model, photo-motion fallback and the clip cache. No network calls.
 */

type Script = 'ok' | 'fail' | 'reject';

class StubI2V implements ImageToVideoProvider {
  readonly name = 'stub';
  submits = 0;
  private polls = new Map<string, number>();
  constructor(
    readonly model: string,
    private readonly clip: Buffer,
    public script: Script = 'ok',
    private readonly runningPolls = 1,
  ) {}
  async estimateCostMicroUsd(seconds: number) {
    return seconds * 100_000; // $0.10/s
  }
  async generate(input: { idempotencyKey: string; durationSeconds: number }) {
    if (this.script === 'reject') throw new ProviderError('PROVIDER_JOB_FAILED', false, 'http 400');
    this.submits++;
    const id = `${this.model}:${input.idempotencyKey}`;
    return {
      externalJobId: id,
      usage: {
        provider: this.name,
        model: this.model,
        operation: 'image_to_video',
        externalRequestId: id,
        units: input.durationSeconds,
        unitType: 'seconds' as const,
        estimatedCostMicroUsd: input.durationSeconds * 100_000,
        isMock: false,
      },
    };
  }
  async getJob(id: string) {
    const n = (this.polls.get(id) ?? 0) + 1;
    this.polls.set(id, n);
    if (n <= this.runningPolls) return { status: 'RUNNING' as const };
    if (this.script === 'fail') return { status: 'FAILED' as const, error: 'boom' };
    return { status: 'SUCCEEDED' as const, costMicroUsd: 450_000 };
  }
  async downloadOutput() {
    return this.clip;
  }
}

const photo = (seed: number) =>
  sharp({
    create: { width: 1600, height: 1067, channels: 3, background: { r: seed * 40, g: 90, b: 160 } },
  })
    .jpeg()
    .toBuffer();

async function waitForGeneration(agent: Agent, tenantId: string, id: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await scoped(agent, tenantId).get(`/api/v1/video-generations/${id}`).expect(200);
    const stage = (res.body as { stage: string }).stage;
    if (stage === 'COMPLETED' || stage === 'FAILED') return res.body as Record<string, unknown>;
    if (Date.now() > deadline) throw new Error(`generation ${id} stuck at ${stage}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe('video pipeline, paid image-to-video path (stub provider)', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let owner: Agent;
  let tenantId: string;
  let propertyId: string;
  let clip: Buffer;
  let primary: StubI2V;
  let fallback: StubI2V;
  let config: AppConfig;
  const original = { delay: VIDEO_POLICY.pollDelayMs };
  const api = () => scoped(owner, tenantId);
  const prisma = () => app.get(PrismaService);

  beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'clip-'));
    const out = path.join(dir, 'clip.mp4');
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=640x360:d=6:r=24',
      '-pix_fmt',
      'yuv420p',
      out,
    ]);
    clip = readFileSync(out);
    app = await createTestApp();
    worker = await createTestWorker();
    config = worker.get<AppConfig>(APP_CONFIG);
    (VIDEO_POLICY as { pollDelayMs: number }).pollDelayMs = 50;
  });
  afterAll(async () => {
    (VIDEO_POLICY as { pollDelayMs: number }).pollDelayMs = original.delay;
    await worker?.close();
    await app?.close();
  });

  beforeEach(async () => {
    await resetState(app);
    primary = new StubI2V('stub/primary', clip);
    fallback = new StubI2V('stub/fallback', clip);
    Object.assign(worker.get(ProviderRegistry), {
      imageToVideo: primary,
      imageToVideoFallback: fallback,
    });
    Object.assign(config, {
      AI_PAID_CALLS_ENABLED: true,
      AI_DAILY_BUDGET_USD: 100,
      AI_MONTHLY_BUDGET_USD: 100,
    });
    owner = (await registerAgent(app)).agent;
    tenantId = await createTenant(owner);
    await subscribe(app, tenantId, 'growth');
    const up = await api()
      .post('/api/v1/imports')
      .attach('file', Buffer.from(TURKISH_CSV), 'p.csv')
      .expect(201);
    await api()
      .post(`/api/v1/imports/${up.body.import.id}/commit`)
      .send({ mapping: up.body.suggestedMapping })
      .expect(202);
    await waitForImport(owner, tenantId, up.body.import.id);
    propertyId = (await api().get('/api/v1/properties?q=P-100').expect(200)).body.items[0].id;
    for (let i = 0; i < 4; i++) {
      await api()
        .post(`/api/v1/properties/${propertyId}/assets`)
        .attach('files', await photo(i + 1), `p${i}.jpg`)
        .expect(201);
    }
  });

  async function run(key: string) {
    const res = await api()
      .post(`/api/v1/properties/${propertyId}/video-projects`)
      .set('Idempotency-Key', key)
      .expect(201);
    const genId = res.body.generations[0].id as string;
    const done = await waitForGeneration(owner, tenantId, genId);
    const scenes = await prisma().videoScene.findMany({
      where: { videoGenerationId: genId },
      orderBy: { sceneNumber: 'asc' },
    });
    const paid = await prisma().providerUsage.findMany({
      where: { videoGenerationId: genId, isMock: false },
    });
    return { done, scenes, paid };
  }

  it('switch off: no paid call, AI scenes become photo motion, video completes', async () => {
    config.AI_PAID_CALLS_ENABLED = false;
    const { done, scenes, paid } = await run('paid-off-0001');
    expect(done.stage).toBe('COMPLETED');
    expect(primary.submits).toBe(0);
    expect(paid).toHaveLength(0);
    expect(scenes.every((s) => s.sceneType === 'PHOTO_MOTION')).toBe(true);
  });

  it('waits on a running job, stores the clip and records the billed cost', async () => {
    const { done, scenes, paid } = await run('paid-ok-0002');
    expect(done.stage).toBe('COMPLETED');
    const ai = scenes.filter((s) => s.sceneType === 'AI_VIDEO');
    expect(ai).toHaveLength(4);
    expect(
      ai.every((s) => s.status === 'DONE' && s.clipStorageKey && s.model === 'stub/primary'),
    ).toBe(true);
    expect(paid).toHaveLength(4);
    expect(paid.every((u) => u.status === 'SUCCEEDED' && u.actualCostMicroUsd === 450_000)).toBe(
      true,
    );
  });

  it('a failed clip is made once more on the fallback model', async () => {
    primary.script = 'fail';
    const { done, scenes } = await run('paid-fb-0003');
    expect(done.stage).toBe('COMPLETED');
    const ai = scenes.filter((s) => s.sceneType === 'AI_VIDEO');
    expect(ai).toHaveLength(4);
    expect(ai.every((s) => s.model === 'stub/fallback' && s.clipStorageKey)).toBe(true);
  });

  it('when both models fail, the scene shows the photo and the video still completes', async () => {
    primary.script = 'fail';
    fallback.script = 'reject';
    const { done, scenes } = await run('paid-both-0004');
    expect(done.stage).toBe('COMPLETED');
    expect(scenes.every((s) => s.sceneType === 'PHOTO_MOTION')).toBe(true);
  });

  it('the daily cap refuses clips that would pass it', async () => {
    config.AI_DAILY_BUDGET_USD = 1.2; // room for two 5 s clips at $0.50 each
    const { done, scenes, paid } = await run('paid-cap-0005');
    expect(done.stage).toBe('COMPLETED');
    expect(scenes.filter((s) => s.sceneType === 'AI_VIDEO')).toHaveLength(2);
    expect(paid).toHaveLength(2);
  });

  it('a second project on the same photos reuses the clips without paying again', async () => {
    await run('paid-cache-0006');
    expect(primary.submits).toBe(4);
    const second = await run('paid-cache-0007');
    expect(second.done.stage).toBe('COMPLETED');
    expect(primary.submits).toBe(4);
    expect(second.paid).toHaveLength(0);
    expect(
      second.scenes.filter((s) => s.sceneType === 'AI_VIDEO' && s.clipStorageKey),
    ).toHaveLength(4);
  });
});

describe('SpendGuard', () => {
  let app: INestApplication;
  let guard: SpendGuard;
  let config: AppConfig;
  let genId: string;
  let tenantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    guard = app.get(SpendGuard);
    config = app.get<AppConfig>(APP_CONFIG);
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    await resetState(app);
    const owner = (await registerAgent(app)).agent;
    tenantId = await createTenant(owner);
    const prisma = app.get(PrismaService);
    const property = await prisma.property.create({
      data: { tenantId, title: 'Test', listingType: 'SALE' } as never,
    });
    const project = await prisma.videoProject.create({
      data: { tenantId, propertyId: property.id, title: 'x' },
    });
    genId = (
      await prisma.videoGeneration.create({
        data: {
          tenantId,
          videoProjectId: project.id,
          generationNumber: 1,
          status: 'RESERVED',
          billingType: 'INITIAL_CREDIT',
          idempotencyKey: 'k',
        } as never,
      })
    ).id;
    Object.assign(config, {
      AI_PAID_CALLS_ENABLED: true,
      AI_DAILY_BUDGET_USD: 1,
      AI_MONTHLY_BUDGET_USD: 2,
    });
  });

  const ask = (micro: number) =>
    guard.reserve({
      tenantId,
      generationId: genId,
      provider: 'p',
      model: 'm',
      operation: 'image_to_video',
      units: 5,
      unitType: 'seconds',
      estimateMicroUsd: micro,
    });

  it('refuses everything while the switch is off', async () => {
    config.AI_PAID_CALLS_ENABLED = false;
    expect(await ask(1)).toEqual({ ok: false, reason: 'disabled' });
  });

  it('reserves under the cap and refuses past the daily cap', async () => {
    expect((await ask(600_000)).ok).toBe(true);
    expect(await ask(600_000)).toEqual({ ok: false, reason: 'daily_cap' });
  });

  it('counts the billed cost in place of the estimate, and ignores refused submits', async () => {
    const first = await ask(900_000);
    if (!first.ok) throw new Error('expected a reservation');
    await guard.settle(first.usageId, { status: 'SUCCEEDED', actualMicroUsd: 100_000 });
    const second = await ask(800_000);
    if (!second.ok) throw new Error('expected a reservation');
    await guard.settle(second.usageId, { status: 'REFUSED', actualMicroUsd: 0 });
    expect((await ask(800_000)).ok).toBe(true);
  });

  it('refuses past the monthly cap even with daily room', async () => {
    config.AI_DAILY_BUDGET_USD = 10;
    const prisma = app.get(PrismaService);
    const lastWeek = new Date(Date.now() - 7 * 86_400_000);
    const sameMonth = lastWeek.getUTCMonth() === new Date().getUTCMonth();
    await prisma.providerUsage.create({
      data: {
        tenantId,
        videoGenerationId: genId,
        provider: 'p',
        model: 'm',
        operation: 'image_to_video',
        units: 5,
        unitType: 'seconds',
        estimatedCostMicroUsd: 1_900_000,
        status: 'SUCCEEDED',
        isMock: false,
        createdAt: sameMonth ? lastWeek : new Date(),
      },
    });
    expect(await ask(200_000)).toEqual({ ok: false, reason: 'monthly_cap' });
  });
});
