// Validator kecil tanpa dependensi — cukup untuk memvalidasi body API.

export function asNumber(
  v: unknown,
  opts: { min?: number; max?: number; def?: number } = {}
): number {
  let n = typeof v === 'string' && v.trim() !== '' ? Number(v) : (v as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    if (opts.def !== undefined) return opts.def;
    throw new ValidationError('Angka tidak valid');
  }
  if (opts.min !== undefined && n < opts.min) n = opts.min;
  if (opts.max !== undefined && n > opts.max) n = opts.max;
  return n;
}

export function asString(v: unknown, opts: { max?: number; def?: string } = {}): string {
  if (typeof v !== 'string') {
    if (opts.def !== undefined) return opts.def;
    throw new ValidationError('Teks tidak valid');
  }
  const s = v.trim();
  return opts.max ? s.slice(0, opts.max) : s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
}

export class ValidationError extends Error {
  status = 400;
}
