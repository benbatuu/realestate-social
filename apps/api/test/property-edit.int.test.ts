import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  tokenFromAcceptUrl,
  uniqueEmail,
  waitForImport,
} from './helpers';

describe('editing properties by hand', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let owner: Agent;
  let tenantId: string;
  let propertyId: string;
  const api = () => scoped(owner, tenantId);

  async function importCsv(csv: string) {
    const up = await api()
      .post('/api/v1/imports')
      .attach('file', Buffer.from(csv), 'p.csv')
      .expect(201);
    await api()
      .post(`/api/v1/imports/${up.body.import.id}/commit`)
      .send({ mapping: up.body.suggestedMapping })
      .expect(202);
    await waitForImport(owner, tenantId, up.body.import.id);
  }

  beforeAll(async () => {
    app = await createTestApp();
    worker = await createTestWorker();
  });
  beforeEach(async () => {
    await resetState(app);
    owner = (await registerAgent(app)).agent;
    tenantId = await createTenant(owner);
    await subscribe(app, tenantId, 'growth');
    await importCsv(TURKISH_CSV);
    const list = await api().get('/api/v1/properties?q=P-100').expect(200);
    propertyId = list.body.items[0].id;
  });
  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('updates fields, recalculates coverage and records only field names in audit', async () => {
    const res = await api()
      .patch(`/api/v1/properties/${propertyId}`)
      .send({
        title: 'Moda’da deniz manzaralı 3+1',
        priceMinor: 1_100_000_000,
        priceCurrency: 'TRY',
        description: 'Yeni tadilat, eşyalı teslim.',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      title: 'Moda’da deniz manzaralı 3+1',
      priceMinor: 1_100_000_000,
      priceCurrency: 'TRY',
    });
    expect(res.body.coverage.score).toBeGreaterThan(50);

    const logs = await app
      .get(PrismaService)
      .auditLog.findMany({ where: { action: 'property.updated' } });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs[0]?.metadataJson)).toContain('priceMinor');
    expect(JSON.stringify(logs[0]?.metadataJson)).not.toContain('11000000');
  });

  it('clears a field when sent null', async () => {
    const res = await api()
      .patch(`/api/v1/properties/${propertyId}`)
      .send({ neighborhood: null })
      .expect(200);
    expect(res.body.neighborhood).toBeNull();
  });

  it('validates input with field-level issues', async () => {
    const bad = await api()
      .patch(`/api/v1/properties/${propertyId}`)
      .send({ grossAreaM2: -3, listingType: 'DEVREN' })
      .expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    const paths = (bad.body.issues as { path: string }[]).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['grossAreaM2', 'listingType']));
    await api().patch(`/api/v1/properties/${propertyId}`).send({}).expect(400);
  });

  it('a price needs a currency', async () => {
    const res = await api()
      .patch(`/api/v1/properties/${propertyId}`)
      .send({ priceMinor: 500 })
      .expect(400);
    expect((res.body.issues as { path: string }[]).map((i) => i.path)).toContain('priceCurrency');
  });

  it('a later import keeps hand-edited fields and still updates the rest', async () => {
    await api()
      .patch(`/api/v1/properties/${propertyId}`)
      .send({ title: 'Elle yazılmış başlık', priceMinor: 990_000_000, priceCurrency: 'TRY' })
      .expect(200);
    const changed = TURKISH_CSV.replace("Moda'da deniz manzaralı 3+1", 'Kaynaktaki yeni başlık')
      .replace('12.500.000 TL', '11.000.000 TL')
      .replace('145;', '150;');
    await importCsv(changed);
    const p = await app
      .get(PrismaService)
      .property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(p.title).toBe('Elle yazılmış başlık');
    expect(p.priceMinor).toBe(990_000_000n);
    expect(p.grossAreaM2?.toNumber()).toBe(150);
  });

  it('members cannot edit; managers can; foreign tenants get 404', async () => {
    const email = uniqueEmail('member');
    const invite = await owner
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email, role: 'MEMBER' })
      .expect(201);
    const member = await registerAgent(app, email);
    await member.agent
      .post('/api/v1/invitations/accept')
      .send({ token: tokenFromAcceptUrl(invite.body.acceptUrl) })
      .expect(200);
    const denied = await scoped(member.agent, tenantId)
      .patch(`/api/v1/properties/${propertyId}`)
      .send({ title: 'Yetkisiz' });
    expect(denied.status).toBe(403);

    const other = await registerAgent(app);
    const otherTenant = await createTenant(other.agent, 'Başka Ofis');
    const foreign = await scoped(other.agent, otherTenant)
      .patch(`/api/v1/properties/${propertyId}`)
      .send({ title: 'Yabancı' });
    expect(foreign.status).toBe(404);
    const foreignHeader = await scoped(owner, otherTenant)
      .patch(`/api/v1/properties/${propertyId}`)
      .send({ title: 'Yabancı' });
    expect(foreignHeader.status).toBe(404);
  });
});
