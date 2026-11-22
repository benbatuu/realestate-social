import writeXlsxFile from 'write-excel-file/node';
import { describe, expect, it } from 'vitest';
import {
  decodeText,
  detectDelimiter,
  FileReadError,
  readTabularFile,
  zipUncompressedSize,
} from './file-reader';

describe('decodeText', () => {
  it('reads UTF-8 with and without BOM', () => {
    const text = 'İlan No;Başlık\n1;Şişli';
    expect(decodeText(Buffer.from(text, 'utf8'))).toEqual({ text, encoding: 'UTF-8' });
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
    expect(decodeText(bom)).toEqual({ text, encoding: 'UTF-8' });
  });

  it('falls back to Windows-1254 for Turkish Excel CSV bytes', () => {
    // "Şişli Çağ" in Windows-1254: Ş=0xDE ş=0xFE i l i, space, Ç=0xC7 a ğ=0xF0
    const bytes = Buffer.from([0xde, 0x69, 0xfe, 0x6c, 0x69, 0x20, 0xc7, 0x61, 0xf0]);
    expect(decodeText(bytes)).toEqual({ text: 'Şişli Çağ', encoding: 'Windows-1254' });
  });
});

describe('detectDelimiter', () => {
  it('prefers the separator that splits the header the most, ignoring quoted text', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('"x;y;z",b,c')).toBe(',');
    expect(detectDelimiter('a\tb')).toBe('\t');
  });
});

describe('readTabularFile', () => {
  it('reads a semicolon CSV, makes headers unique and skips blank rows', async () => {
    const csv = 'İlan No;Başlık;Başlık;\n1;Daire;Kopya;x\n\n2;Villa;;\n';
    const file = await readTabularFile(Buffer.from(csv, 'utf8'), 'portfoy.csv', 100);
    expect(file.format).toBe('CSV');
    expect(file.delimiter).toBe(';');
    expect(file.headers).toEqual(['İlan No', 'Başlık', 'Başlık (2)', 'Sütun 4']);
    expect(file.rows).toEqual([
      ['1', 'Daire', 'Kopya', 'x'],
      ['2', 'Villa', null, null],
    ]);
  });

  it('reads an XLSX with typed cells', async () => {
    const xlsx = await writeXlsxFile([
      [{ value: 'İlan No' }, { value: 'Fiyat' }, { value: 'İlan Tarihi' }],
      [
        { value: 'A-1' },
        { value: 4_500_000 },
        { value: new Date(Date.UTC(2025, 10, 1)), format: 'dd.mm.yyyy' },
      ],
    ]).toBuffer();
    expect(zipUncompressedSize(xlsx)).toBeGreaterThan(0);
    const file = await readTabularFile(xlsx, 'portfoy.xlsx', 100);
    expect(file.format).toBe('XLSX');
    expect(file.headers).toEqual(['İlan No', 'Fiyat', 'İlan Tarihi']);
    expect(file.rows[0]?.[0]).toBe('A-1');
    expect(file.rows[0]?.[1]).toBe(4_500_000);
    expect(file.rows[0]?.[2]).toBeInstanceOf(Date);
  });

  it('rejects unsupported, empty and oversized files with codes', async () => {
    await expect(readTabularFile(Buffer.from('a,b\n'), 'x.csv', 10)).rejects.toMatchObject({
      code: 'FILE_EMPTY',
    });
    await expect(readTabularFile(Buffer.from('%PDF-1.7'), 'x.pdf', 10)).rejects.toBeInstanceOf(
      FileReadError,
    );
    const many = 'id\n' + Array.from({ length: 11 }, (_, i) => String(i)).join('\n');
    await expect(readTabularFile(Buffer.from(many), 'x.csv', 10)).rejects.toMatchObject({
      code: 'FILE_TOO_MANY_ROWS',
    });
  });
});
