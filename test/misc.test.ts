import { describe, it, expect } from 'vitest';
import { formatRupiah, formatRupiahSigned, parseRupiah, groupThousands } from '../shared/money';
import { todayStr, shiftDate, lastNDates, formatDateID, isValidDateStr } from '../shared/dates';

describe('money', () => {
  it('format', () => {
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(250000)).toBe('Rp250.000');
    expect(formatRupiah(1234567)).toBe('Rp1.234.567');
    expect(formatRupiah(-21000)).toBe('-Rp21.000');
    expect(formatRupiahSigned(5000)).toBe('+Rp5.000');
    expect(groupThousands(999)).toBe('999');
  });
  it('parse', () => {
    expect(parseRupiah('Rp 25.000')).toBe(25000);
    expect(parseRupiah('25,000')).toBe(25000);
    expect(parseRupiah('abc')).toBeNaN();
  });
});

describe('dates', () => {
  it('todayStr WIB berformat YYYY-MM-DD', () => {
    expect(todayStr('Asia/Jakarta', new Date('2026-07-11T18:00:00Z'))).toBe('2026-07-12'); // 01:00 WIB
    expect(todayStr('Asia/Jakarta', new Date('2026-07-11T10:00:00Z'))).toBe('2026-07-11');
  });
  it('shiftDate melewati batas bulan/tahun', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01');
  });
  it('lastNDates urut naik & inklusif', () => {
    expect(lastNDates(3, '2026-07-11')).toEqual(['2026-07-09', '2026-07-10', '2026-07-11']);
  });
  it('formatDateID', () => {
    expect(formatDateID('2026-07-11')).toBe('Sabtu, 11 Juli 2026');
  });
  it('isValidDateStr', () => {
    expect(isValidDateStr('2026-07-11')).toBe(true);
    expect(isValidDateStr('2026-13-01')).toBe(false);
    expect(isValidDateStr('kemarin')).toBe(false);
  });
});
