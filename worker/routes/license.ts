import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../auth';
import { checkRate, getUserById, publicUser } from '../db';
import {
  DEMO_LICENSE_CODE, extendProUntil, isValidLicenseFormat, normalizeLicense, tierDays,
} from '../../shared/license';

const app = new Hono<AppEnv>();
app.use('*', requireAuth);

app.post('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  if (!(await checkRate(db, `lic:${userId}`, 10, 3600))) {
    return c.json({ error: 'Terlalu banyak percobaan, coba lagi nanti' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const code = normalizeLicense(typeof body.code === 'string' ? body.code : '');
  if (!isValidLicenseFormat(code)) {
    return c.json({ error: 'Format kode tidak dikenal (contoh: CUAN-AB2C-DEF3)' }, 400);
  }

  const user = await getUserById(db, userId);
  if (!user) return c.json({ error: 'Akun tidak ditemukan' }, 404);

  // Kode demo: hanya saat DEMO_MODE=true (7 hari Pro, tidak menyentuh tabel lisensi).
  if (code === DEMO_LICENSE_CODE) {
    if (c.env.DEMO_MODE !== 'true') {
      return c.json({ error: 'Kode tidak ditemukan' }, 404);
    }
    const until = extendProUntil(user.pro_expires_at, tierDays('demo'));
    await db
      .prepare('UPDATE users SET is_pro = 1, pro_expires_at = ?, license_code = ? WHERE id = ?')
      .bind(until, code, userId)
      .run();
    const updated = await getUserById(db, userId);
    return c.json({ ok: true, tier: 'demo', user: updated ? publicUser(updated) : null });
  }

  const lic = await db
    .prepare('SELECT code, tier, used_by FROM license_codes WHERE code = ?')
    .bind(code)
    .first<{ code: string; tier: string; used_by: string | null }>();
  if (!lic) return c.json({ error: 'Kode tidak ditemukan' }, 404);
  if (lic.used_by) return c.json({ error: 'Kode sudah pernah dipakai' }, 409);

  // Klaim atomik — kalau dua request balapan, hanya satu yang menang.
  const claim = await db
    .prepare(
      `UPDATE license_codes SET used_by = ?, used_at = datetime('now')
       WHERE code = ? AND used_by IS NULL`
    )
    .bind(userId, code)
    .run();
  const changes = (claim.meta as { changes?: number } | undefined)?.changes ?? 0;
  if (changes === 0) return c.json({ error: 'Kode sudah pernah dipakai' }, 409);

  const until = extendProUntil(user.pro_expires_at, tierDays(lic.tier));
  await db
    .prepare('UPDATE users SET is_pro = 1, pro_expires_at = ?, license_code = ? WHERE id = ?')
    .bind(until, code, userId)
    .run();

  const updated = await getUserById(db, userId);
  return c.json({ ok: true, tier: lic.tier, user: updated ? publicUser(updated) : null });
});

export default app;
