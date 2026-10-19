import { useState } from 'react';
import { PlatformChip, RupiahInput, toast } from '../ui';
import { PLATFORMS } from '../../../shared/platforms';
import type { Platform, Settings } from '../../../shared/types';
import { getState, queueOp, setState, useStore } from '../store';
import { dailyCosts, bepGrossPerHour } from '../../../shared/pnl';
import { formatRupiah } from '../../../shared/money';
import { flushOutbox } from '../sync';

export function Wizard({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore();
  const [step, setStep] = useState(0);
  const [s, setS] = useState<Settings>({ ...store.settings });

  const patch = (p: Partial<Settings>) => setS((cur) => ({ ...cur, ...p }));
  const costs = dailyCosts(s);

  function toggleApp(id: Platform) {
    const has = s.apps_used.includes(id);
    const apps = has ? s.apps_used.filter((a) => a !== id) : [...s.apps_used, id];
    if (apps.length === 0) return;
    patch({ apps_used: apps });
  }

  function finish() {
    setState({ settings: s, onboarded: true });
    if (!getState().demo && getState().token) {
      queueOp({ kind: 'settings' });
      void flushOutbox();
    }
    toast('Siap! Selamat narik yang cuan 💪');
    navigate('app');
  }

  const steps = [
    // 0 — aplikasi
    <div key="apps">
      <h1 className="mb8">Aplikasi apa yang kamu pakai?</h1>
      <p className="muted mb12">Boleh pilih lebih dari satu — nanti digabung di satu dashboard.</p>
      <div className="chips">
        {PLATFORMS.map((p) => (
          <PlatformChip key={p.id} id={p.id} on={s.apps_used.includes(p.id)} onClick={() => toggleApp(p.id)} />
        ))}
      </div>
    </div>,

    // 1 — biaya
    <div key="costs">
      <h1 className="mb8">Berapa biaya operasionalmu?</h1>
      <p className="muted mb12">Isi kira-kira saja dulu, bisa diubah kapan pun di Pengaturan.</p>

      <div className="field">
        <label>Hitung bensin per…</label>
        <div className="grid2">
          <button
            className={`btn small ${s.fuel_mode === 'per_km' ? '' : 'ghost'}`}
            style={{ width: '100%' }}
            onClick={() => patch({ fuel_mode: 'per_km' })}
          >
            Per km
          </button>
          <button
            className={`btn small ${s.fuel_mode === 'per_day' ? '' : 'ghost'}`}
            style={{ width: '100%' }}
            onClick={() => patch({ fuel_mode: 'per_day' })}
          >
            Per hari
          </button>
        </div>
      </div>

      {s.fuel_mode === 'per_km' ? (
        <>
          <RupiahInput
            label="Bensin per km"
            value={s.fuel_cost_per_km}
            step={50}
            onChange={(v) => patch({ fuel_cost_per_km: v })}
            hint="Motor irit ±Rp200–300/km"
          />
          <div className="field">
            <label>Jarak tempuh per hari (km)</label>
            <input
              type="number"
              inputMode="numeric"
              value={s.km_per_day || ''}
              onChange={(e) => patch({ km_per_day: Math.max(0, Number(e.target.value)) })}
            />
            <div className="hint">Rata-rata driver full-time 80–150 km</div>
          </div>
        </>
      ) : (
        <RupiahInput
          label="Bensin per hari"
          value={s.fuel_cost_per_day}
          onChange={(v) => patch({ fuel_cost_per_day: v })}
        />
      )}

      <RupiahInput label="Makan per hari" value={s.meal_cost_per_day} onChange={(v) => patch({ meal_cost_per_day: v })} />
      <RupiahInput
        label="Rokok / parkir / lainnya per hari"
        value={s.other_cost_per_day}
        onChange={(v) => patch({ other_cost_per_day: v })}
      />
      <RupiahInput
        label="Cicilan motor per bulan"
        value={s.installment_per_month}
        step={50000}
        onChange={(v) => patch({ installment_per_month: v })}
        hint="Isi 0 kalau motor sudah lunas"
      />
      <RupiahInput
        label="Servis + sparepart per bulan"
        value={s.service_per_month}
        step={10000}
        onChange={(v) => patch({ service_per_month: v })}
      />
      <RupiahInput label="Kuota data per hari" value={s.data_cost_per_day} onChange={(v) => patch({ data_cost_per_day: v })} />
      <div className="field">
        <label>Hari kerja per bulan</label>
        <input
          type="number"
          inputMode="numeric"
          value={s.work_days_per_month || ''}
          onChange={(e) => patch({ work_days_per_month: Math.min(31, Math.max(1, Number(e.target.value))) })}
        />
        <div className="hint">Untuk membagi cicilan &amp; servis. Umumnya 26.</div>
      </div>
    </div>,

    // 2 — target
    <div key="target">
      <h1 className="mb8">Target cuan harian?</h1>
      <p className="muted mb12">Cuan bersih yang mau kamu bawa pulang tiap hari.</p>
      <div className="card center">
        <div className="hero-number pos" style={{ fontSize: 40 }}>
          {formatRupiah(s.target_daily_profit)}
        </div>
        <input
          type="range"
          min={50000}
          max={500000}
          step={10000}
          value={s.target_daily_profit}
          onChange={(e) => patch({ target_daily_profit: Number(e.target.value) })}
          style={{ width: '100%', marginTop: 12, accentColor: 'var(--green)' }}
          aria-label="Target cuan harian"
        />
      </div>
      <div className="field mt12">
        <label>Jam kerja normal per hari</label>
        <input
          type="number"
          inputMode="numeric"
          value={s.hours_per_day || ''}
          onChange={(e) => patch({ hours_per_day: Math.min(24, Math.max(1, Number(e.target.value))) })}
        />
        <div className="hint">Dipakai menghitung titik impas (BEP) per jam.</div>
      </div>
    </div>,

    // 3 — selesai
    <div key="done" className="center">
      <div style={{ fontSize: 56 }}>🏁</div>
      <h1 className="mb8">Siap, bang!</h1>
      <div className="card" style={{ textAlign: 'left' }}>
        <div className="row between mb8">
          <span className="muted">Total biaya harianmu</span>
          <strong>{formatRupiah(Math.round(costs.total))}</strong>
        </div>
        <div className="row between mb8">
          <span className="muted">Titik impas (BEP)</span>
          <strong>{formatRupiah(Math.round(bepGrossPerHour(costs, s.hours_per_day)))}/jam</strong>
        </div>
        <div className="row between">
          <span className="muted">Target cuan</span>
          <strong className="pos-t">{formatRupiah(s.target_daily_profit)}/hari</strong>
        </div>
      </div>
      <p className="muted">
        Artinya: selama pendapatan kotormu di atas{' '}
        <b>{formatRupiah(Math.round(bepGrossPerHour(costs, s.hours_per_day)))} per jam</b>, kamu
        cuan. Di bawah itu? Mending istirahat dulu.
      </p>
    </div>,
  ];

  return (
    <div className="screen no-nav">
      <div className="wizdots">
        {steps.map((_, i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      {steps[step]}
      <div className="grid2 mt16">
        {step > 0 ? (
          <button className="btn ghost" onClick={() => setStep(step - 1)}>
            Kembali
          </button>
        ) : (
          <span />
        )}
        {step < steps.length - 1 ? (
          <button className="btn" onClick={() => setStep(step + 1)}>
            Lanjut
          </button>
        ) : (
          <button className="btn" onClick={finish}>
            Buka Dashboard 🚀
          </button>
        )}
      </div>
    </div>
  );
}
