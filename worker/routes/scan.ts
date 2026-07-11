import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../auth';
import { checkRate, getUserById } from '../db';
import {
  ALLOWED_MEDIA, AiError, base64ToBytes, isAiConfigured, scanScreenshot, sha256Hex,
} from '../ai';
import { isPlatform } from '../../shared/platforms';
import { isProActive } from '../../shared/license';
import type { ParsedScan, Platform } from '../../shared/types';

// Free tier: jatah percobaan AI scan seumur akun (teaser sebelum Pro).
export const FREE_SCAN_LIMIT = 3;

// ~2MB gambar setelah kompresi klien (base64 ≈ 4/3 ukuran asli).
const MAX_BASE64_LEN = 2_800_000;

const app = new Hono<AppEnv>();
app.use('*', requireAuth);

app.post('/', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  if (!(await checkRate(db, `scan:${userId}`, 30, 3600))) {
    return c.json({ error: 'Terlalu sering scan, tunggu sebentar ya' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const image = typeof body.image_base64 === 'string' ? body.image_base64 : '';
  const mediaType = ALLOWED_MEDIA.includes(body.media_type) ? body.media_type : null;
  const hint: Platform | undefined = isPlatform(body.platform) ? body.platform : undefined;

  if (!image) return c.json({ error: 'Lampirkan screenshot dulu' }, 400);
  if (!mediaType) return c.json({ error: 'Format gambar harus JPG/PNG/WebP' }, 400);
  if (image.length > MAX_BASE64_LEN) {
    return c.json({ error: 'Gambar terlalu besar (maks ±2MB)' }, 413);
  }

  const user = await getUserById(db, userId);
  if (!user) return c.json({ error: 'Akun tidak ditemukan' }, 404);
  const pro = isProActive(user.pro_expires_at);
  if (!pro && user.free_scans_used >= FREE_SCAN_LIMIT) {
    return c.json(
      {
        error: 'Jatah scan gratis habis. Upgrade ke Pro untuk scan tanpa batas',
        code: 'upgrade_required',
      },
      402
    );
  }

  // Cache: screenshot identik tidak dibayar dua kali (dan tidak memotong jatah).
  const hash = await sha256Hex(image);
  const cached = await db
    .prepare('SELECT result FROM scan_cache WHERE image_hash = ?')
    .bind(hash)
    .first<{ result: string }>();
  if (cached) {
    const parsed = JSON.parse(cached.result) as ParsedScan;
    if (hint) parsed.platform = hint;
    return c.json({ parsed: { ...parsed, cached: true }, screenshot_key: null, scans_left: scansLeft(pro, user.free_scans_used) });
  }

  let parsed: ParsedScan;
  try {
    parsed = await scanScreenshot(c.env, image, mediaType, hint);
  } catch (err) {
    if (err instanceof AiError) {
      return c.json({ error: err.message }, err.status as 402);
    }
    throw err;
  }

  await db
    .prepare('INSERT OR REPLACE INTO scan_cache (image_hash, platform, result) VALUES (?,?,?)')
    .bind(hash, parsed.platform, JSON.stringify(parsed))
    .run();

  // Simpan screenshot ke R2 kalau binding tersedia (opsional).
  let screenshotKey: string | null = null;
  if (c.env.SCREENSHOTS) {
    try {
      const ext = mediaType.split('/')[1].replace('jpeg', 'jpg');
      screenshotKey = `scans/${userId}/${hash}.${ext}`;
      await c.env.SCREENSHOTS.put(screenshotKey, base64ToBytes(image), {
        httpMetadata: { contentType: mediaType },
      });
    } catch (err) {
      console.error('[scan] R2 put gagal (diabaikan):', err);
      screenshotKey = null;
    }
  }

  let freeUsed = user.free_scans_used;
  if (!pro) {
    freeUsed += 1;
    await db
      .prepare('UPDATE users SET free_scans_used = ? WHERE id = ?')
      .bind(freeUsed, userId)
      .run();
  }

  return c.json({
    parsed,
    screenshot_key: screenshotKey,
    mock_mode: !isAiConfigured(c.env),
    scans_left: scansLeft(pro, freeUsed),
  });
});

function scansLeft(pro: boolean, used: number): number | null {
  return pro ? null : Math.max(0, FREE_SCAN_LIMIT - used);
}

export default app;
