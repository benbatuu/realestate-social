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
  TURKISH_CSV,
  waitForImport,
} from './helpers';

const photo = (seed: number) =>
  sharp({
    create: { width: 1600, height: 1067, channels: 3, background: { r: seed, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();

describe('properties: detail, coverage and photos', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let owner: Agent;
  let tenantId: string;
  let propertyId: string;
  const api = () => scoped(owner, tenantId);

  beforeAll(async () => {
    app = await createTestApp();
    worker = await createTestWorker();
    await resetState(app);
    owner = (await registerAgent(app)).agent;
    tenantId = await createTenant(owner);
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
  });
  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('acceptance #3: detail shows facts and an explained coverage score', async () => {
    const res = await api().get(`/api/v1/properties/${propertyId}`).expect(200);
    expect(res.body).toMatchObject({
      externalId: 'P-100',
      priceMinor: 1_250_000_000,
      roomLayout: '3+1',
      bedroomCount: 3,
      photoCount: 0,
      assets: [],
      source: { name: 'CSV / Excel' },
    });
    // price 15 + area 10 + rooms 10 + location 10 + basics 5 = 50
    expect(res.body.coverage).toMatchObject({ score: 50, level: 'medium' });
    const photos = res.body.coverage.items.find((i: { key: string }) => i.key === 'photos');
    expect(photos).toMatchObject({ earned: 0, hint: expect.stringContaining('10') });
    expect(res.body.coverageScore).toBe(50);
  });

  it('lists with search, filter, sort and paging', async () => {
    const rent = await api().get('/api/v1/properties?listingType=RENT').expect(200);
    expect(rent.body.items.map((p: { externalId: string }) => p.externalId)).toEqual(['P-101']);
    const byPrice = await api().get('/api/v1/properties?sort=price_desc&pageSize=1').expect(200);
    expect(byPrice.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(byPrice.body.items[0].externalId).toBe('P-100');
    const search = await api().get('/api/v1/properties?q=fenerbah').expect(200);
    expect(search.body.total).toBe(1);
    await api().get('/api/v1/properties?pageSize=1000').expect(400);
  });

  it('uploads photos, skips duplicates, rejects non-photos and updates coverage', async () => {
    const [a, b] = await Promise.all([photo(10), photo(20)]);
    const gif = await sharp({
      create: { width: 800, height: 800, channels: 3, background: '#fff' },
    })
      .gif()
      .toBuffer();
    const res = await api()
      .post(`/api/v1/properties/${propertyId}/assets`)
      .attach('files', a, 'salon.jpg')
      .attach('files', b, 'mutfak.jpg')
      .attach('files', a, 'salon-kopya.jpg')
      .attach('files', gif, 'animasyon.gif')
      .expect(201);
    expect(res.body.results.map((r: { outcome: string }) => r.outcome)).toEqual([
      'created',
      'created',
      'duplicate',
      'rejected',
    ]);

    const detail = await api().get(`/api/v1/properties/${propertyId}`).expect(200);
    expect(detail.body.photoCount).toBe(2);
    expect(detail.body.coverage.score).toBe(54); // +20 × 2/10
    expect(detail.body.assets.map((x: { sortOrder: number }) => x.sortOrder)).toEqual([0, 1]);

    // Signed URLs work without a session; the bucket itself is private.
    const signed = await fetch(detail.body.assets[0].thumbnailUrl);
    expect(signed.status).toBe(200);
    expect(signed.headers.get('content-type')).toBe('image/webp');
    const unsigned = await fetch(detail.body.assets[0].url.split('?')[0]);
    expect(unsigned.status).toBe(403);

    const list = await api().get('/api/v1/properties?q=P-100').expect(200);
    expect(list.body.items[0].coverThumbnailUrl).toMatch(/^http/);

    await api()
      .delete(`/api/v1/properties/${propertyId}/assets/${detail.body.assets[0].id}`)
      .expect(204);
    const after = await api().get(`/api/v1/properties/${propertyId}`).expect(200);
    expect(after.body).toMatchObject({ photoCount: 1, coverageScore: 52 });
    expect((await fetch(detail.body.assets[0].url)).status).toBe(404);
  });

  it('re-importing keeps photos and their coverage credit', async () => {
    const up = await api()
      .post('/api/v1/imports')
      .attach('file', Buffer.from(TURKISH_CSV), 'p.csv')
      .expect(201);
    await api()
      .post(`/api/v1/imports/${up.body.import.id}/commit`)
      .send({ mapping: up.body.suggestedMapping })
      .expect(202);
    await waitForImport(owner, tenantId, up.body.import.id);
    const p = await app
      .get(PrismaService)
      .property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(p.dataCoverageScore).toBe(52);
  });
});

describe('large imports', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;

  beforeAll(async () => {
    app = await createTestApp();
    worker = await createTestWorker();
    await resetState(app);
  });
  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('commits 5,000 rows in chunks within a minute', { timeout: 120_000 }, async () => {
    const owner = (await registerAgent(app)).agent;
    const tenantId = await createTenant(owner);
    const lines = ['İlan No;Başlık;İlan Türü;Fiyat;Oda Sayısı;İl;İlçe'];
    for (let i = 0; i < 5000; i++) {
      lines.push(
        `L-${i};Daire ${i};${i % 2 ? 'Kiralık' : 'Satılık'};${(1_000_000 + i).toLocaleString('tr-TR')} TL;3+1;İstanbul;Kadıköy`,
      );
    }
    const api = scoped(owner, tenantId);
    const started = Date.now();
    const up = await api
      .post('/api/v1/imports')
      .attach('file', Buffer.from(lines.join('\n')), 'buyuk.csv')
      .expect(201);
    await api
      .post(`/api/v1/imports/${up.body.import.id}/commit`)
      .send({ mapping: up.body.suggestedMapping })
      .expect(202);
    const done = await waitForImport(owner, tenantId, up.body.import.id, 90_000);
    const seconds = (Date.now() - started) / 1000;
    expect(done).toMatchObject({ status: 'COMPLETED', created: 5000, failed: 0 });
    expect(seconds).toBeLessThan(60);
    console.info(`5,000-row import took ${seconds.toFixed(1)}s`);
  });
});
