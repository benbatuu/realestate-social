import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  uniqueEmail,
  waitForImport,
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

describe('acceptance #13: tenant isolation (path-scoped routes)', () => {
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

/**
 * Header-scoped routes (X-Tenant-Id). The guard proves membership of the header's tenant, so
 * each route is also called with the caller's own header and another tenant's resource ID.
 */
describe('acceptance #13: tenant isolation (header-scoped routes)', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let a: Agent;
  let tenantA: string;
  let tenantB: string;
  const b: { propertyId: string; assetId: string; importId: string } = {
    propertyId: '',
    assetId: '',
    importId: '',
  };

  beforeAll(async () => {
    app = await createTestApp();
    worker = await createTestWorker();
    await resetState(app);
    const userA = await registerAgent(app, uniqueEmail('a'));
    const userB = await registerAgent(app, uniqueEmail('b'));
    a = userA.agent;
    tenantA = await createTenant(userA.agent, 'Ofis A');
    tenantB = await createTenant(userB.agent, 'Ofis B');

    const apiB = scoped(userB.agent, tenantB);
    const up = await apiB
      .post('/api/v1/imports')
      .attach('file', Buffer.from(TURKISH_CSV), 'b.csv')
      .expect(201);
    b.importId = up.body.import.id;
    await apiB
      .post(`/api/v1/imports/${b.importId}/commit`)
      .send({ mapping: up.body.suggestedMapping })
      .expect(202);
    await waitForImport(userB.agent, tenantB, b.importId);
    const list = await apiB.get('/api/v1/properties').expect(200);
    b.propertyId = list.body.items[0].id;
    const jpeg = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#888' },
    })
      .jpeg()
      .toBuffer();
    const assets = await apiB
      .post(`/api/v1/properties/${b.propertyId}/assets`)
      .attach('files', jpeg, 'b.jpg')
      .expect(201);
    b.assetId = assets.body.results[0].assetId;
  });
  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  const routes: {
    name: string;
    call: (agent: Agent, tenant: string) => Promise<{ status: number; body: { code?: string } }>;
  }[] = [
    {
      name: 'GET /properties/:id',
      call: (ag, t) => scoped(ag, t).get(`/api/v1/properties/${b.propertyId}`),
    },
    {
      name: 'POST /properties/:id/assets',
      call: async (ag, t) =>
        scoped(ag, t)
          .post(`/api/v1/properties/${b.propertyId}/assets`)
          .attach(
            'files',
            await sharp({ create: { width: 800, height: 600, channels: 3, background: '#111' } })
              .jpeg()
              .toBuffer(),
            'x.jpg',
          ),
    },
    {
      name: 'DELETE /properties/:id/assets/:assetId',
      call: (ag, t) =>
        scoped(ag, t).delete(`/api/v1/properties/${b.propertyId}/assets/${b.assetId}`),
    },
    {
      name: 'GET /imports/:id',
      call: (ag, t) => scoped(ag, t).get(`/api/v1/imports/${b.importId}`),
    },
    {
      name: 'GET /imports/:id/errors',
      call: (ag, t) => scoped(ag, t).get(`/api/v1/imports/${b.importId}/errors`),
    },
    {
      name: 'GET /imports/:id/errors.csv',
      call: (ag, t) => scoped(ag, t).get(`/api/v1/imports/${b.importId}/errors.csv`),
    },
    {
      name: 'POST /imports/:id/preview',
      call: (ag, t) =>
        scoped(ag, t)
          .post(`/api/v1/imports/${b.importId}/preview`)
          .send({ mapping: { columns: {}, numberFormat: 'tr', defaultCurrency: null } }),
    },
    {
      name: 'POST /imports/:id/commit',
      call: (ag, t) =>
        scoped(ag, t)
          .post(`/api/v1/imports/${b.importId}/commit`)
          .send({ mapping: { columns: {}, numberFormat: 'tr', defaultCurrency: null } }),
    },
  ];

  for (const route of routes) {
    it(`${route.name}: own header + foreign ID → 404; foreign header → 404`, async () => {
      const ownHeader = await route.call(a, tenantA);
      expect(ownHeader.status).toBe(404);
      const foreignHeader = await route.call(a, tenantB);
      expect(foreignHeader.status).toBe(404);
    });
  }

  it('list routes only return the caller tenant data; a missing header is a 404', async () => {
    const props = await scoped(a, tenantA).get('/api/v1/properties').expect(200);
    expect(props.body.total).toBe(0);
    const imports = await scoped(a, tenantA).get('/api/v1/imports').expect(200);
    expect(imports.body).toEqual([]);
    await scoped(a, tenantB).get('/api/v1/properties').expect(404);
    await a.get('/api/v1/properties').expect(404);
  });

  it("tenant B's photo and property are untouched", async () => {
    const prisma = app.get(PrismaService);
    expect(await prisma.propertyAsset.count({ where: { id: b.assetId } })).toBe(1);
  });
});
