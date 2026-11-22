import type {
  Currency,
  ImportFieldKey,
  ImportMapping,
  ImportRowError,
  ListingType,
  PropertyStatus,
} from '@app/shared';
import type { Cell, TabularFile } from './file-reader';
import {
  parseArea,
  parseBoolean,
  parseBuildingAge,
  parseCurrency,
  parseDate,
  type Parsed,
  parseInteger,
  parseListingType,
  parseLongText,
  parsePrice,
  parseRooms,
  parseStatus,
  parseText,
} from './values';

/**
 * Canonical values from one row. `undefined` = column not mapped (leave existing data alone);
 * `null` = mapped but empty (clear it: the source system is the source of truth).
 */
export interface PropertyRowData {
  externalId: string;
  title: string;
  listingType: ListingType;
  description?: string | null;
  propertyType?: string | null;
  status?: PropertyStatus | null;
  priceMinor?: bigint | null;
  priceCurrency?: Currency | null;
  grossAreaM2?: number | null;
  netAreaM2?: number | null;
  roomLayout?: string | null;
  bedroomCount?: number | null;
  bathroomCount?: number | null;
  floor?: string | null;
  totalFloors?: number | null;
  buildingAge?: number | null;
  heatingType?: string | null;
  furnished?: boolean | null;
  inComplex?: boolean | null;
  city?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  listedAt?: Date | null;
}

export interface ParsedRow {
  /** 1-based spreadsheet row number, counting the header row as 1. */
  rowNumber: number;
  data: PropertyRowData | null;
  errors: ImportRowError[];
}

const REQUIRED_MESSAGE = 'Bu alan zorunlu.';

/** Parses every data row and flags duplicate external IDs (all occurrences are errors). */
export function parseRows(file: TabularFile, mapping: ImportMapping): ParsedRow[] {
  const index = new Map(file.headers.map((h, i) => [h, i]));
  const colOf = (key: ImportFieldKey): number | undefined => {
    const header = mapping.columns[key];
    return header === undefined ? undefined : index.get(header);
  };

  const parsed = file.rows.map((cells, i) => parseRow(cells, i + 2, colOf, mapping));

  const byId = new Map<string, ParsedRow[]>();
  for (const row of parsed) {
    if (!row.data) continue;
    const list = byId.get(row.data.externalId) ?? [];
    list.push(row);
    byId.set(row.data.externalId, list);
  }
  for (const rows of byId.values()) {
    if (rows.length < 2) continue;
    const numbers = rows.map((r) => r.rowNumber).join(', ');
    for (const row of rows) {
      row.errors.push({
        rowNumber: row.rowNumber,
        field: 'externalId',
        message: `Aynı ilan no dosyada birden fazla satırda var (satır ${numbers}).`,
      });
      row.data = null;
    }
  }
  return parsed;
}

function parseRow(
  cells: Cell[],
  rowNumber: number,
  colOf: (key: ImportFieldKey) => number | undefined,
  mapping: ImportMapping,
): ParsedRow {
  const errors: ImportRowError[] = [];
  const out: Partial<PropertyRowData> = {};

  /** Runs a parser on a mapped column. Returns undefined when unmapped. */
  function read<T>(key: ImportFieldKey, parse: (cell: Cell) => Parsed<T>): T | null | undefined {
    const col = colOf(key);
    if (col === undefined) return undefined;
    const result = parse(cells[col] ?? null);
    if (!result.ok) {
      errors.push({ rowNumber, field: key, message: result.message });
      return undefined;
    }
    return result.value;
  }
  /** Required fields are always mapped (validateMapping); undefined here means a parse error. */
  function required<T>(key: ImportFieldKey, value: T | null | undefined): T | undefined {
    if (value === null) {
      errors.push({ rowNumber, field: key, message: REQUIRED_MESSAGE });
      return undefined;
    }
    return value;
  }

  const externalId = required(
    'externalId',
    read('externalId', (c) => parseText(c, 100)),
  );
  const title = required(
    'title',
    read('title', (c) => parseText(c, 200)),
  );
  const listingType = required('listingType', read('listingType', parseListingType));

  const set = <K extends keyof PropertyRowData>(k: K, v: PropertyRowData[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };

  set(
    'description',
    read('description', (c) => parseLongText(c, 10_000)),
  );
  set(
    'propertyType',
    read('propertyType', (c) => parseText(c, 60)),
  );
  set('status', read('status', parseStatus));
  set(
    'grossAreaM2',
    read('grossAreaM2', (c) => parseArea(c, mapping.numberFormat)),
  );
  set(
    'netAreaM2',
    read('netAreaM2', (c) => parseArea(c, mapping.numberFormat)),
  );
  set(
    'bathroomCount',
    read('bathroomCount', (c) => parseInteger(c, 0, 50)),
  );
  set(
    'floor',
    read('floor', (c) => parseText(c, 30)),
  );
  set(
    'totalFloors',
    read('totalFloors', (c) => parseInteger(c, 0, 200)),
  );
  set('buildingAge', read('buildingAge', parseBuildingAge));
  set(
    'heatingType',
    read('heatingType', (c) => parseText(c, 60)),
  );
  set('furnished', read('furnished', parseBoolean));
  set('inComplex', read('inComplex', parseBoolean));
  set(
    'city',
    read('city', (c) => parseText(c, 60)),
  );
  set(
    'district',
    read('district', (c) => parseText(c, 60)),
  );
  set(
    'neighborhood',
    read('neighborhood', (c) => parseText(c, 100)),
  );
  set('listedAt', read('listedAt', parseDate));

  const rooms = read('rooms', parseRooms);
  if (rooms !== undefined) {
    out.roomLayout = rooms?.layout ?? null;
    out.bedroomCount = rooms?.bedroomCount ?? null;
  }

  // Price and currency are resolved together: cell suffix > currency column > default.
  const price = read('price', (c) => parsePrice(c, mapping.numberFormat));
  const currencyColumn = read('currency', parseCurrency);
  if (price !== undefined) {
    if (price === null) {
      out.priceMinor = null;
      out.priceCurrency = null;
    } else {
      const currency = price.currency ?? currencyColumn ?? mapping.defaultCurrency;
      if (price.currency && currencyColumn && price.currency !== currencyColumn) {
        errors.push({
          rowNumber,
          field: 'currency',
          message: 'Fiyattaki para birimi, para birimi sütunuyla çelişiyor.',
        });
      } else if (!currency) {
        errors.push({
          rowNumber,
          field: 'price',
          message:
            'Para birimi belirlenemedi. Para birimi sütunu ya da varsayılan para birimi seçin.',
        });
      } else {
        out.priceMinor = price.amountMinor;
        out.priceCurrency = currency;
      }
    }
  }

  if (
    errors.length > 0 ||
    externalId === undefined ||
    title === undefined ||
    listingType === undefined
  ) {
    return { rowNumber, data: null, errors };
  }
  return { rowNumber, data: { ...out, externalId, title, listingType }, errors };
}
