import { IMPORT_FIELDS, type ImportRowError } from '@app/shared';

/** UTF-8 byte order mark: tells Excel the file is UTF-8. */
const BOM = String.fromCharCode(0xfeff);

const LABELS = new Map<string, string>(IMPORT_FIELDS.map((f) => [f.key, f.label]));

/**
 * Prevents spreadsheet formula injection: Excel executes cells that start with =, +, -, @
 * (or tab/CR). Prefixing an apostrophe makes them plain text.
 */
export function neutralizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = neutralizeCell(value);
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Semicolon-separated UTF-8 with BOM, which Turkish Excel opens correctly by double-click. */
export function errorReportCsv(errors: ImportRowError[]): string {
  const lines = [['Satır', 'Alan', 'Hata'].join(';')];
  for (const e of errors) {
    lines.push(
      [String(e.rowNumber), e.field ? (LABELS.get(e.field) ?? e.field) : '', e.message]
        .map(csvCell)
        .join(';'),
    );
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
