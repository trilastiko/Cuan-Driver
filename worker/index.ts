// Cuan Driver API — Cloudflare Worker (Hono).
// Aset statis PWA dilayani Workers Assets; hanya /api/* yang masuk ke sini
// (lihat run_worker_first di wrangler.toml).

import { Hono } from 'hono';
import type { AppEnv } from './env';
import { ValidationError } from '../shared/validate';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import earningsRoutes from './routes/earnings';
import scanRoutes from './routes/scan';
import licenseRoutes from './routes/license';
import adminRoutes from './routes/admin';
import miscRoutes from './routes/misc';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Cache-Control', 'no-store');
});

app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/earnings', earningsRoutes);
app.route('/api/scan-screenshot', scanRoutes);
app.route('/api/verify-license', licenseRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api', miscRoutes);

app.notFound((c) => c.json({ error: 'Endpoint tidak ditemukan' }, 404));

app.onError((err, c) => {
  if (err instanceof ValidationError) {
    return c.json({ error: err.message }, 400);
  }
  console.error('[api] unhandled error:', err);
  return c.json({ error: 'Terjadi kesalahan server, coba lagi' }, 500);
});

export default app;
