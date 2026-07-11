import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { calcBeforeAfter, validateBeforeAfter, type BeforeAfterInput } from '../../shared/calculator';
import { asNumber } from '../../shared/validate';
import { isAiConfigured } from '../ai';

const app = new Hono<AppEnv>();

// Kalkulator viral "tekor atau cuan setelah tarif baru" — publik, tanpa login.
app.post('/calculate-before-after', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const input: BeforeAfterInput = {
    daily_gross: asNumber(body.daily_gross, { def: NaN }),
    // Terima 20 (persen) maupun 0.2 (pecahan).
    old_rate: normalizeRate(body.old_rate, 0.2),
    new_rate: normalizeRate(body.new_rate, 0.08),
    daily_cost:
      body.daily_cost === undefined || body.daily_cost === null
        ? undefined
        : asNumber(body.daily_cost, { min: 0, max: 50_000_000, def: 0 }),
    work_days: asNumber(body.work_days, { min: 1, max: 31, def: 26 }),
  };
  const err = validateBeforeAfter(input);
  if (err) return c.json({ error: err }, 400);
  return c.json({ result: calcBeforeAfter(input) });
});

function normalizeRate(v: unknown, def: number): number {
  const n = asNumber(v, { def });
  return n > 1 ? n / 100 : n;
}

app.get('/health', (c) =>
  c.json({
    ok: true,
    mock_ai: !isAiConfigured(c.env),
    demo_mode: c.env.DEMO_MODE === 'true',
    time: new Date().toISOString(),
  })
);

// v2 — papan peringkat komunitas per kota.
app.get('/leaderboard', (c) => c.json({ error: 'Segera hadir (v2)' }, 501));

export default app;
