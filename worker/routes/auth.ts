import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { hashPassword, verifyPassword, makeToken } from '../auth';
import { checkRate, clientIp, getUserByEmail, publicUser, upsertSettings, uuid, type UserRow } from '../db';
import { asString, isEmail } from '../../shared/validate';
import { DEFAULT_SETTINGS } from '../../shared/types';
import { extendProUntil, generateReferralCode } from '../../shared/license';

const REFERRAL_BONUS_DAYS = 7;

const app = new Hono<AppEnv>();

app.post('/register', async (c) => {
  const db = c.env.DB;
  if (!(await checkRate(db, `reg:${clientIp(c.req.raw)}`, 10, 3600))) {
    return c.json({ error: 'Terlalu banyak percobaan, coba lagi nanti' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const email = asString(body.email, { def: '' }).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const name = asString(body.name, { def: '', max: 60 });
  const referralInput = asString(body.referral_code, { def: '', max: 20 }).toUpperCase();

  if (!isEmail(email)) return c.json({ error: 'Format email tidak valid' }, 400);
  if (password.length < 6) return c.json({ error: 'Password minimal 6 karakter' }, 400);

  const existing = await getUserByEmail(db, email);
  if (existing) return c.json({ error: 'Email sudah terdaftar, silakan masuk' }, 409);

  const id = uuid();
  const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const passwordHash = await hashPassword(password);

  // Referral: pemberi & penerima sama-sama dapat bonus Pro.
  let referredBy: string | null = null;
  let proExpiresAt: string | null = null;
  if (referralInput) {
    const referrer = await db
      .prepare('SELECT id, pro_expires_at FROM users WHERE referral_code = ?')
      .bind(referralInput)
      .first<{ id: string; pro_expires_at: string | null }>();
    if (referrer) {
      referredBy = referrer.id;
      proExpiresAt = extendProUntil(null, REFERRAL_BONUS_DAYS);
      await db
        .prepare('UPDATE users SET pro_expires_at = ?, is_pro = 1 WHERE id = ?')
        .bind(extendProUntil(referrer.pro_expires_at, REFERRAL_BONUS_DAYS), referrer.id)
        .run();
    }
  }

  // Kode referral milik user baru — coba ulang jika tabrakan (sangat jarang).
  let created: UserRow | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const refCode = generateReferralCode(rand);
    try {
      await db
        .prepare(
          `INSERT INTO users (id, email, name, password_hash, is_pro, pro_expires_at, referral_code, referred_by, free_scans_used)
           VALUES (?,?,?,?,?,?,?,?,0)`
        )
        .bind(id, email, name, passwordHash, proExpiresAt ? 1 : 0, proExpiresAt, refCode, referredBy)
        .run();
      created = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
    } catch (err) {
      const msg = String(err);
      if (msg.includes('users.email')) return c.json({ error: 'Email sudah terdaftar, silakan masuk' }, 409);
      if (!msg.includes('users.referral_code')) throw err;
    }
  }
  if (!created) return c.json({ error: 'Gagal membuat akun, coba lagi' }, 500);

  await upsertSettings(db, id, { ...DEFAULT_SETTINGS });

  const token = await makeToken(c.env, id);
  return c.json({ token, user: publicUser(created) }, 201);
});

app.post('/login', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const email = asString(body.email, { def: '' }).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!(await checkRate(db, `login:${email}:${clientIp(c.req.raw)}`, 10, 900))) {
    return c.json({ error: 'Terlalu banyak percobaan, tunggu 15 menit' }, 429);
  }

  const invalid = () => c.json({ error: 'Email atau password salah' }, 401);
  if (!isEmail(email) || !password) return invalid();

  const user = await getUserByEmail(db, email);
  if (!user) return invalid();
  if (!(await verifyPassword(password, user.password_hash))) return invalid();

  const token = await makeToken(c.env, user.id);
  return c.json({ token, user: publicUser(user) });
});

export default app;
