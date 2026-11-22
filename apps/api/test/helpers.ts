import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TEST_TABLES } from '../scripts/prepare-test-db';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/bootstrap';
import { PrismaService } from '../src/infra/prisma.service';
import { RedisService } from '../src/infra/redis.service';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { WorkerModule } from '../src/worker/worker.module';

export type Agent = ReturnType<typeof request.agent>;

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configureHttpApp(app);
  await app.init();
  return app;
}

/** Empties every table except the seeded plan catalogue, plus test login-throttle counters. */
export async function resetState(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(`TRUNCATE ${TEST_TABLES} CASCADE`);
  const redis = app.get(RedisService);
  await redis.ensureConnected();
  const keys = await redis.client.keys('test:login-fail:*');
  if (keys.length) await redis.client.del(...keys);
}

let counter = 0;
export function uniqueEmail(label = 'user'): string {
  counter += 1;
  return `${label}.${Date.now()}.${counter}@example.test`;
}

export const PASSWORD = 'correct-horse-battery';

/** Registers a user and returns a cookie-carrying agent. */
export async function registerAgent(
  app: INestApplication,
  email = uniqueEmail(),
  name = 'Test User',
): Promise<{ agent: Agent; email: string; userId: string }> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ name, email, password: PASSWORD, acceptTerms: true, marketingConsent: false })
    .expect(201);
  return { agent, email, userId: (res.body as { user: { id: string } }).user.id };
}

export async function createTenant(agent: Agent, name = 'Test Ofis'): Promise<string> {
  const res = await agent.post('/api/v1/tenants').send({ name }).expect(201);
  return (res.body as { id: string }).id;
}

/** Gives a tenant an active subscription to a seeded plan (tests opt in to plans explicitly). */
export async function subscribe(app: INestApplication, tenantId: string, planCode: string) {
  const prisma = app.get(PrismaService);
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: planCode } });
  const now = new Date();
  await prisma.subscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(now.getTime() - 60_000),
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
    },
  });
}

export function tokenFromAcceptUrl(acceptUrl: string): string {
  const token = new URL(acceptUrl).hash.replace(/^#token=/, '');
  if (!token) throw new Error('no token in accept URL');
  return token;
}

/** The real worker process module, for tests that need queued jobs (imports) to run. */
export async function createTestWorker(): Promise<INestApplicationContext> {
  const worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  await worker.init();
  return worker;
}

/** Calls an X-Tenant-Id scoped route. */
export function scoped(agent: Agent, tenantId: string) {
  return {
    get: (url: string) => agent.get(url).set('X-Tenant-Id', tenantId),
    post: (url: string) => agent.post(url).set('X-Tenant-Id', tenantId),
    delete: (url: string) => agent.delete(url).set('X-Tenant-Id', tenantId),
    patch: (url: string) => agent.patch(url).set('X-Tenant-Id', tenantId),
  };
}

/** Polls an import until it leaves QUEUED/RUNNING. */
export async function waitForImport(
  agent: Agent,
  tenantId: string,
  id: string,
  timeoutMs = 20_000,
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await scoped(agent, tenantId).get(`/api/v1/imports/${id}`).expect(200);
    const status = (res.body as { status: string }).status;
    if (!['QUEUED', 'RUNNING'].includes(status)) return res.body as Record<string, unknown>;
    if (Date.now() > deadline) throw new Error(`import ${id} still ${status}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

export const TURKISH_CSV = [
  'Portföy No;İlan Başlığı;İşlem Türü;Fiyat;Oda Sayısı;Brüt m²;İl;İlçe;Mahalle;Sahibi Telefon',
  "P-100;Moda'da deniz manzaralı 3+1;Satılık;12.500.000 TL;3+1;145;İstanbul;Kadıköy;Caferağa;0532 111 22 33",
  'P-101;Bahçeli 2+1 kiralık;Kiralık;35.000 TL;2+1;95;İstanbul;Kadıköy;Fenerbahçe;0533 444 55 66',
  'P-102;Hatalı fiyat;Satılık;4.50;3+1;120;İstanbul;Üsküdar;;0534 777 88 99',
  'P-103;Ofis katı;Devren;1.000.000 TL;;;İstanbul;Şişli;;',
].join('\n');
