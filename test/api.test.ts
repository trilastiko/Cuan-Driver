// Integration test API: menjalankan app Hono sungguhan di atas SQLite
// in-memory (skema migrasi asli). AI berjalan dalam mode mock (tanpa key).

import { describe, it, expect, beforeAll } from 'vitest';
import app from '../worker/index';
import { makeTestDb } from './d1shim';
import type { Env } from '../worker/env';

const db = makeTestDb();
const env = {
  DB: db as unknown as Env['DB'],
  JWT_SECRET: 'test-secret-test-secret',
  ADMIN_TOKEN: 'admin-test-token',
  DEMO_MODE: 'true',
} as Env;

// 1x1 px PNG transparan.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; json: Record<string, never> & Record<string, unknown> }> {
  const res = await app.request(
    `http://test.local${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
    env
  );
  return { status: res.status, json: (await res.json()) as never };
}

let token = '';
let userId = '';

describe('auth', () => {
  it('register membuat akun + settings default', async () => {
    const r = await api('POST', '/api/auth/register', {
      email: 'budi@contoh.id',
      password: 'rahasia123',
      name: 'Budi',
    });
    expect(r.status).toBe(201);
    expect(r.json.token).toBeTruthy();
    const user = r.json.user as Record<string, unknown>;
    expect(user.email).toBe('budi@contoh.id');
    expect(user.referral_code).toMatch(/^[A-Z2-9]{6}$/);
    expect(user.is_pro).toBe(false);
    token = r.json.token as string;
    userId = user.id as string;
  });

  it('email ganda ditolak 409', async () => {
    const r = await api('POST', '/api/auth/register', {
      email: 'budi@contoh.id',
      password: 'rahasia123',
    });
    expect(r.status).toBe(409);
  });

  it('login benar mengembalikan token', async () => {
    const r = await api('POST', '/api/auth/login', {
      email: 'budi@contoh.id',
      password: 'rahasia123',
    });
    expect(r.status).toBe(200);
    expect(r.json.token).toBeTruthy();
  });

  it('password salah -> 401 dengan pesan generik', async () => {
    const r = await api('POST', '/api/auth/login', {
      email: 'budi@contoh.id',
      password: 'salah-total',
    });
    expect(r.status).toBe(401);
    expect(r.json.error).toBe('Email atau password salah');
  });

  it('registrasi dengan kode referral memberi bonus Pro dua arah', async () => {
    const me = await api('GET', '/api/user/profile', undefined, token);
    const refCode = (me.json.user as Record<string, unknown>).referral_code as string;

    const r = await api('POST', '/api/auth/register', {
      email: 'siti@contoh.id',
      password: 'rahasia123',
      referral_code: refCode,
    });
    expect(r.status).toBe(201);
    expect((r.json.user as Record<string, unknown>).is_pro).toBe(true);

    const meAfter = await api('GET', '/api/user/profile', undefined, token);
    expect((meAfter.json.user as Record<string, unknown>).is_pro).toBe(true);
  });
});

describe('profile & settings', () => {
  it('profil butuh auth', async () => {
    expect((await api('GET', '/api/user/profile')).status).toBe(401);
  });

  it('update settings tervalidasi & daily_costs terhitung', async () => {
    const r = await api(
      'PUT',
      '/api/user/profile',
      {
        settings: {
          apps_used: ['gojek', 'grab'],
          fuel_cost_per_km: 250,
          km_per_day: 100,
          meal_cost_per_day: 20000,
          other_cost_per_day: 10000,
          installment_per_month: 910000,
          service_per_month: 156000,
          work_days_per_month: 26,
          data_cost_per_day: 5000,
          hours_per_day: 10,
          target_daily_profit: 150000,
        },
      },
      token
    );
    expect(r.status).toBe(200);
    const costs = r.json.daily_costs as Record<string, number>;
    expect(costs.total).toBe(101000);
    expect((r.json.settings as Record<string, unknown>).apps_used).toEqual(['gojek', 'grab']);
  });
});

describe('earnings', () => {
  const eid = crypto.randomUUID();

  it('tambah pendapatan (id dari klien, idempoten)', async () => {
    const body = {
      id: eid,
      platform: 'gojek',
      gross_amount: 150000,
      order_count: 12,
      incentive_amount: 10000,
      date: '2026-07-11',
    };
    const r1 = await api('POST', '/api/earnings', body, token);
    expect(r1.status).toBe(201);
    // Kirim ulang (sync offline) -> update, bukan duplikat.
    const r2 = await api('POST', '/api/earnings', { ...body, gross_amount: 160000 }, token);
    expect(r2.status).toBe(201);

    const list = await api('GET', '/api/earnings?from=2026-07-01&to=2026-07-31', undefined, token);
    const earnings = list.json.earnings as Array<Record<string, unknown>>;
    expect(earnings).toHaveLength(1);
    expect(earnings[0].gross_amount).toBe(160000);
  });

  it('platform tidak valid ditolak', async () => {
    const r = await api(
      'POST',
      '/api/earnings',
      { platform: 'uber', gross_amount: 1, date: '2026-07-11' },
      token
    );
    expect(r.status).toBe(400);
  });

  it('summary menjumlah per tanggal+platform', async () => {
    await api(
      'POST',
      '/api/earnings',
      { platform: 'grab', gross_amount: 90000, order_count: 7, date: '2026-07-11' },
      token
    );
    const r = await api(
      'GET',
      '/api/earnings/summary?from=2026-07-11&to=2026-07-11',
      undefined,
      token
    );
    expect(r.status).toBe(200);
    const rows = r.json.summary as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    const total = rows.reduce((acc, x) => acc + (x.gross as number), 0);
    expect(total).toBe(250000);
  });

  it('pengguna lain tidak bisa menimpa data (upsert dijaga user_id)', async () => {
    const login = await api('POST', '/api/auth/login', {
      email: 'siti@contoh.id',
      password: 'rahasia123',
    });
    const other = login.json.token as string;
    const r = await api(
      'POST',
      '/api/earnings',
      { id: eid, platform: 'maxim', gross_amount: 1, date: '2026-07-11' },
      other
    );
    expect(r.status).toBe(409);
    const list = await api('GET', '/api/earnings?from=2026-07-11&to=2026-07-11', undefined, token);
    const mine = (list.json.earnings as Array<Record<string, unknown>>).find((e) => e.id === eid)!;
    expect(mine.gross_amount).toBe(160000); // tidak berubah
  });

  it('hapus pendapatan', async () => {
    const r = await api('DELETE', `/api/earnings/${eid}`, undefined, token);
    expect(r.status).toBe(200);
    expect((await api('DELETE', `/api/earnings/${eid}`, undefined, token)).status).toBe(404);
  });
});

describe('scan screenshot (mode mock, tanpa API key)', () => {
  it('mengembalikan hasil mock deterministik + memotong jatah gratis', async () => {
    const r = await api(
      'POST',
      '/api/scan-screenshot',
      { image_base64: TINY_PNG, media_type: 'image/png', platform: 'grab' },
      token
    );
    expect(r.status).toBe(200);
    const parsed = r.json.parsed as Record<string, unknown>;
    expect(parsed.mock).toBe(true);
    expect(parsed.platform).toBe('grab');
    expect(parsed.gross_amount).toBeGreaterThan(0);
    expect(r.json.mock_mode).toBe(true);
  });

  it('screenshot sama -> hasil cache, jatah tidak berkurang lagi', async () => {
    const before = await api('GET', '/api/user/profile', undefined, token);
    const usedBefore = (before.json.user as Record<string, unknown>).free_scans_used as number;
    const r = await api(
      'POST',
      '/api/scan-screenshot',
      { image_base64: TINY_PNG, media_type: 'image/png', platform: 'grab' },
      token
    );
    expect((r.json.parsed as Record<string, unknown>).cached).toBe(true);
    const after = await api('GET', '/api/user/profile', undefined, token);
    expect((after.json.user as Record<string, unknown>).free_scans_used).toBe(usedBefore);
  });

  it('format selain gambar ditolak', async () => {
    const r = await api(
      'POST',
      '/api/scan-screenshot',
      { image_base64: TINY_PNG, media_type: 'application/pdf' },
      token
    );
    expect(r.status).toBe(400);
  });
});

describe('lisensi & admin', () => {
  let plainUserToken = '';

  beforeAll(async () => {
    const r = await api('POST', '/api/auth/register', {
      email: 'joko@contoh.id',
      password: 'rahasia123',
    });
    plainUserToken = r.json.token as string;
  });

  it('admin butuh token', async () => {
    expect((await api('GET', '/api/admin/stats')).status).toBe(401);
    const wrong = await app.request(
      'http://test.local/api/admin/stats',
      { headers: { Authorization: 'Bearer salah' } },
      env
    );
    expect(wrong.status).toBe(401);
  });

  it('admin bisa membuat kode lisensi, user bisa menukarkannya', async () => {
    const gen = await api('POST', '/api/admin/licenses', { count: 2, tier: 'monthly' }, 'admin-test-token');
    expect(gen.status).toBe(201);
    const codes = gen.json.codes as string[];
    expect(codes).toHaveLength(2);

    const redeem = await api('POST', '/api/verify-license', { code: codes[0] }, plainUserToken);
    expect(redeem.status).toBe(200);
    expect((redeem.json.user as Record<string, unknown>).is_pro).toBe(true);

    // Kode yang sama tidak bisa dipakai lagi.
    const again = await api('POST', '/api/verify-license', { code: codes[0] }, token);
    expect(again.status).toBe(409);
  });

  it('kode demo diterima saat DEMO_MODE=true', async () => {
    const r = await api('POST', '/api/verify-license', { code: 'cuan-demo-2026' }, token);
    expect(r.status).toBe(200);
    expect(r.json.tier).toBe('demo');
  });

  it('kode ngawur -> 400/404', async () => {
    expect((await api('POST', '/api/verify-license', { code: 'HALO' }, token)).status).toBe(400);
    expect(
      (await api('POST', '/api/verify-license', { code: 'CUAN-XXXX-YYYY' }, token)).status
    ).toBe(404);
  });

  it('stats admin mencerminkan data', async () => {
    const r = await api('GET', '/api/admin/stats', undefined, 'admin-test-token');
    expect(r.status).toBe(200);
    expect(r.json.users).toBeGreaterThanOrEqual(3);
    const lic = r.json.licenses as Record<string, number>;
    expect(lic.used).toBe(1);
  });
});

describe('kalkulator publik & misc', () => {
  it('before/after tanpa login', async () => {
    const r = await api('POST', '/api/calculate-before-after', {
      daily_gross: 250000,
      old_rate: 20,
      new_rate: 8,
    });
    expect(r.status).toBe(200);
    const result = r.json.result as Record<string, unknown>;
    expect(result.new_gross).toBe(287500);
    expect(result.lebih_cuan).toBe(true);
  });

  it('input tidak valid -> 400 ramah', async () => {
    const r = await api('POST', '/api/calculate-before-after', { daily_gross: -5 });
    expect(r.status).toBe(400);
  });

  it('health menandai mode mock AI', async () => {
    const r = await api('GET', '/api/health');
    expect(r.json.ok).toBe(true);
    expect(r.json.mock_ai).toBe(true);
  });

  it('endpoint asing -> 404 JSON', async () => {
    const r = await api('GET', '/api/tidak-ada');
    expect(r.status).toBe(404);
  });
});
