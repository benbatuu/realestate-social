import { describe, expect, it } from 'vitest';
import { errorReportCsv, neutralizeCell } from './error-report';

describe('error report CSV', () => {
  it('neutralises formula-looking cells', () => {
    expect(neutralizeCell('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(neutralizeCell('-5')).toBe(`'-5`);
    expect(neutralizeCell('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(neutralizeCell('Fiyat okunamadı.')).toBe('Fiyat okunamadı.');
  });

  it('writes a BOM, Turkish headers, field labels and quotes where needed', () => {
    const csv = errorReportCsv([
      { rowNumber: 4, field: 'price', message: 'Fiyat okunamadı; biçim "4.500.000".' },
      { rowNumber: 7, field: null, message: '=cmd' },
    ]);
    expect(csv.startsWith('﻿Satır;Alan;Hata\r\n')).toBe(true);
    expect(csv).toContain('4;Fiyat;"Fiyat okunamadı; biçim ""4.500.000""."');
    expect(csv).toContain(`7;;'=cmd`);
  });
});
