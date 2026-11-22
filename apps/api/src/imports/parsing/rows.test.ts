import type { ImportMapping } from '@app/shared';
import { describe, expect, it } from 'vitest';
import type { TabularFile } from './file-reader';
import { suggestColumns, suggestNumberFormat, validateMapping } from './mapping';
import { parseRows } from './rows';

const headers = [
  'Portföy No',
  'İlan Başlığı',
  'İşlem Türü',
  'Fiyat',
  'Oda Sayısı',
  'Brüt m²',
  'İl',
  'İlçe',
  'Sahibi Tel',
];

function file(rows: (string | number | null)[][]): TabularFile {
  return { format: 'CSV', encoding: 'UTF-8', delimiter: ';', headers, rows };
}

const mapping: ImportMapping = {
  columns: {
    externalId: 'Portföy No',
    title: 'İlan Başlığı',
    listingType: 'İşlem Türü',
    price: 'Fiyat',
    rooms: 'Oda Sayısı',
    grossAreaM2: 'Brüt m²',
    city: 'İl',
    district: 'İlçe',
  },
  numberFormat: 'tr',
  defaultCurrency: null,
};

describe('suggestColumns', () => {
  it('matches Turkish headers and leaves unrelated columns alone', () => {
    expect(suggestColumns(headers)).toEqual(mapping.columns);
  });
});

describe('suggestNumberFormat', () => {
  it('detects English thousands separators and defaults to Turkish', () => {
    expect(suggestNumberFormat(['4,500,000', '1,250,000'])).toBe('en');
    expect(suggestNumberFormat(['4.500.000', 2000])).toBe('tr');
    expect(suggestNumberFormat([])).toBe('tr');
  });
});

describe('validateMapping', () => {
  it('requires external ID, title and listing type and rejects unknown or reused columns', () => {
    const problems = validateMapping(
      {
        columns: { externalId: 'Portföy No', title: 'Portföy No', listingType: 'Yok' },
        numberFormat: 'tr',
        defaultCurrency: null,
      },
      headers,
    );
    expect(problems.map((p) => p.field)).toEqual(['listingType', null]);
    expect(validateMapping(mapping, headers)).toEqual([]);
  });
});

describe('parseRows', () => {
  it('produces canonical data and never reads unmapped columns', () => {
    const [row] = parseRows(
      file([
        [
          'P-1',
          'Moda 3+1',
          'Satılık',
          '4.500.000 TL',
          '3+1',
          '120',
          'İstanbul',
          'Kadıköy',
          '0532 000 00 00',
        ],
      ]),
      mapping,
    );
    expect(row?.errors).toEqual([]);
    expect(row?.data).toEqual({
      externalId: 'P-1',
      title: 'Moda 3+1',
      listingType: 'SALE',
      priceMinor: 450_000_000n,
      priceCurrency: 'TRY',
      roomLayout: '3+1',
      bedroomCount: 3,
      grossAreaM2: 120,
      city: 'İstanbul',
      district: 'Kadıköy',
    });
    expect(JSON.stringify(row, (_, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain(
      '0532',
    );
  });

  it('distinguishes unmapped (undefined) from mapped-but-empty (null)', () => {
    const [row] = parseRows(
      file([['P-1', 'Daire', 'Kiralık', null, null, null, null, null, null]]),
      mapping,
    );
    expect(row?.data?.priceMinor).toBeNull();
    expect(row?.data?.roomLayout).toBeNull();
    expect(row?.data).not.toHaveProperty('description');
    expect(row?.data).not.toHaveProperty('netAreaM2');
  });

  it('requires a currency for prices without one', () => {
    const rows = parseRows(
      file([['P-1', 'Daire', 'Satılık', '4.500.000', null, null, null, null, null]]),
      mapping,
    );
    expect(rows[0]?.data).toBeNull();
    expect(rows[0]?.errors[0]).toMatchObject({ rowNumber: 2, field: 'price' });

    const withDefault = parseRows(
      file([['P-1', 'Daire', 'Satılık', '4.500.000', null, null, null, null, null]]),
      {
        ...mapping,
        defaultCurrency: 'TRY',
      },
    );
    expect(withDefault[0]?.data?.priceCurrency).toBe('TRY');
  });

  it('collects every error in a row and flags missing required values', () => {
    const [row] = parseRows(
      file([[null, 'Daire', 'Devren', '4.50', 'çok', null, null, null, null]]),
      mapping,
    );
    expect(row?.data).toBeNull();
    expect(row?.errors.map((e) => e.field).sort()).toEqual([
      'externalId',
      'listingType',
      'price',
      'rooms',
    ]);
  });

  it('marks every row sharing an external ID as an error', () => {
    const rows = parseRows(
      file([
        ['P-1', 'A', 'Satılık', null, null, null, null, null, null],
        ['P-2', 'B', 'Satılık', null, null, null, null, null, null],
        ['P-1', 'C', 'Satılık', null, null, null, null, null, null],
      ]),
      mapping,
    );
    expect(rows.map((r) => r.data === null)).toEqual([true, false, true]);
    expect(rows[0]?.errors[0]?.message).toContain('satır 2, 4');
  });
});
