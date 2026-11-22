import { describe, expect, it } from 'vitest';
import {
  parseArea,
  parseBoolean,
  parseBuildingAge,
  parseCurrency,
  parseDate,
  parseDecimal,
  parseListingType,
  parsePrice,
  parseRooms,
  parseStatus,
} from './values';

describe('parseDecimal', () => {
  it.each([
    ['4.500.000', 'tr', 4_500_000],
    ['4.500', 'tr', 4500],
    ['120,5', 'tr', 120.5],
    ['1.250.000,75', 'tr', 1_250_000.75],
    ['4500000', 'tr', 4_500_000],
    ['4,500,000', 'en', 4_500_000],
    ['120.5', 'en', 120.5],
  ] as const)('%s (%s) → %d', (input, format, expected) => {
    expect(parseDecimal(input, format)).toBe(expected);
  });

  it.each([
    ['4.50', 'tr'],
    ['4,500,000', 'tr'],
    ['4.500,000.5', 'tr'],
    ['4.500.000', 'en'],
    ['12a', 'tr'],
    ['', 'tr'],
  ] as const)('rejects %s in %s format instead of guessing', (input, format) => {
    expect(parseDecimal(input, format)).toBeNull();
  });
});

describe('parsePrice', () => {
  it('reads Turkish prices with a currency suffix into minor units', () => {
    expect(parsePrice('4.500.000 TL', 'tr')).toEqual({
      ok: true,
      value: { amountMinor: 450_000_000n, currency: 'TRY' },
    });
    expect(parsePrice('₺ 12.500', 'tr')).toEqual({
      ok: true,
      value: { amountMinor: 1_250_000n, currency: 'TRY' },
    });
    expect(parsePrice('350,000 USD', 'en')).toEqual({
      ok: true,
      value: { amountMinor: 35_000_000n, currency: 'USD' },
    });
  });

  it('accepts numeric spreadsheet cells without a currency', () => {
    expect(parsePrice(2_750_000, 'tr')).toEqual({
      ok: true,
      value: { amountMinor: 275_000_000n, currency: null },
    });
  });

  it('treats empty as null and rejects zero, negatives and too many decimals', () => {
    expect(parsePrice(null, 'tr')).toEqual({ ok: true, value: null });
    expect(parsePrice('0', 'tr').ok).toBe(false);
    expect(parsePrice(-5, 'tr').ok).toBe(false);
    expect(parsePrice(10.555, 'tr').ok).toBe(false);
  });

  it('never echoes the cell value in its error', () => {
    const r = parsePrice('call 0532 111 22 33', 'tr');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toContain('0532');
  });
});

describe('parseRooms', () => {
  it.each([
    ['3+1', '3+1', 3],
    ['3 + 1', '3+1', 3],
    ['2,5+1', '2.5+1', 2],
    ['2.5+1', '2.5+1', 2],
    ['Stüdyo', '1+0', 1],
    ['1+0', '1+0', 1],
    ['4', '4', 4],
  ])('%s → %s', (input, layout, bedrooms) => {
    expect(parseRooms(input)).toEqual({ ok: true, value: { layout, bedroomCount: bedrooms } });
  });

  it('rejects free text', () => {
    expect(parseRooms('geniş').ok).toBe(false);
  });
});

describe('enumerations and booleans', () => {
  it('reads Turkish listing types and statuses', () => {
    expect(parseListingType('Satılık')).toEqual({ ok: true, value: 'SALE' });
    expect(parseListingType('KİRALIK')).toEqual({ ok: true, value: 'RENT' });
    expect(parseListingType('Devren').ok).toBe(false);
    expect(parseStatus('Yayında değil')).toEqual({ ok: true, value: 'INACTIVE' });
    expect(parseStatus('Satıldı')).toEqual({ ok: true, value: 'SOLD' });
  });

  it('reads yes/no in Turkish and English', () => {
    expect(parseBoolean('Evet')).toEqual({ ok: true, value: true });
    expect(parseBoolean('Hayır')).toEqual({ ok: true, value: false });
    expect(parseBoolean('Yok')).toEqual({ ok: true, value: false });
    expect(parseBoolean(true)).toEqual({ ok: true, value: true });
    expect(parseBoolean('belki').ok).toBe(false);
  });

  it('reads currencies', () => {
    expect(parseCurrency('TL')).toEqual({ ok: true, value: 'TRY' });
    expect(parseCurrency('€')).toEqual({ ok: true, value: 'EUR' });
    expect(parseCurrency('yen').ok).toBe(false);
  });
});

describe('areas, ages and dates', () => {
  it('reads areas with units', () => {
    expect(parseArea('120 m²', 'tr')).toEqual({ ok: true, value: 120 });
    expect(parseArea('85,5 m2', 'tr')).toEqual({ ok: true, value: 85.5 });
    expect(parseArea(0, 'tr').ok).toBe(false);
  });

  it('reads building age, including "Sıfır", and rejects ranges', () => {
    expect(parseBuildingAge('Sıfır Bina')).toEqual({ ok: true, value: 0 });
    expect(parseBuildingAge('12')).toEqual({ ok: true, value: 12 });
    expect(parseBuildingAge('5-10').ok).toBe(false);
  });

  it('reads day-first dotted and ISO dates, rejects slashes and impossible dates', () => {
    expect(parseDate('21.11.2025')).toEqual({ ok: true, value: new Date(Date.UTC(2025, 10, 21)) });
    expect(parseDate('2025-11-21')).toEqual({ ok: true, value: new Date(Date.UTC(2025, 10, 21)) });
    expect(parseDate('01/02/2025').ok).toBe(false);
    expect(parseDate('31.02.2025').ok).toBe(false);
  });
});
