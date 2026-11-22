import {
  IMPORT_FIELDS,
  type ImportFieldKey,
  type ImportMapping,
  type NumberFormat,
} from '@app/shared';
import type { Cell } from './file-reader';
import { normalizeToken, parseDecimal } from './values';

const normalized = (s: string) => normalizeToken(s).replace(/\s+/g, ' ');

/**
 * Suggests a column for each field: exact synonym match first, then a header that contains a
 * synonym as a whole word sequence. Each column is used at most once.
 */
export function suggestColumns(headers: string[]): ImportMapping['columns'] {
  const columns: ImportMapping['columns'] = {};
  const used = new Set<string>();
  const normHeaders = headers.map((h) => ({ h, n: normalized(h) }));

  for (const pass of ['exact', 'contains'] as const) {
    for (const field of IMPORT_FIELDS) {
      if (columns[field.key]) continue;
      const synonyms = field.synonyms.map(normalized);
      const match = normHeaders.find(({ h, n }) => {
        if (used.has(h)) return false;
        return pass === 'exact'
          ? synonyms.includes(n)
          : synonyms.some((syn) => syn.length > 2 && ` ${n} `.includes(` ${syn} `));
      });
      if (match) {
        columns[field.key] = match.h;
        used.add(match.h);
      }
    }
  }
  return columns;
}

/**
 * Guesses tr vs en from text values in the price/area columns. Defaults to tr. Only decides when
 * values parse under exactly one of the formats; the user can still change it.
 */
export function suggestNumberFormat(values: Cell[]): NumberFormat {
  let tr = 0;
  let en = 0;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const s = v.replace(/[^\d.,]/g, '');
    if (!/[.,]/.test(s)) continue;
    const asTr = parseDecimal(s, 'tr') !== null;
    const asEn = parseDecimal(s, 'en') !== null;
    if (asTr && !asEn) tr++;
    if (asEn && !asTr) en++;
  }
  return en > tr ? 'en' : 'tr';
}

export interface MappingProblem {
  field: ImportFieldKey | null;
  message: string;
}

export function validateMapping(mapping: ImportMapping, headers: string[]): MappingProblem[] {
  const problems: MappingProblem[] = [];
  const headerSet = new Set(headers);
  for (const field of IMPORT_FIELDS) {
    const column = mapping.columns[field.key];
    if (field.required && !column) {
      problems.push({ field: field.key, message: `"${field.label}" için bir sütun seçin.` });
    }
    if (column && !headerSet.has(column)) {
      problems.push({
        field: field.key,
        message: `"${field.label}" için seçilen sütun dosyada yok.`,
      });
    }
  }
  const used = Object.values(mapping.columns).filter(Boolean);
  if (new Set(used).size !== used.length) {
    problems.push({ field: null, message: 'Bir sütun birden fazla alana eşlenmiş.' });
  }
  return problems;
}
