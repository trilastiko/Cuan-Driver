// Kode lisensi Pro: format CUAN-XXXX-XXXX.
// Alfabet tanpa karakter membingungkan (0/O, 1/I/L) supaya gampang diketik
// dari chat WhatsApp.

export const LICENSE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Kode demo — hanya diterima server ketika DEMO_MODE=true (7 hari Pro). */
export const DEMO_LICENSE_CODE = 'CUAN-DEMO-2026';

export const LICENSE_RE = new RegExp(`^CUAN-[${LICENSE_ALPHABET}]{4}-[${LICENSE_ALPHABET}]{4}$`);

/** Normalisasi input user: buang spasi, kapitalkan, samakan strip. */
export function normalizeLicense(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '').replace(/–|—/g, '-');
}

export function isValidLicenseFormat(code: string): boolean {
  return LICENSE_RE.test(code) || code === DEMO_LICENSE_CODE;
}

/**
 * Buat satu kode lisensi. `randomBytes` harus mengembalikan byte acak
 * (crypto.getRandomValues di Workers/browser).
 */
export function generateLicenseCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += LICENSE_ALPHABET[bytes[i] % LICENSE_ALPHABET.length];
    if (i === 3) s += '-';
  }
  return `CUAN-${s}`;
}

/** Kode referral pendek (6 karakter) dari alfabet yang sama. */
export function generateReferralCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += LICENSE_ALPHABET[bytes[i] % LICENSE_ALPHABET.length];
  return s;
}

/** Masa berlaku Pro per tier, dalam hari. */
export function tierDays(tier: string): number {
  if (tier === 'yearly') return 365;
  if (tier === 'demo') return 7;
  return 30; // monthly
}

/** Tambah `days` hari ke masa Pro; kalau masih aktif, diperpanjang. */
export function extendProUntil(current: string | null, days: number, now: Date = new Date()): string {
  const base = current && new Date(current).getTime() > now.getTime() ? new Date(current) : now;
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

export function isProActive(pro_expires_at: string | null | undefined, now: Date = new Date()): boolean {
  return !!pro_expires_at && new Date(pro_expires_at).getTime() > now.getTime();
}
