import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../auth';
import { uuid } from '../db';
import { asNumber, asString } from '../../shared/validate';
import { isPlatform } from '../../shared/platforms';
import { isValidDateStr, shiftDate, todayStr } from '../../shared/dates';
import type { Earning, SummaryRow } from '../../shared/types';

const app = new Hono<AppEnv>();
app.use('*', requireAuth);

interface EarningRow {
  id: string;
  user_id: string;
  platform: string;
  gross_amount: number;
  order_count: number;
  incentive_amount: number;
  screenshot_key: string | null;
  parsed_data: string | null;
  date: string;
  hours_worked: number | null;
  created_at: string;
}

function rowToEarning(r: EarningRow): Earning {
  let parsed: unknown = undefined;
  if (r.parsed_data) {
    try {
      parsed = JSON.parse(r.parsed_data);
    } catch {
      parsed = undefined;
    }
  }
  return {
    id: r.id,
    platform: r.platform as Earning['platform'],
    gross_amount: r.gross_amount,
    order_count: r.order_count,
    incentive_amount: r.incentive_amount,
    screenshot_key: r.screenshot_key,
    parsed_data: parsed,
    date: r.date,
    hours_worked: r.hours_worked,
    created_at: r.created_at,
  };
}

// Tambah / perbarui pendapatan. Klien membuat id (UUID) sendiri supaya
// sinkronisasi offline idempoten — kirim ulang tidak menggandakan data.
app.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));

  const id = typeof body.id === 'string' && /^[0-9a-f-]{16,64}$/i.test(body.id) ? body.id : uuid();
  if (!isPlatform(body.platform)) return c.json({ error: 'Pilih aplikasi dulu' }, 400);
  if (!isValidDateStr(body.date)) return c.json({ error: 'Tanggal tidak valid' }, 400);

  const gross = asNumber(body.gross_amount, { min: 0, max: 10_000_000, def: NaN });
  if (!Number.isFinite(gross)) return c.json({ error: 'Isi pendapatan kotor dulu' }, 400);
  const orders = Math.round(asNumber(body.order_count, { min: 0, max: 500, def: 1 }));
  const incentive = asNumber(body.incentive_amount, { min: 0, max: 10_000_000, def: 0 });
  const hours =
    body.hours_worked === undefined || body.hours_worked === null
      ? null
      : asNumber(body.hours_worked, { min: 0, max: 24, def: 0 });

  let screenshotKey = asString(body.screenshot_key, { def: '', max: 200 });
  if (screenshotKey && !screenshotKey.startsWith(`scans/${userId}/`)) screenshotKey = '';

  let parsedData = '';
  if (body.parsed_data !== undefined && body.parsed_data !== null) {
    parsedData = JSON.stringify(body.parsed_data).slice(0, 8192);
  }

  await c.env.DB.prepare(
    `INSERT INTO earnings (id, user_id, platform, gross_amount, order_count, incentive_amount,
                           screenshot_key, parsed_data, date, hours_worked)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       platform=excluded.platform, gross_amount=excluded.gross_amount,
       order_count=excluded.order_count, incentive_amount=excluded.incentive_amount,
       screenshot_key=excluded.screenshot_key, parsed_data=excluded.parsed_data,
       date=excluded.date, hours_worked=excluded.hours_worked
     WHERE earnings.user_id = excluded.user_id`
  )
    .bind(
      id,
      userId,
      body.platform,
      gross,
      orders,
      incentive,
      screenshotKey || null,
      parsedData || null,
      body.date,
      hours
    )
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM earnings WHERE id = ?')
    .bind(id)
    .first<EarningRow>();
  if (!row || row.user_id !== userId) {
    // id tabrakan dengan milik user lain — sangat tidak mungkin dengan UUID.
    return c.json({ error: 'ID bentrok, coba lagi' }, 409);
  }
  return c.json({ earning: rowToEarning(row) }, 201);
});

// Daftar pendapatan (default 90 hari terakhir).
app.get('/', async (c) => {
  const userId = c.get('userId');
  const today = todayStr();
  const from = isValidDateStr(c.req.query('from')) ? c.req.query('from')! : shiftDate(today, -90);
  const to = isValidDateStr(c.req.query('to')) ? c.req.query('to')! : today;
  const limit = asNumber(c.req.query('limit'), { min: 1, max: 1000, def: 500 });

  const rs = await c.env.DB.prepare(
    `SELECT * FROM earnings WHERE user_id = ? AND date >= ? AND date <= ?
     ORDER BY date DESC, created_at DESC LIMIT ?`
  )
    .bind(userId, from, to, limit)
    .all<EarningRow>();

  return c.json({ earnings: (rs.results ?? []).map(rowToEarning), from, to });
});

// Ringkasan per tanggal+platform — klien menggabungkannya dengan settings
// untuk menghitung net (matematika ada di shared/pnl.ts).
app.get('/summary', async (c) => {
  const userId = c.get('userId');
  const today = todayStr();
  const from = isValidDateStr(c.req.query('from')) ? c.req.query('from')! : shiftDate(today, -7);
  const to = isValidDateStr(c.req.query('to')) ? c.req.query('to')! : today;

  const rs = await c.env.DB.prepare(
    `SELECT date, platform,
            SUM(gross_amount) AS gross,
            SUM(order_count) AS orders,
            SUM(incentive_amount) AS incentive,
            COUNT(*) AS entries
     FROM earnings WHERE user_id = ? AND date >= ? AND date <= ?
     GROUP BY date, platform ORDER BY date ASC`
  )
    .bind(userId, from, to)
    .all<SummaryRow>();

  return c.json({ summary: rs.results ?? [], from, to });
});

app.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const res = await c.env.DB.prepare('DELETE FROM earnings WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), userId)
    .run();
  const changes = (res.meta as { changes?: number } | undefined)?.changes ?? 0;
  if (changes === 0) return c.json({ error: 'Data tidak ditemukan' }, 404);
  return c.json({ ok: true });
});

export default app;
