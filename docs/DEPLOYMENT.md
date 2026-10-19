# Deploying Cuan Driver to Cloudflare

One Worker serves everything: static PWA via Workers Assets + `/api/*` via Hono.
Works on the **free plan** (see cost notes at the bottom).

## Prerequisites

- Cloudflare account + `npx wrangler login`
- Node 20+ (repo developed on Node 22)

## 1. Create the database

```bash
npx wrangler d1 create cuan-driver-db
```

Copy the printed `database_id` into `wrangler.toml` (replace the zero-UUID),
then apply the schema to production:

```bash
npx wrangler d1 migrations apply cuan-driver-db --remote
```

## 2. Create the screenshot bucket (optional but recommended)

```bash
npx wrangler r2 bucket create cuan-driver-screenshots
```

If you skip R2, remove the `[[r2_buckets]]` block from `wrangler.toml` —
scans still work, screenshots just aren't archived.

## 3. Secrets

```bash
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET     # REQUIRED in prod
openssl rand -hex 16   | npx wrangler secret put ADMIN_TOKEN     # enables /admin
npx wrangler secret put ANTHROPIC_API_KEY                        # optional — real AI scan
```

Notes:
- **Without `JWT_SECRET`** the Worker generates an ephemeral per-boot secret and
  logs a warning — sessions die on every deploy/restart. Fine for kicking the
  tires, not for real users.
- **Without `ANTHROPIC_API_KEY`** scans run in labeled mock mode (still demoable).
- **Never** put secrets in `wrangler.toml` or commit `.dev.vars`.

## 4. Vars (in `wrangler.toml`)

| Var | Meaning | Production value |
| --- | --- | --- |
| `ANTHROPIC_MODEL` | vision model for scans | `claude-haiku-4-5` (default; cost-optimized) |
| `ANTHROPIC_BASE_URL` | API endpoint override | unset (only for proxies) |
| `APP_URL` | public URL used in share cards/QR | your real URL |
| `DEMO_MODE` | accept `CUAN-DEMO-2026` demo license | **`"false"`** |

## 5. Deploy

```bash
npm install
npm run deploy        # = vite build + wrangler deploy
```

Wrangler prints the URL (`https://cuan-driver.<account>.workers.dev`).
Custom domain: Workers → Settings → Domains & Routes (update `APP_URL` after).

## 6. Smoke-check production

```bash
curl https://<app>/api/health
# {"ok":true,"mock_ai":false,...}   ← mock_ai true means the key isn't set
```

Open the URL on an Android phone → Chrome menu → **Add to Home Screen** — the
PWA installs with the Cuan Driver icon and works offline.

## 7. Selling Pro (license runbook)

1. Open `https://<app>/admin`, paste `ADMIN_TOKEN`.
2. Generate codes (monthly = 30 days, yearly = 365).
3. Buyer pays via QRIS/transfer and sends proof on WhatsApp
   (the number is `ADMIN_WA` in `web/src/screens/Pro.tsx` — change it!).
4. Reply with one unused code; buyer enters it in **Akun → Upgrade**.
   Codes are single-use (atomic claim) and stack on active subscriptions.

## Updating

`npm run deploy` again — instant, no app-store review. The service worker
picks up new builds on next launch (new deploys change asset hashes).

Schema changes: add a new `migrations/000X_*.sql`, then
`npx wrangler d1 migrations apply cuan-driver-db --remote`.

## Cost notes

- **Workers/D1/R2 free tiers** comfortably cover an MVP (100k req/day,
  5M D1 reads/day, 10GB R2).
- **AI scans:** `claude-haiku-4-5` ≈ $0.002–0.005 per scan (~Rp40–70) for a
  compressed 1280px screenshot. Cost controls already built in: client-side
  compression, SHA-256 dedupe cache, free tier capped at 3 scans, Pro-gated
  volume, rate limit 30/h/user. A Pro user at Rp15.000/month breaks even at
  ~200–300 scans/month — far above real usage (~30–60).
- **PBKDF2 100k iterations** runs in a few ms of CPU on Workers — within free
  plan limits.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `mock_ai: true` in production | `ANTHROPIC_API_KEY` secret missing/typo |
| All logins invalid after deploy | `JWT_SECRET` not set (ephemeral secret rotated) |
| `/admin` → 403 | `ADMIN_TOKEN` secret not set |
| Scan → 502/503 | Anthropic upstream issue or wrong `ANTHROPIC_BASE_URL` |
| D1 error `no such table` | migrations not applied `--remote` |
