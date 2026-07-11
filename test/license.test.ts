import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  generateLicenseCode, generateReferralCode, normalizeLicense,
  isValidLicenseFormat, tierDays, extendProUntil, isProActive, DEMO_LICENSE_CODE,
} from '../shared/license';

const rb = (n: number) => webcrypto.getRandomValues(new Uint8Array(n));

describe('license codes', () => {
  it('format CUAN-XXXX-XXXX dan lolos validasi sendiri', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateLicenseCode(rb);
      expect(code).toMatch(/^CUAN-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
      expect(isValidLicenseFormat(code)).toBe(true);
    }
  });

  it('normalisasi input user yang berantakan', () => {
    expect(normalizeLicense(' cuan-ab2c-def3 ')).toBe('CUAN-AB2C-DEF3');
    expect(normalizeLicense('CUAN–AB2C–DEF3')).toBe('CUAN-AB2C-DEF3'); // en-dash
  });

  it('kode demo dikenali', () => {
    expect(isValidLicenseFormat(DEMO_LICENSE_CODE)).toBe(true);
  });

  it('kode acak/salah ditolak', () => {
    expect(isValidLicenseFormat('CUAN-0000-0000')).toBe(false); // 0 tidak ada di alfabet
    expect(isValidLicenseFormat('BAYAR-DONG')).toBe(false);
  });

  it('referral 6 karakter', () => {
    expect(generateReferralCode(rb)).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
  });
});

describe('masa Pro', () => {
  const now = new Date('2026-07-11T00:00:00Z');
  it('tier menghasilkan durasi benar', () => {
    expect(tierDays('monthly')).toBe(30);
    expect(tierDays('yearly')).toBe(365);
    expect(tierDays('demo')).toBe(7);
  });
  it('perpanjangan menumpuk di atas masa aktif', () => {
    const first = extendProUntil(null, 30, now);
    expect(new Date(first).getTime()).toBe(now.getTime() + 30 * 86400_000);
    const second = extendProUntil(first, 30, now);
    expect(new Date(second).getTime()).toBe(now.getTime() + 60 * 86400_000);
  });
  it('masa kedaluwarsa dimulai dari sekarang lagi', () => {
    const expired = new Date(now.getTime() - 86400_000).toISOString();
    const renewed = extendProUntil(expired, 30, now);
    expect(new Date(renewed).getTime()).toBe(now.getTime() + 30 * 86400_000);
  });
  it('isProActive', () => {
    expect(isProActive(null, now)).toBe(false);
    expect(isProActive(new Date(now.getTime() + 1000).toISOString(), now)).toBe(true);
    expect(isProActive(new Date(now.getTime() - 1000).toISOString(), now)).toBe(false);
  });
});
