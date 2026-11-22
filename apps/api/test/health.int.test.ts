import { healthResponseSchema } from '@app/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/bootstrap';

// Requires `pnpm services:up` (Postgres, Redis, object storage).
describe('GET /api/v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttpApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports every dependency as ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const body = healthResponseSchema.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.dependencies.database.status).toBe('ok');
    expect(body.dependencies.redis.status).toBe('ok');
    expect(body.dependencies.storage.status).toBe('ok');
  });

  it('echoes a safe caller request ID and mints one otherwise', async () => {
    const supplied = 'test-correlation-0001';
    const echoed = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', supplied);
    expect(echoed.headers['x-request-id']).toBe(supplied);

    const minted = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'bad id with spaces');
    expect(minted.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
