import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/bootstrap';
import { PrismaService } from '../src/infra/prisma.service';
import { RedisService } from '../src/infra/redis.service';

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
  await prisma.$executeRawUnsafe(
    'TRUNCATE audit_logs, invitations, subscriptions, memberships, sessions, tenants, users CASCADE',
  );
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
    .send({ name, email, password: PASSWORD })
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
