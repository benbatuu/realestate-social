import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type Queue, QueueEvents } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';
import { redisConnectionOptions } from '../src/infra/redis';
import { QUEUES, queuePrefix, SYSTEM_JOBS } from '../src/queues/queues';
import { WorkerModule } from '../src/worker/worker.module';

// Requires `pnpm services:up`. Boots the real worker module and pushes a job through Redis.
describe('worker process', () => {
  let worker: INestApplicationContext;
  let events: QueueEvents;

  beforeAll(async () => {
    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
    await worker.init();
    const env = parseEnv(process.env);
    events = new QueueEvents(QUEUES.system, {
      connection: redisConnectionOptions(env.REDIS_URL),
      prefix: queuePrefix(env.NODE_ENV),
    });
    await events.waitUntilReady();
  });

  afterAll(async () => {
    await events?.close();
    await worker?.close();
  });

  it('processes a system noop job', async () => {
    const queue = worker.get<Queue>(getQueueToken(QUEUES.system));
    const job = await queue.add(SYSTEM_JOBS.noop, { echo: 'hello' });
    const result = await job.waitUntilFinished(events, 10_000);
    expect(result).toEqual({ ok: true, echo: 'hello' });
  });
});
