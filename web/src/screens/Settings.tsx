import { useState } from 'react';
import { AppBar, PlatformChip, RupiahInput, toast } from '../ui';
import { getState, logout, queueOp, setState, useStore } from '../store';
import { PLATFORMS } from '../../../shared/platforms';
import type { Platform, Settings as TSettings } from '../../../shared/types';
import { dailyCosts } from '../../../shared/pnl';
import { formatRupiah } from '../../../shared/money';
import { flushOutbox } from '../sync';
import { IS_DEMO_BUILD } from '../api';

export function SettingsScreen({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore();
  const [s, setS] = useState<TSettings>({ ...store.settings });
  const [name, setName] = useState(store.user?.name ?? '');
  const pro = !!store.user?.is_pro;
  const patch = (p: Partial<TSettings>) => setS((c) => ({ ...c, ...p }));

  function toggleApp(id: Platform) {
    const has = s.apps_used.includes(id);
    const apps = has ? s.apps_used.filter((a) => a !== id) : [...s.apps_used, id];
    if (apps.length === 0) return;
    patch({ apps_used: apps });
  }

  function save() {
    setState({
      settings: s,
      user: store.user ? { ...store.user, name } : store.user,
    });
    if (!getState().demo && getState().token) {
      queueOp({ kind: 'settings' });
      void flushOutbox();
    }
    toast('Pengaturan tersimpan ✔');
    navigate('app');
  }

  function exportCsv() {
    if (!pro) {
      toast('Export CSV khusus Pro');
      navigate('pro');
      return;
    }
    const rows = [
      ['tanggal', 'aplikasi', 'kotor', 'order', 'bonus'],
      ...getState().earnings.map((e) => [
        e.date, e.platform, String(e.gross_amount), String(e.order_count), String(e.incentive_amount),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cuan-driver-data.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('CSV terunduh ✔');
  }

  return (
    <div className="screen">
      <AppBar title="Pengaturan" />

      <div className="card">
        <div className="field">
          <label>Nama panggilan</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="muted" style={{ display: 'block', margin: '4px 0 8px', fontWeight: 600 }}>
          Aplikasi yang dipakai
        </label>
        <div className="chips">
          {PLATFORMS.map((p) => (
            <PlatformChip key={p.id} id={p.id} on={s.apps_used.includes(p.id)} onClick={() => toggleApp(p.id)} />
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb8">Biaya operasional</h2>
        <div className="field">
          <label>Hitung bensin per…</label>
          <div className="grid2">
            <button className={`btn small ${s.fuel_mode === 'per_km' ? '' : 'ghost'}`} style={{ width: '100%' }} onClick={() => patch({ fuel_mode: 'per_km' })}>
              Per km
            </button>
            <button className={`btn small ${s.fuel_mode === 'per_day' ? '' : 'ghost'}`} style={{ width: '100%' }} onClick={() => patch({ fuel_mode: 'per_day' })}>
              Per hari
            </button>
          </div>
        </div>
        {s.fuel_mode === 'per_km' ? (
          <>
            <RupiahInput label="Bensin per km" value={s.fuel_cost_per_km} step={50} onChange={(v) => patch({ fuel_cost_per_km: v })} />
            <div className="field">
              <label>Jarak per hari (km)</label>
              <input type="number" inputMode="numeric" value={s.km_per_day || ''} onChange={(e) => patch({ km_per_day: Math.max(0, Number(e.target.value)) })} />
            </div>
          </>
        ) : (
          <RupiahInput label="Bensin per hari" value={s.fuel_cost_per_day} onChange={(v) => patch({ fuel_cost_per_day: v })} />
        )}
        <RupiahInput label="Makan per hari" value={s.meal_cost_per_day} onChange={(v) => patch({ meal_cost_per_day: v })} />
        <RupiahInput label="Rokok / lainnya per hari" value={s.other_cost_per_day} onChange={(v) => patch({ other_cost_per_day: v })} />
        <RupiahInput label="Cicilan motor per bulan" value={s.installment_per_month} step={50000} onChange={(v) => patch({ installment_per_month: v })} />
        <RupiahInput label="Servis per bulan" value={s.service_per_month} step={10000} onChange={(v) => patch({ service_per_month: v })} />
        <RupiahInput label="Kuota data per hari" value={s.data_cost_per_day} onChange={(v) => patch({ data_cost_per_day: v })} />
        <div className="grid2">
          <div className="field">
            <label>Hari kerja/bulan</label>
            <input type="number" inputMode="numeric" value={s.work_days_per_month || ''} onChange={(e) => patch({ work_days_per_month: Math.min(31, Math.max(1, Number(e.target.value))) })} />
          </div>
          <div className="field">
            <label>Jam kerja/hari</label>
            <input type="number" inputMode="numeric" value={s.hours_per_day || ''} onChange={(e) => patch({ hours_per_day: Math.min(24, Math.max(1, Number(e.target.value))) })} />
          </div>
        </div>
        <RupiahInput label="Target cuan harian" value={s.target_daily_profit} step={10000} onChange={(v) => patch({ target_daily_profit: v })} />
        <div className="banner info">
          Total biaya harian: <b>{formatRupiah(Math.round(dailyCosts(s).total))}</b>
        </div>
        <button className="btn" onClick={save}>
          💾 Simpan Pengaturan
        </button>
      </div>

      <div className="card">
        <h2 className="mb8">Lainnya</h2>
        <button className="btn ghost mb8" onClick={() => navigate('pro')}>
          {pro ? '⭐ Kelola Pro' : '⭐ Upgrade ke Pro'}
        </button>
        <button className="btn ghost mb8" onClick={exportCsv}>
          ⬇️ Export CSV {pro ? '' : '(Pro)'}
        </button>
        <button className="btn ghost mb8" onClick={() => navigate('kalkulator')}>
          🧮 Kalkulator Tarif Baru
        </button>
        <button className="btn ghost mb8" onClick={() => navigate('wizard')}>
          🔁 Ulangi Setup Awal
        </button>
        <button
          className="btn warn"
          onClick={() => {
            if (confirm(store.demo ? 'Keluar dari mode demo? Data demo dihapus.' : 'Keluar akun? Data lokal di HP ini dihapus.')) {
              logout();
              navigate('splash');
            }
          }}
        >
          🚪 {store.demo ? 'Keluar Mode Demo' : 'Keluar Akun'}
        </button>
      </div>

      <p className="tiny center">
        Cuan Driver v0.1 {store.demo || IS_DEMO_BUILD ? '· MODE DEMO' : ''} — data kamu milikmu,
        tidak dijual. 🏍️
      </p>
    </div>
  );
}
