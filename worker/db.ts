import type { Settings, User } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { isProActive } from '../shared/license';

export function uuid(): string {
  return crypto.randomUUID();
}

// ---------- users ----------

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  is_pro: number;
  pro_expires_at: string | null;
  license_code: string | null;
  referral_code: string;
  referred_by: string | null;
  free_scans_used: number;
  created_at: string;
}

export function publicUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    is_pro: isProActive(row.pro_expires_at),
    pro_expires_at: row.pro_expires_at,
    referral_code: row.referral_code,
    free_scans_used: row.free_scans_used,
    created_at: row.created_at,
  };
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
}

// ---------- settings ----------

interface SettingsRow {
  user_id: string;
  apps_used: string;
  fuel_mode: string;
  fuel_cost_per_km: number;
  km_per_day: number;
  fuel_cost_per_day: number;
  meal_cost_per_day: number;
  other_cost_per_day: number;
  installment_per_month: number;
  service_per_month: number;
  work_days_per_month: number;
  data_cost_per_day: number;
  hours_per_day: number;
  target_daily_profit: number;
}

export function rowToSettings(row: SettingsRow | null): Settings {
  if (!row) return { ...DEFAULT_SETTINGS };
  let apps: Settings['apps_used'];
  try {
    apps = JSON.parse(row.apps_used);
    if (!Array.isArray(apps) || apps.length === 0) apps = DEFAULT_SETTINGS.apps_used;
  } catch {
    apps = DEFAULT_SETTINGS.apps_used;
  }
  return {
    apps_used: apps,
    fuel_mode: row.fuel_mode === 'per_day' ? 'per_day' : 'per_km',
    fuel_cost_per_km: row.fuel_cost_per_km,
    km_per_day: row.km_per_day,
    fuel_cost_per_day: row.fuel_cost_per_day,
    meal_cost_per_day: row.meal_cost_per_day,
    other_cost_per_day: row.other_cost_per_day,
    installment_per_month: row.installment_per_month,
    service_per_month: row.service_per_month,
    work_days_per_month: row.work_days_per_month,
    data_cost_per_day: row.data_cost_per_day,
    hours_per_day: row.hours_per_day,
    target_daily_profit: row.target_daily_profit,
  };
}

export async function getSettings(db: D1Database, userId: string): Promise<Settings> {
  const row = await db
    .prepare('SELECT * FROM user_settings WHERE user_id = ?')
    .bind(userId)
    .first<SettingsRow>();
  return rowToSettings(row);
}

export async function upsertSettings(db: D1Database, userId: string, s: Settings): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_settings (
        user_id, apps_used, fuel_mode, fuel_cost_per_km, km_per_day, fuel_cost_per_day,
        meal_cost_per_day, other_cost_per_day, installment_per_month, service_per_month,
        work_days_per_month, data_cost_per_day, hours_per_day, target_daily_profit, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        apps_used=excluded.apps_used, fuel_mode=excluded.fuel_mode,
        fuel_cost_per_km=excluded.fuel_cost_per_km, km_per_day=excluded.km_per_day,
        fuel_cost_per_day=excluded.fuel_cost_per_day, meal_cost_per_day=excluded.meal_cost_per_day,
        other_cost_per_day=excluded.other_cost_per_day, installment_per_month=excluded.installment_per_month,
        service_per_month=excluded.service_per_month, work_days_per_month=excluded.work_days_per_month,
        data_cost_per_day=excluded.data_cost_per_day, hours_per_day=excluded.hours_per_day,
        target_daily_profit=excluded.target_daily_profit, updated_at=datetime('now')`
    )
    .bind(
      userId,
      JSON.stringify(s.apps_used),
      s.fuel_mode,
      s.fuel_cost_per_km,
      s.km_per_day,
      s.fuel_cost_per_day,
      s.meal_cost_per_day,
      s.other_cost_per_day,
      s.installment_per_month,
      s.service_per_month,
      s.work_days_per_month,
      s.data_cost_per_day,
      s.hours_per_day,
      s.target_daily_profit
    )
    .run();
}

// ---------- rate limiting (fixed window di D1) ----------

export async function checkRate(
  db: D1Database,
  key: string,
  max: number,
  windowSec: number,
  nowMs: number = Date.now()
): Promise<boolean> {
  const nowSec = Math.floor(nowMs / 1000);
  const row = await db
    .prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; reset_at: number }>();
  if (!row || row.reset_at <= nowSec) {
    await db
      .prepare(
        `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`
      )
      .bind(key, nowSec + windowSec)
      .run();
    return true;
  }
  if (row.count >= max) return false;
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'local';
}
