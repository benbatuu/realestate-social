import type { Currency, ListingType, NumberFormat, PropertyStatus } from '@app/shared';
import type { Cell } from './file-reader';

/**
 * Cell → canonical value converters. Each returns `{ ok: true, value }` (null = empty cell)
 * or `{ ok: false, message }`. Ambiguous input is an error, never a guess (blueprint rule 7).
 * Messages never contain the cell value: rows can hold personal data.
 */
export type Parsed<T> = { ok: true; value: T | null } | { ok: false; message: string };

const ok = <T>(value: T | null): Parsed<T> => ({ ok: true, value });
const fail = <T>(message: string): Parsed<T> => ({ ok: false, message });

/** Lower-case (Turkish rules), strip accents and anything that is not a letter or digit. */
export function normalizeToken(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

function asText(cell: Cell): string | null {
  if (cell === null) return null;
  if (cell instanceof Date) return cell.toISOString();
  const s = String(cell).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

export function parseText(cell: Cell, maxLength: number): Parsed<string> {
  const s = asText(cell);
  if (s === null) return ok(null);
  if (s.length > maxLength) return fail(`En fazla ${maxLength} karakter olabilir.`);
  return ok(s);
}

/** Like parseText but keeps line breaks (descriptions). */
export function parseLongText(cell: Cell, maxLength: number): Parsed<string> {
  if (cell === null) return ok(null);
  const s = String(cell)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (s === '') return ok(null);
  if (s.length > maxLength) return fail(`En fazla ${maxLength} karakter olabilir.`);
  return ok(s);
}

const LISTING_TYPES: Record<string, ListingType> = {
  satilik: 'SALE',
  satis: 'SALE',
  sale: 'SALE',
  'for sale': 'SALE',
  kiralik: 'RENT',
  kira: 'RENT',
  rent: 'RENT',
  'for rent': 'RENT',
};

export function parseListingType(cell: Cell): Parsed<ListingType> {
  const s = asText(cell);
  if (s === null) return ok(null);
  const v = LISTING_TYPES[normalizeToken(s)];
  return v ? ok(v) : fail('"Satılık" ya da "Kiralık" olmalı.');
}

const STATUSES: Record<string, PropertyStatus> = {
  aktif: 'ACTIVE',
  yayinda: 'ACTIVE',
  active: 'ACTIVE',
  pasif: 'INACTIVE',
  'yayinda degil': 'INACTIVE',
  inactive: 'INACTIVE',
  satildi: 'SOLD',
  sold: 'SOLD',
  kiralandi: 'RENTED',
  rented: 'RENTED',
};

export function parseStatus(cell: Cell): Parsed<PropertyStatus> {
  const s = asText(cell);
  if (s === null) return ok(null);
  const v = STATUSES[normalizeToken(s)];
  return v ? ok(v) : fail('"Aktif", "Pasif", "Satıldı" ya da "Kiralandı" olmalı.');
}

const TRUE_WORDS = new Set(['evet', 'var', 'e', 'yes', 'y', 'true', '1', 'esyali']);
const FALSE_WORDS = new Set(['hayir', 'yok', 'h', 'no', 'n', 'false', '0', 'esyasiz', 'bos']);

export function parseBoolean(cell: Cell): Parsed<boolean> {
  if (typeof cell === 'boolean') return ok(cell);
  const s = asText(cell);
  if (s === null) return ok(null);
  const t = normalizeToken(s);
  if (TRUE_WORDS.has(t)) return ok(true);
  if (FALSE_WORDS.has(t)) return ok(false);
  return fail('"Evet" ya da "Hayır" olmalı.');
}

const CURRENCY_TOKENS: [RegExp, Currency][] = [
  [/(₺|\btl\b|\btry\b|\blira\b)/i, 'TRY'],
  [/(\$|\busd\b|\bdolar\b)/i, 'USD'],
  [/(€|\beur\b|\beuro\b)/i, 'EUR'],
  [/(£|\bgbp\b|\bsterlin\b)/i, 'GBP'],
];

export function parseCurrency(cell: Cell): Parsed<Currency> {
  const s = asText(cell);
  if (s === null) return ok(null);
  for (const [re, cur] of CURRENCY_TOKENS) if (re.test(s)) return ok(cur);
  return fail('Para birimi TL, USD, EUR ya da GBP olmalı.');
}

const FORMAT_HINT: Record<NumberFormat, string> = {
  tr: 'Türkçe biçim bekleniyor (ör. 4.500.000 ya da 120,5).',
  en: 'İngilizce biçim bekleniyor (ör. 4,500,000 ya da 120.5).',
};

/**
 * Parses a decimal in the chosen format. Thousands groups must be exactly three digits, so
 * "4.500.000" (tr) is 4500000 and "4.50" (tr) is an error rather than a guess.
 */
export function parseDecimal(raw: string, format: NumberFormat): number | null {
  const s = raw.replace(/\s+/g, '');
  const [thousands, decimal] = format === 'tr' ? ['.', ','] : [',', '.'];
  const t = thousands === '.' ? '\\.' : ',';
  const d = decimal === '.' ? '\\.' : ',';
  const re = new RegExp(`^(\\d{1,3}(?:${t}\\d{3})+|\\d+)(?:${d}(\\d+))?$`);
  const m = re.exec(s);
  if (!m) return null;
  const intPart = (m[1] ?? '').split(thousands).join('');
  return Number(m[2] ? `${intPart}.${m[2]}` : intPart);
}

/** Removes currency and unit words so "4.500.000 TL" or "120 m²" can be read as numbers. */
function stripUnits(s: string): string {
  return s
    .replace(/₺|\$|€|£/g, '')
    .replace(/\b(tl|try|usd|eur|gbp|lira|dolar|euro|sterlin)\b/gi, '')
    .replace(/\b(m2|m²|metrekare|mt2|metre kare)\b/gi, '')
    .replace(/m²/g, '')
    .trim();
}

export function parseNumberCell(cell: Cell, format: NumberFormat): Parsed<number> {
  if (typeof cell === 'number') return Number.isFinite(cell) ? ok(cell) : fail('Sayı değil.');
  const s = asText(cell);
  if (s === null) return ok(null);
  const n = parseDecimal(stripUnits(s), format);
  return n === null ? fail(`Sayı olarak okunamadı. ${FORMAT_HINT[format]}`) : ok(n);
}

export function parseArea(cell: Cell, format: NumberFormat): Parsed<number> {
  const r = parseNumberCell(cell, format);
  if (!r.ok || r.value === null) return r;
  if (r.value <= 0 || r.value > 1_000_000) return fail('Alan 0 ile 1.000.000 m² arasında olmalı.');
  return ok(Math.round(r.value * 100) / 100);
}

export function parseInteger(cell: Cell, min: number, max: number): Parsed<number> {
  if (typeof cell === 'number') {
    if (!Number.isInteger(cell)) return fail('Tam sayı olmalı.');
    return cell < min || cell > max ? fail(`${min} ile ${max} arasında olmalı.`) : ok(cell);
  }
  const s = asText(cell);
  if (s === null) return ok(null);
  if (!/^\d+$/.test(s)) return fail('Tam sayı olmalı.');
  const n = Number(s);
  return n < min || n > max ? fail(`${min} ile ${max} arasında olmalı.`) : ok(n);
}

export function parseBuildingAge(cell: Cell): Parsed<number> {
  const s = asText(cell);
  if (s !== null && /^(sifir|sifir bina|yeni|0 yeni|new)$/.test(normalizeToken(s))) return ok(0);
  if (s !== null && /^\d+\s*-\s*\d+$/.test(s)) return fail('Aralık değil, tek bir yaş girin.');
  return parseInteger(cell, 0, 300);
}

export interface PriceValue {
  amountMinor: bigint;
  /** Currency written in the cell itself, if any. */
  currency: Currency | null;
}

export function parsePrice(cell: Cell, format: NumberFormat): Parsed<PriceValue> {
  let currency: Currency | null = null;
  let amount: number | null;
  if (typeof cell === 'number') {
    amount = cell;
  } else {
    const s = asText(cell);
    if (s === null) return ok(null);
    for (const [re, cur] of CURRENCY_TOKENS) if (re.test(s)) currency = cur;
    amount = parseDecimal(stripUnits(s), format);
    if (amount === null) return fail(`Fiyat okunamadı. ${FORMAT_HINT[format]}`);
  }
  if (!Number.isFinite(amount) || amount <= 0) return fail('Fiyat sıfırdan büyük olmalı.');
  const minor = Math.round(amount * 100);
  if (Math.abs(minor - amount * 100) > 1e-6) return fail('Fiyatta en fazla 2 ondalık olabilir.');
  if (minor > Number.MAX_SAFE_INTEGER) return fail('Fiyat çok büyük.');
  return ok({ amountMinor: BigInt(minor), currency });
}

export interface RoomsValue {
  layout: string;
  bedroomCount: number;
}

/** "3+1", "2.5+1", "1+0", "Stüdyo" or a bare number of rooms. */
export function parseRooms(cell: Cell): Parsed<RoomsValue> {
  if (typeof cell === 'number') {
    return Number.isInteger(cell) && cell >= 0 && cell <= 50
      ? ok({ layout: String(cell), bedroomCount: cell })
      : fail('Oda sayısı "3+1" biçiminde olmalı.');
  }
  const s = asText(cell);
  if (s === null) return ok(null);
  const t = normalizeToken(s);
  if (t === 'studyo' || t === 'studio' || t === '1 0')
    return ok({ layout: '1+0', bedroomCount: 1 });
  const m = /^(\d{1,2})(?:[.,](5))?\s*\+\s*(\d{1,2})$/.exec(s.replace(/\s+/g, ''));
  if (m) {
    const whole = Number(m[1]);
    const layout = `${m[1]}${m[2] ? '.5' : ''}+${m[3]}`;
    return ok({ layout, bedroomCount: whole });
  }
  if (/^\d{1,2}$/.test(s)) return ok({ layout: s, bedroomCount: Number(s) });
  return fail('Oda sayısı "3+1" biçiminde olmalı.');
}

/** dd.mm.yyyy, yyyy-mm-dd or a spreadsheet date. Slashes are rejected (day/month order varies). */
export function parseDate(cell: Cell): Parsed<Date> {
  if (cell instanceof Date)
    return Number.isNaN(cell.getTime()) ? fail('Geçersiz tarih.') : ok(cell);
  const s = asText(cell);
  if (s === null) return ok(null);
  let y: number, mo: number, d: number;
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    return fail('Tarih 21.11.2026 ya da 2026-11-21 biçiminde olmalı.');
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return fail('Geçersiz tarih.');
  }
  if (y < 1990 || date.getTime() > Date.now() + 24 * 3600 * 1000) {
    return fail('Tarih 1990 ile bugün arasında olmalı.');
  }
  return ok(date);
}
