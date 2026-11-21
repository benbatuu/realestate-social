import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Agent,
  createTenant,
  createTestApp,
  registerAgent,
  resetState,
  subscribe,
  uniqueEmail,
} from './helpers';

/**
 * Blueprint §15.3 #13: a user of tenant A cannot reach tenant B. Every tenant-scoped route is
 * listed here; adding a tenant-scoped route without adding it to this table should fail review.
 */
const TENANT_ROUTES: { method: 'get' | 'post'; path: (id: string) => string; body?: object }[] = [
  { method: 'get', path: (id) => `/api/v1/tenants/${id}/members` },
  { method: 'get', path: (id) => `/api/v1/tenants/${id}/entitlements` },
  { method: 'get', path: (id) => `/api/v1/tenants/${id}/invitations` },
  {
    method: 'post',
    path: (id) => `/api/v1/tenants/${id}/invitations`,
    body: { email: 'x@example.test', role: 'MEMBER' },
  },
];

describe('acceptance #13: tenant isolation', () => {
  let app: INestApplication;
  let a: Agent;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetState(app);
    const userA = await registerAgent(app, uniqueEmail('a'));
    const userB = await registerAgent(app, uniqueEmail('b'));
    a = userA.agent;
    tenantA = await createTenant(userA.agent, 'Ofis A');
    tenantB = await createTenant(userB.agent, 'Ofis B');
    await subscribe(app, tenantA, 'agency');
    await subscribe(app, tenantB, 'agency');
  });
  afterAll(() => app?.close());

  for (const route of TENANT_ROUTES) {
    it(`${route.method.toUpperCase()} ${route.path(':tenantId')}: own tenant ok, other tenant 404`, async () => {
      const own = await a[route.method](route.path(tenantA)).send(route.body);
      expect(own.status).toBeLessThan(400);

      const other = await a[route.method](route.path(tenantB)).send(route.body);
      expect(other.status).toBe(404);
      expect(other.body.code).toBe('NOT_FOUND');
    });
  }

  it('malformed and unknown tenant IDs look the same as foreign ones', async () => {
    const malformed = await a.get('/api/v1/tenants/not-a-uuid/members');
    const unknown = await a.get('/api/v1/tenants/00000000-0000-7000-8000-000000000000/members');
    expect(malformed.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(malformed.body).toEqual(unknown.body);
  });

  it("tenant A's member list never includes tenant B's users", async () => {
    const res = await a.get(`/api/v1/tenants/${tenantA}/members`).expect(200);
    expect(res.body).toHaveLength(1);
  });
});
