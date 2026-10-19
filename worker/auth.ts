import { sign, verify } from 'hono/jwt';
import type { Context, Next } from 'hono';
import type { AppEnv, Env } from './env';

const PBKDF2_ITERATIONS = 100_000;
const TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30 hari

// Secret sementara per-isolate ketika JWT_SECRET tidak diset (dev/demo saja).
// Tidak ada secret yang di-hardcode; sesi hangus saat worker restart.
let ephemeralSecret: string | null = null;

export function jwtSecret(env: Env): string {
  if (env.JWT_SECRET && env.JWT_SECRET.length >= 16) return env.JWT_SECRET;
  if (!ephemeralSecret) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    ephemeralSecret = b64(bytes);
    console.warn(
      '[cuan-driver] JWT_SECRET belum diset — memakai secret sementara. ' +
        'Sesi akan hangus saat worker restart. Set via: wrangler secret put JWT_SECRET'
    );
  }
  return ephemeralSecret;
}

function b64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}

/** Format simpan: pbkdf2$<iterations>$<salt b64>$<hash b64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 1_000_000) return false;
  const salt = unb64(parts[2]);
  const expected = unb64(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(expected, actual);
}

export async function makeToken(env: Env, userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, iat: now, exp: now + TOKEN_TTL_SEC }, jwtSecret(env));
}

/** Middleware: wajib Bearer token valid; menaruh userId di context. */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ error: 'Silakan masuk dulu' }, 401);
  try {
    const payload = await verify(token, jwtSecret(c.env), 'HS256');
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('bad sub');
    c.set('userId', payload.sub);
  } catch {
    return c.json({ error: 'Sesi berakhir, silakan masuk lagi' }, 401);
  }
  await next();
}
