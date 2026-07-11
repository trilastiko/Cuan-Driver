-- Cuan Driver — initial schema (D1 / SQLite)
-- Deviations from the draft spec schema, with rationale:
--  * users: + referral_code, pro_expires_at, free_scans_used (referral & paywall)
--  * user_settings: monthly amounts + work_days_per_month are stored instead of
--    pre-divided *_per_day values (the wizard asks monthly; derived values are
--    computed in shared/pnl.ts so math never drifts between client & server)
--  * scan_cache: dedupes identical screenshots to keep AI cost low
--  * rate_limits: naive fixed-window rate limiting in D1

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  is_pro INTEGER NOT NULL DEFAULT 0,
  pro_expires_at TEXT,
  license_code TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  free_scans_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  apps_used TEXT NOT NULL DEFAULT '["gojek"]', -- JSON array
  fuel_mode TEXT NOT NULL DEFAULT 'per_km',
  fuel_cost_per_km REAL NOT NULL DEFAULT 250,
  km_per_day REAL NOT NULL DEFAULT 100,
  fuel_cost_per_day REAL NOT NULL DEFAULT 25000,
  meal_cost_per_day REAL NOT NULL DEFAULT 20000,
  other_cost_per_day REAL NOT NULL DEFAULT 10000,
  installment_per_month REAL NOT NULL DEFAULT 0,
  service_per_month REAL NOT NULL DEFAULT 150000,
  work_days_per_month REAL NOT NULL DEFAULT 26,
  data_cost_per_day REAL NOT NULL DEFAULT 5000,
  hours_per_day REAL NOT NULL DEFAULT 10,
  target_daily_profit REAL NOT NULL DEFAULT 150000,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE earnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'gojek' | 'grab' | 'maxim' | 'indrive'
  gross_amount REAL NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 1,
  incentive_amount REAL NOT NULL DEFAULT 0,
  screenshot_key TEXT,     -- R2 object key
  parsed_data TEXT,        -- raw AI extraction (JSON)
  date TEXT NOT NULL,      -- YYYY-MM-DD (driver-local)
  hours_worked REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE license_codes (
  code TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly'
  used_by TEXT,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (used_by) REFERENCES users(id)
);

-- Cache of AI screenshot extractions, keyed by image hash — the same
-- screenshot is never billed twice.
CREATE TABLE scan_cache (
  image_hash TEXT PRIMARY KEY,
  platform TEXT,
  result TEXT NOT NULL, -- ParsedScan JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fixed-window rate limiting (key = scope:identity).
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL -- epoch seconds
);

CREATE INDEX idx_earnings_user_date ON earnings(user_id, date);
CREATE INDEX idx_earnings_platform ON earnings(platform);
CREATE INDEX idx_users_referral ON users(referral_code);
