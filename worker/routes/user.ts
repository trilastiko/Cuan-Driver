import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../auth';
import { getSettings, getUserById, publicUser, upsertSettings } from '../db';
import { asNumber, asString } from '../../shared/validate';
import type { Settings } from '../../shared/types';
import { isPlatform } from '../../shared/platforms';
import { dailyCosts } from '../../shared/pnl';

const app = new Hono<AppEnv>();
app.use('*', requireAuth);

app.get('/profile', async (c) => {
  const userId = c.get('userId');
  const user = await getUserById(c.env.DB, userId);
  if (!user) return c.json({ error: 'Akun tidak ditemukan' }, 404);
  const settings = await getSettings(c.env.DB, userId);
  return c.json({
    user: publicUser(user),
    settings,
    daily_costs: dailyCosts(settings),
  });
});

app.put('/profile', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));

  if (typeof body.name === 'string') {
    await db
      .prepare('UPDATE users SET name = ? WHERE id = ?')
      .bind(asString(body.name, { max: 60 }), userId)
      .run();
  }

  if (body.settings && typeof body.settings === 'object') {
    const cur = await getSettings(db, userId);
    const s = body.settings as Record<string, unknown>;
    const money = (v: unknown, def: number) => asNumber(v, { min: 0, max: 50_000_000, def });
    const apps = Array.isArray(s.apps_used) ? s.apps_used.filter(isPlatform) : cur.apps_used;
    const next: Settings = {
      apps_used: apps.length > 0 ? apps : cur.apps_used,
      fuel_mode: s.fuel_mode === 'per_day' ? 'per_day' : s.fuel_mode === 'per_km' ? 'per_km' : cur.fuel_mode,
      fuel_cost_per_km: asNumber(s.fuel_cost_per_km, { min: 0, max: 10_000, def: cur.fuel_cost_per_km }),
      km_per_day: asNumber(s.km_per_day, { min: 0, max: 1_000, def: cur.km_per_day }),
      fuel_cost_per_day: money(s.fuel_cost_per_day, cur.fuel_cost_per_day),
      meal_cost_per_day: money(s.meal_cost_per_day, cur.meal_cost_per_day),
      other_cost_per_day: money(s.other_cost_per_day, cur.other_cost_per_day),
      installment_per_month: money(s.installment_per_month, cur.installment_per_month),
      service_per_month: money(s.service_per_month, cur.service_per_month),
      work_days_per_month: asNumber(s.work_days_per_month, { min: 1, max: 31, def: cur.work_days_per_month }),
      data_cost_per_day: money(s.data_cost_per_day, cur.data_cost_per_day),
      hours_per_day: asNumber(s.hours_per_day, { min: 1, max: 24, def: cur.hours_per_day }),
      target_daily_profit: money(s.target_daily_profit, cur.target_daily_profit),
    };
    await upsertSettings(db, userId, next);
  }

  const user = await getUserById(db, userId);
  const settings = await getSettings(db, userId);
  return c.json({ user: user ? publicUser(user) : null, settings, daily_costs: dailyCosts(settings) });
});

export default app;
