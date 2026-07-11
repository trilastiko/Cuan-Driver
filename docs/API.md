# Cuan Driver — API Reference

Base URL: `https://<your-app>` (all endpoints under `/api`). JSON in/out.
Written for future clients (native app, bots) — the PWA uses exactly this API.

## Conventions

- **Auth:** `Authorization: Bearer <JWT>` (from register/login). Tokens last 30 days.
- **Errors:** non-2xx bodies are `{ "error": "<pesan ramah dalam Bahasa Indonesia>", "code?": "<machine_code>" }`.
- **Dates:** `YYYY-MM-DD`, driver-local (client computes; server does not shift timezones).
- **Money:** whole Rupiah numbers (no decimals, no strings).
- **Rate limits** (fixed-window, per key): register 10/h/IP · login 10/15min ·
  scan 30/h/user · license 10/h/user. Exceeding returns `429`.

## Auth

### POST /api/auth/register
```jsonc
// request
{ "email": "budi@x.id", "password": "min6char", "name": "Budi", "referral_code": "AB2C3D" /* optional */ }
// 201
{ "token": "eyJ...", "user": { "id", "email", "name", "is_pro", "pro_expires_at", "referral_code", "free_scans_used" } }
```
`409` if the email exists. A valid `referral_code` grants **both** users +7 days Pro.

### POST /api/auth/login
```jsonc
{ "email": "...", "password": "..." }        // → 200 { token, user } | 401 generic message
```

## Profile & settings

### GET /api/user/profile 🔒
```jsonc
{ "user": {...}, "settings": {...}, "daily_costs": { "fuel", "meals", "other", "installment", "service", "data", "total" } }
```

### PUT /api/user/profile 🔒
Partial update; unknown/invalid fields fall back to current values (values are clamped).
```jsonc
{ "name?": "Budi",
  "settings?": {
    "apps_used": ["gojek","grab"],            // subset of gojek|grab|maxim|indrive
    "fuel_mode": "per_km" | "per_day",
    "fuel_cost_per_km": 250, "km_per_day": 100, "fuel_cost_per_day": 25000,
    "meal_cost_per_day": 20000, "other_cost_per_day": 10000,
    "installment_per_month": 910000, "service_per_month": 156000,
    "work_days_per_month": 26, "data_cost_per_day": 5000,
    "hours_per_day": 10, "target_daily_profit": 150000
  } }
```

## Earnings

### POST /api/earnings 🔒
Upsert by client-generated UUID → **idempotent offline sync** (re-sending updates
instead of duplicating). The `id` may only touch a row owned by the caller (else `409`).
```jsonc
{ "id?": "uuid", "platform": "gojek", "gross_amount": 150000, "order_count": 12,
  "incentive_amount": 10000, "date": "2026-07-11", "hours_worked?": 9.5,
  "screenshot_key?": "scans/<uid>/<hash>.jpg", "parsed_data?": { } }
// 201 → { "earning": {...} }
```

### GET /api/earnings?from&to&limit 🔒
Defaults: last 90 days, limit 500 (max 1000). → `{ "earnings": [...], "from", "to" }`

### GET /api/earnings/summary?from&to 🔒
Grouped totals; the client combines them with settings to compute net
(math lives in `shared/pnl.ts`).
```jsonc
{ "summary": [ { "date": "2026-07-11", "platform": "gojek", "gross": 150000, "orders": 12, "incentive": 10000, "entries": 1 } ] }
```

### DELETE /api/earnings/:id 🔒
`{ "ok": true }` | `404`.

## AI screenshot scan

### POST /api/scan-screenshot 🔒
```jsonc
// request — image compressed client-side (≤1280px JPEG recommended, ≤~2MB)
{ "image_base64": "<no data: prefix>", "media_type": "image/jpeg", "platform?": "grab" }
// 200
{ "parsed": { "platform", "gross_amount", "order_count", "incentive_amount",
              "date": "YYYY-MM-DD"|null, "confidence": "high|medium|low|demo",
              "mock": bool, "cached?": bool, "notes?": "..." },
  "screenshot_key": "scans/<uid>/<sha256>.jpg" | null,   // present when R2 bound
  "mock_mode": bool,                                      // true when no ANTHROPIC_API_KEY
  "scans_left": 2 | null }                                // null = Pro (unlimited)
```
Behavior:
- **No `ANTHROPIC_API_KEY`** → deterministic mock result (`mock: true`) — full flow demoable free.
- **Cache:** identical images (SHA-256) return the cached result (`cached: true`) and don't consume quota.
- **Quota:** free tier has 3 lifetime scans → then `402 { code: "upgrade_required" }`.
- Errors: `413` image too big · `422` unreadable image · `429` rate limit · `502/503` AI upstream.

## Calculator (public — the viral hook)

### POST /api/calculate-before-after
```jsonc
{ "daily_gross": 250000, "old_rate": 20, "new_rate": 8,      // percent or fraction both accepted
  "daily_cost?": 101000, "work_days?": 26 }
// 200
{ "result": { "fare_base": 312500, "old_gross": 250000, "new_gross": 287500,
              "delta_daily": 37500, "delta_monthly": 975000, "pct_change": 15,
              "old_net": 149000|null, "new_net": 186500|null, "lebih_cuan": true } }
```
Model: `fare_base = gross/(1-old)`, `new_gross = fare_base*(1-new)` — assumes
order volume and base fares unchanged (stated in the UI).

## Licenses (Pro)

### POST /api/verify-license 🔒
```jsonc
{ "code": "CUAN-AB2C-DEF3" }
// 200 → { "ok": true, "tier": "monthly|yearly|demo", "user": {...} }
```
`404` unknown · `409` already used (atomic claim) · `400` bad format.
`CUAN-DEMO-2026` grants 7 days Pro **only when** `DEMO_MODE=true`.
Redeeming while Pro **extends** the expiry (stacks).

## Misc

- `GET /api/health` → `{ ok, mock_ai, demo_mode, time }`
- `GET /api/leaderboard` → `501` (v2 placeholder)

## Admin (Bearer = `ADMIN_TOKEN` secret) 🔐

- `GET /api/admin/stats` → users, active Pro, earnings counts, license inventory
- `GET /api/admin/users?limit=50` → newest users
- `POST /api/admin/licenses` `{ "count": 5, "tier": "monthly"|"yearly" }` → `{ "codes": [...] }`
- `GET /api/admin/licenses?unused=1&limit=100`

Web UI for all of the above: **`/admin`**. If `ADMIN_TOKEN` is unset, admin
endpoints answer `403`.
