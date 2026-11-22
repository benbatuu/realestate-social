import { parse as parseCsv } from 'csv-parse/sync';
import { readSheet } from 'read-excel-file/node';

export type Cell = string | number | boolean | Date | null;

export interface TabularFile {
  format: 'CSV' | 'XLSX';
  encoding: string | null;
  delimiter: string | null;
  headers: string[];
  /** Data rows (header excluded); each row has exactly headers.length cells. */
  rows: Cell[][];
}

export class FileReadError extends Error {
  constructor(
    readonly code: 'FILE_UNSUPPORTED' | 'FILE_EMPTY' | 'FILE_TOO_MANY_ROWS',
    message: string,
  ) {
    super(message);
    this.name = 'FileReadError';
  }
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
/** Cap on the total uncompressed size of an XLSX (zip bomb guard). */
const MAX_XLSX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

function isZip(buf: Buffer): boolean {
  return ZIP_MAGIC.every((b, i) => buf[i] === b);
}

/**
 * Sums the uncompressed sizes in the zip central directory without inflating anything.
 * Returns null if the directory cannot be read (the file is then rejected as unsupported).
 */
export function zipUncompressedSize(buf: Buffer): number | null {
  const EOCD = 0x06054b50;
  const minEocd = 22;
  for (let i = buf.length - minEocd; i >= Math.max(0, buf.length - minEocd - 0xffff); i--) {
    if (buf.readUInt32LE(i) !== EOCD) continue;
    const entries = buf.readUInt16LE(i + 10);
    let offset = buf.readUInt32LE(i + 16);
    let total = 0;
    for (let n = 0; n < entries; n++) {
      if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) return null;
      total += buf.readUInt32LE(offset + 24);
      const nameLen = buf.readUInt16LE(offset + 28);
      const extraLen = buf.readUInt16LE(offset + 30);
      const commentLen = buf.readUInt16LE(offset + 32);
      offset += 46 + nameLen + extraLen + commentLen;
    }
    return total;
  }
  return null;
}

/** UTF-8 when valid (BOM or not), otherwise Windows-1254, which Turkish Excel uses for CSV. */
export function decodeText(buf: Buffer): { text: string; encoding: string } {
  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const body = hasBom ? buf.subarray(3) : buf;
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(body), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1254').decode(body), encoding: 'Windows-1254' };
  }
}

/** Picks the delimiter that splits the header line into the most fields (outside quotes). */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ',';
}

function cleanHeaders(raw: Cell[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((cell, i) => {
    const base =
      (cell === null || cell === undefined ? '' : String(cell)).replace(/\s+/g, ' ').trim() ||
      `Sütun ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

function isBlankRow(row: Cell[]): boolean {
  return row.every((c) => c === null || (typeof c === 'string' && c.trim() === ''));
}

function finalize(
  format: TabularFile['format'],
  table: Cell[][],
  meta: { encoding: string | null; delimiter: string | null },
  maxRows: number,
): TabularFile {
  const nonBlank = table.filter((r) => !isBlankRow(r));
  const [headerRow, ...dataRows] = nonBlank;
  if (!headerRow || dataRows.length === 0) {
    throw new FileReadError('FILE_EMPTY', 'File has no data rows under a header row');
  }
  if (dataRows.length > maxRows) {
    throw new FileReadError('FILE_TOO_MANY_ROWS', `File has more than ${maxRows} rows`);
  }
  const headers = cleanHeaders(headerRow);
  const rows = dataRows.map((r) => headers.map((_, i) => r[i] ?? null));
  return { format, headers, rows, ...meta };
}

/** Reads a CSV or XLSX upload into headers + rows. Throws FileReadError for user errors. */
export async function readTabularFile(
  buf: Buffer,
  fileName: string,
  maxRows: number,
): Promise<TabularFile> {
  const lower = fileName.toLowerCase();
  if (isZip(buf)) {
    if (!lower.endsWith('.xlsx')) {
      throw new FileReadError('FILE_UNSUPPORTED', 'Only .xlsx spreadsheets are supported');
    }
    const uncompressed = zipUncompressedSize(buf);
    if (uncompressed === null || uncompressed > MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw new FileReadError('FILE_UNSUPPORTED', 'Spreadsheet could not be read safely');
    }
    let data: Cell[][];
    try {
      data = (await readSheet(buf, 1)) as Cell[][];
    } catch {
      throw new FileReadError('FILE_UNSUPPORTED', 'Spreadsheet could not be read');
    }
    return finalize('XLSX', data, { encoding: null, delimiter: null }, maxRows);
  }

  if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) {
    throw new FileReadError('FILE_UNSUPPORTED', 'Upload a .csv or .xlsx file');
  }
  if (buf.subarray(0, 4096).includes(0)) {
    throw new FileReadError('FILE_UNSUPPORTED', 'File is not text');
  }
  const { text, encoding } = decodeText(buf);
  const delimiter = detectDelimiter(text);
  let records: string[][];
  try {
    records = parseCsv(text, {
      delimiter,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      // +2: header row and one row past the limit, so "too many rows" is detectable.
      to_line: maxRows + 2 + 1000,
    }) as string[][];
  } catch {
    throw new FileReadError('FILE_UNSUPPORTED', 'CSV could not be parsed');
  }
  const table: Cell[][] = records.map((r) => r.map((c) => (c.trim() === '' ? null : c)));
  return finalize('CSV', table, { encoding, delimiter }, maxRows);
}
