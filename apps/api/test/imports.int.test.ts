import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import type { ImportMapping } from '@app/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/prisma.service';
import { StorageService } from '../src/infra/storage.service';
import writeXlsxFile from 'write-excel-file/node';
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

interface Uploaded {
  import: { id: string; status: string; totalRows: number };
  columns: { name: string; example: string | null }[];
  suggestedMapping: ImportMapping;
  detected: { encoding: string | null; delimiter: string | null };
}

describe('file imports', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;
  let owner: Agent;
  let tenantId: string;

  const api = () => scoped(owner, tenantId);

  async function upload(content: string | Buffer, name = 'portfoy.csv'): Promise<Uploaded> {
    const res = await api()
      .post('/api/v1/imports')
      .attach('file', Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'), name)
      .expect(201);
    return res.body as Uploaded;
  }

  async function importFile(
    content: string | Buffer,
    mapping?: Partial<ImportMapping>,
    name?: string,
  ) {
    const up = await upload(content, name);
    const full = { ...up.suggestedMapping, ...mapping };
    await api().post(`/api/v1/imports/${up.import.id}/commit`).send({ mapping: full }).expect(202);
    return { up, result: await waitForImport(owner, tenantId, up.import.id) };
  }

  beforeAll(async () => {
    app = await createTestApp();
    worker = await createTestWorker();
  });
  beforeEach(async () => {
    await resetState(app);
    const user = await registerAgent(app);
    owner = user.agent;
    tenantId = await createTenant(owner);
  });
  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('upload reads a Turkish CSV and suggests a mapping without touching unrelated columns', async () => {
    const up = await upload(TURKISH_CSV);
    expect(up.import).toMatchObject({ status: 'UPLOADED', totalRows: 4 });
    expect(up.detected).toEqual({ encoding: 'UTF-8', delimiter: ';' });
    expect(up.suggestedMapping.columns).toEqual({
      externalId: 'Portföy No',
      title: 'İlan Başlığı',
      listingType: 'İşlem Türü',
      price: 'Fiyat',
      rooms: 'Oda Sayısı',
      grossAreaM2: 'Brüt m²',
      city: 'İl',
      district: 'İlçe',
      neighborhood: 'Mahalle',
    });
    expect(up.suggestedMapping.numberFormat).toBe('tr');
  });

  it('preview counts creates and errors without writing anything', async () => {
    const up = await upload(TURKISH_CSV);
    const res = await api()
      .post(`/api/v1/imports/${up.import.id}/preview`)
      .send({ mapping: up.suggestedMapping })
      .expect(200);
    expect(res.body).toMatchObject({
      totalRows: 4,
      valid: 2,
      create: 2,
      update: 0,
      unchanged: 0,
      failed: 2,
    });
    expect(
      res.body.errors.map((e: { rowNumber: number; field: string }) => [e.rowNumber, e.field]),
    ).toEqual([
      [4, 'price'],
      [5, 'listingType'],
    ]);
    // Neither the phone (unmapped column) nor the bad price value may be echoed.
    expect(JSON.stringify(res.body.errors)).not.toMatch(/0534|4\.50(?!0)/);
    expect(await app.get(PrismaService).property.count()).toBe(0);
  });

  it('acceptance #2: commit imports valid rows, reports bad ones and deletes the source file', async () => {
    const { up, result } = await importFile(TURKISH_CSV);
    expect(result).toMatchObject({
      status: 'COMPLETED',
      created: 2,
      updated: 0,
      unchanged: 0,
      failed: 2,
      processedRows: 4,
    });

    const list = await api().get('/api/v1/properties').expect(200);
    expect(list.body.total).toBe(2);
    const moda = list.body.items.find((p: { externalId: string }) => p.externalId === 'P-100');
    expect(moda).toMatchObject({
      listingType: 'SALE',
      priceMinor: 1_250_000_000,
      priceCurrency: 'TRY',
      roomLayout: '3+1',
      grossAreaM2: 145,
      neighborhood: 'Caferağa',
    });

    const errors = await api().get(`/api/v1/imports/${up.import.id}/errors`).expect(200);
    expect(errors.body).toHaveLength(2);
    const csv = await api().get(`/api/v1/imports/${up.import.id}/errors.csv`).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.startsWith('﻿Satır;Alan;Hata')).toBe(true);
    expect(csv.text).not.toMatch(/0534|0532/);

    const run = await app
      .get(PrismaService)
      .syncRun.findUniqueOrThrow({ where: { id: up.import.id } });
    expect(run.fileStorageKey).toBeNull();
    await expect(
      app.get(StorageService).getBuffer(`imports/${tenantId}/${up.import.id}/source.csv`),
    ).rejects.toBeTruthy();
  });

  it('re-importing the same file creates no duplicates; changed rows update', async () => {
    await importFile(TURKISH_CSV);
    const again = await importFile(TURKISH_CSV);
    expect(again.result).toMatchObject({ created: 0, updated: 0, unchanged: 2, failed: 2 });
    expect(await app.get(PrismaService).property.count({ where: { tenantId } })).toBe(2);

    const changed = TURKISH_CSV.replace('12.500.000 TL', '11.900.000 TL');
    const third = await importFile(changed);
    expect(third.result).toMatchObject({ created: 0, updated: 1, unchanged: 1 });
  });

  it('an unmapped column leaves data alone; a mapped empty cell clears it', async () => {
    await importFile(TURKISH_CSV);
    const prisma = app.get(PrismaService);

    const withoutPrice = 'Portföy No;İlan Başlığı;İşlem Türü\nP-100;Moda 3+1 yeni başlık;Satılık\n';
    await importFile(withoutPrice);
    let p = await prisma.property.findFirstOrThrow({ where: { tenantId, externalId: 'P-100' } });
    expect(p.title).toBe('Moda 3+1 yeni başlık');
    expect(p.priceMinor).toBe(1_250_000_000n);

    const emptyPrice =
      'Portföy No;İlan Başlığı;İşlem Türü;Fiyat\nP-100;Moda 3+1 yeni başlık;Satılık;\n';
    await importFile(emptyPrice);
    p = await prisma.property.findFirstOrThrow({ where: { tenantId, externalId: 'P-100' } });
    expect(p.priceMinor).toBeNull();
    expect(p.priceCurrency).toBeNull();
  });

  it('reads XLSX uploads with numeric cells and an explicit default currency', async () => {
    const xlsx = await writeXlsxFile([
      [{ value: 'İlan No' }, { value: 'Başlık' }, { value: 'İlan Türü' }, { value: 'Fiyat' }],
      [{ value: 'X-1' }, { value: 'Excel daire' }, { value: 'Satılık' }, { value: 3_250_000 }],
    ]).toBuffer();
    const missingCurrency = await importFile(xlsx, undefined, 'portfoy.xlsx');
    expect(missingCurrency.result).toMatchObject({ created: 0, failed: 1 });

    const ok = await importFile(xlsx, { defaultCurrency: 'TRY' }, 'portfoy.xlsx');
    expect(ok.result).toMatchObject({ created: 1, failed: 0 });
    const p = await app
      .get(PrismaService)
      .property.findFirstOrThrow({ where: { tenantId, externalId: 'X-1' } });
    expect(p.priceMinor).toBe(325_000_000n);
  });

  it('commits once even when the button is pressed twice at the same time', async () => {
    const up = await upload(TURKISH_CSV);
    const results = await Promise.all([
      api().post(`/api/v1/imports/${up.import.id}/commit`).send({ mapping: up.suggestedMapping }),
      api().post(`/api/v1/imports/${up.import.id}/commit`).send({ mapping: up.suggestedMapping }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([202, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('IMPORT_NOT_EDITABLE');
    const done = await waitForImport(owner, tenantId, up.import.id);
    expect(done).toMatchObject({ status: 'COMPLETED', created: 2 });
  });

  it('rejects bad mappings, bad files, foreign origins and under-privileged roles', async () => {
    const up = await upload(TURKISH_CSV);
    const bad = await api()
      .post(`/api/v1/imports/${up.import.id}/preview`)
      .send({ mapping: { ...up.suggestedMapping, columns: { title: 'İlan Başlığı' } } })
      .expect(400);
    expect(bad.body.code).toBe('MAPPING_INVALID');

    const pdf = await api()
      .post('/api/v1/imports')
      .attach('file', Buffer.from('%PDF-1.7'), 'x.pdf')
      .expect(422);
    expect(pdf.body.code).toBe('FILE_UNSUPPORTED');
    const none = await api().post('/api/v1/imports').expect(400);
    expect(none.body.code).toBe('FILE_REQUIRED');

    const evil = await api()
      .post('/api/v1/imports')
      .set('Origin', 'https://evil.example')
      .attach('file', Buffer.from(TURKISH_CSV), 'p.csv')
      .expect(403);
    expect(evil.body.code).toBe('ORIGIN_NOT_ALLOWED');

    // A MEMBER can view properties but not import.
    await subscribe(app, tenantId, 'growth');
    const email = uniqueEmail('member');
    const invite = await owner
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email, role: 'MEMBER' })
      .expect(201);
    const member = await registerAgent(app, email);
    await member.agent
      .post('/api/v1/invitations/accept')
      .send({ token: new URL(invite.body.acceptUrl).hash.replace('#token=', '') })
      .expect(200);
    await scoped(member.agent, tenantId)
      .post('/api/v1/imports')
      .attach('file', Buffer.from(TURKISH_CSV), 'p.csv')
      .expect(403);
    await scoped(member.agent, tenantId).get('/api/v1/properties').expect(200);
  });
});
