import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';

interface OpenApiDoc {
  paths: Record<
    string,
    Record<
      string,
      {
        requestBody?: {
          content: Record<string, { schema: { properties?: Record<string, unknown> } }>;
        };
      }
    >
  >;
}

describe('OpenAPI document', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app?.close());

  it('documents every M1 route, with Zod-derived request bodies', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/docs-json').expect(200);
    const doc = res.body as OpenApiDoc;
    const expected: [string, string][] = [
      ['/api/v1/auth/register', 'post'],
      ['/api/v1/auth/login', 'post'],
      ['/api/v1/auth/logout', 'post'],
      ['/api/v1/auth/me', 'get'],
      ['/api/v1/tenants', 'get'],
      ['/api/v1/tenants', 'post'],
      ['/api/v1/tenants/{tenantId}/members', 'get'],
      ['/api/v1/tenants/{tenantId}/entitlements', 'get'],
      ['/api/v1/tenants/{tenantId}/invitations', 'get'],
      ['/api/v1/tenants/{tenantId}/invitations', 'post'],
      ['/api/v1/invitations/preview', 'post'],
      ['/api/v1/invitations/accept', 'post'],
      ['/api/v1/health', 'get'],
    ];
    for (const [path, method] of expected) {
      expect(doc.paths[path]?.[method], `${method.toUpperCase()} ${path}`).toBeDefined();
    }
    const register = doc.paths['/api/v1/auth/register']?.['post']?.requestBody;
    const props = register?.content['application/json']?.schema.properties ?? {};
    expect(Object.keys(props).sort()).toEqual(['email', 'name', 'password']);
  });
});
