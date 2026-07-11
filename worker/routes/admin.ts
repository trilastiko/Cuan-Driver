import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../env';
import { timingSafeEqualStr } from '../auth';
import { asNumber } from '../../shared/validate';
import { generateLicenseCode } from '../../shared/license';

const app = new Hono<AppEnv>();

async function adminAuth(c: Context<AppEnv>, next: Next) {
  const configured = c.env.ADMIN_TOKEN;
  if (!configured) {
    return c.json({ error: 'Admin nonaktif — set secret ADMIN_TOKEN dulu' }, 403);
  }
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !timingSafeEqualStr(token, configured)) {
    return c.json({ error: 'Token admin salah' }, 401);
  }
  await next();
}

app.use('*', adminAuth);

app.get('/stats', async (c) => {
  const db = c.env.DB;
  const one = async (sql: string, ...binds: unknown[]) =>
    (await db.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;

  const now = new Date().toISOString();
  const [users, proUsers, earnings, earningsToday, licTotal, licUsed] = await Promise.all([
    one('SELECT COUNT(*) n FROM users'),
    one('SELECT COUNT(*) n FROM users WHERE pro_expires_at > ?', now),
    one('SELECT COUNT(*) n FROM earnings'),
    one("SELECT COUNT(*) n FROM earnings WHERE date = date('now')"),
    one('SELECT COUNT(*) n FROM license_codes'),
    one('SELECT COUNT(*) n FROM license_codes WHERE used_by IS NOT NULL'),
  ]);

  return c.json({
    users,
    pro_users: proUsers,
    earnings_entries: earnings,
    earnings_today: earningsToday,
    licenses: { total: licTotal, used: licUsed, available: licTotal - licUsed },
  });
});

app.get('/users', async (c) => {
  const limit = asNumber(c.req.query('limit'), { min: 1, max: 500, def: 50 });
  const rs = await c.env.DB.prepare(
    `SELECT id, email, name, pro_expires_at, referral_code, free_scans_used, created_at
     FROM users ORDER BY created_at DESC LIMIT ?`
  )
    .bind(limit)
    .all();
  return c.json({ users: rs.results ?? [] });
});

// Buat kode lisensi baru (untuk dikirim manual ke pembeli via WhatsApp).
app.post('/licenses', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const count = Math.round(asNumber(body.count, { min: 1, max: 100, def: 5 }));
  const tier = body.tier === 'yearly' ? 'yearly' : 'monthly';
  const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateLicenseCode(rand);
      try {
        await c.env.DB.prepare('INSERT INTO license_codes (code, tier) VALUES (?, ?)')
          .bind(code, tier)
          .run();
        codes.push(code);
        break;
      } catch (err) {
        if (!String(err).includes('license_codes')) throw err; // selain tabrakan PK
      }
    }
  }
  return c.json({ codes, tier }, 201);
});

app.get('/licenses', async (c) => {
  const onlyUnused = c.req.query('unused') === '1';
  const limit = asNumber(c.req.query('limit'), { min: 1, max: 500, def: 100 });
  const rs = await c.env.DB.prepare(
    `SELECT code, tier, used_by, used_at, created_at FROM license_codes
     ${onlyUnused ? 'WHERE used_by IS NULL' : ''}
     ORDER BY created_at DESC LIMIT ?`
  )
    .bind(limit)
    .all();
  return c.json({ licenses: rs.results ?? [] });
});

export default app;
