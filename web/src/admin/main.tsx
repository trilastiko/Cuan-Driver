// Dashboard admin sederhana: statistik, user terbaru, generator kode lisensi.
// Akses: /admin.html — butuh ADMIN_TOKEN (disimpan di sessionStorage saja).

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';

interface Stats {
  users: number;
  pro_users: number;
  earnings_entries: number;
  earnings_today: number;
  licenses: { total: number; used: number; available: number };
}

async function adminCall<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

function AdminApp() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('cuan-admin') ?? '');
  const [input, setInput] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [licenses, setLicenses] = useState<Array<Record<string, unknown>>>([]);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [tier, setTier] = useState<'monthly' | 'yearly'>('monthly');
  const [err, setErr] = useState('');

  async function refresh(tok: string) {
    setErr('');
    try {
      const [s, u, l] = await Promise.all([
        adminCall<Stats>(tok, '/stats'),
        adminCall<{ users: Array<Record<string, unknown>> }>(tok, '/users?limit=50'),
        adminCall<{ licenses: Array<Record<string, unknown>> }>(tok, '/licenses?limit=50'),
      ]);
      setStats(s);
      setUsers(u.users);
      setLicenses(l.licenses);
      sessionStorage.setItem('cuan-admin', tok);
      setToken(tok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal');
      setToken('');
      sessionStorage.removeItem('cuan-admin');
    }
  }

  useEffect(() => {
    if (token) void refresh(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    try {
      const r = await adminCall<{ codes: string[] }>(token, '/licenses', {
        method: 'POST',
        body: JSON.stringify({ count: 5, tier }),
      });
      setNewCodes(r.codes);
      void refresh(token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal');
    }
  }

  if (!token) {
    return (
      <div className="shell">
        <div className="screen no-nav">
          <h1 className="mb12">🔐 Cuan Driver Admin</h1>
          <div className="card">
            <div className="field">
              <label>Admin token</label>
              <input type="password" value={input} onChange={(e) => setInput(e.target.value)} />
              <div className="hint">Nilai secret ADMIN_TOKEN pada Worker.</div>
            </div>
            {err && <div className="banner warn">⚠️ {err}</div>}
            <button className="btn" onClick={() => refresh(input)} disabled={!input}>
              Masuk
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="screen no-nav">
        <div className="row between mb12">
          <h1>📊 Admin</h1>
          <button
            className="btn small ghost"
            onClick={() => {
              sessionStorage.removeItem('cuan-admin');
              setToken('');
            }}
          >
            Keluar
          </button>
        </div>
        {err && <div className="banner warn">⚠️ {err}</div>}

        {stats && (
          <div className="grid2 mb12">
            <div className="stat"><div className="v">{stats.users}</div><div className="l">Total user</div></div>
            <div className="stat"><div className="v">{stats.pro_users}</div><div className="l">User Pro aktif</div></div>
            <div className="stat"><div className="v">{stats.earnings_entries}</div><div className="l">Catatan pendapatan</div></div>
            <div className="stat"><div className="v">{stats.earnings_today}</div><div className="l">Catatan hari ini</div></div>
            <div className="stat"><div className="v">{stats.licenses.available}</div><div className="l">Kode tersedia</div></div>
            <div className="stat"><div className="v">{stats.licenses.used}</div><div className="l">Kode terpakai</div></div>
          </div>
        )}

        <div className="card">
          <h2 className="mb8">Buat kode lisensi</h2>
          <div className="row mb8">
            <select value={tier} onChange={(e) => setTier(e.target.value as 'monthly')} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1.5px solid var(--line)', padding: '0 10px' }}>
              <option value="monthly">Bulanan (30 hari)</option>
              <option value="yearly">Tahunan (365 hari)</option>
            </select>
            <button className="btn small" onClick={generate}>+5 kode</button>
          </div>
          {newCodes.length > 0 && (
            <div className="banner ok" style={{ display: 'block' }}>
              Kode baru (salin &amp; kirim ke pembeli):
              {newCodes.map((c) => (
                <div key={c}><code>{c}</code></div>
              ))}
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-2)' }}>
                  <th style={{ padding: 6 }}>Kode</th><th>Tier</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={String(l.code)} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: 6 }}><code>{String(l.code)}</code></td>
                    <td>{String(l.tier)}</td>
                    <td>{l.used_by ? `terpakai ${String(l.used_at ?? '')}` : 'tersedia'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="mb8">User terbaru</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-2)' }}>
                  <th style={{ padding: 6 }}>Email</th><th>Nama</th><th>Pro s.d.</th><th>Daftar</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={String(u.id)} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: 6 }}>{String(u.email)}</td>
                    <td>{String(u.name || '—')}</td>
                    <td>{u.pro_expires_at ? String(u.pro_expires_at).slice(0, 10) : '—'}</td>
                    <td>{String(u.created_at ?? '').slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<AdminApp />);
