import { useEffect, useState, type ReactNode } from 'react';
import { formatRupiah, formatRupiahSigned } from '../../shared/money';
import { shortDayID, todayStr } from '../../shared/dates';
import type { BepGauge } from '../../shared/pnl';
import { platformMeta } from '../../shared/platforms';
import type { Platform } from '../../shared/types';

// ---------- uang ----------

export function Money({ v, signed = false }: { v: number; signed?: boolean }) {
  return <>{signed ? formatRupiahSigned(v) : formatRupiah(v)}</>;
}

// ---------- gauge BEP ----------
// Bentuk: stat tile + bar progres menuju ambang (marker "BEP"), status selalu
// dengan ikon + teks (bukan warna saja). Skala: BEP di 2/3 lebar track,
// sehingga zona "profit" terlihat sebagai ruang setelah marker.

const PACE_LABEL: Record<BepGauge['pace'], { icon: string; text: string }> = {
  above: { icon: '✅', text: 'Gas terus — lajumu di atas BEP!' },
  near: { icon: '🟡', text: 'Mepet BEP — kejar dikit lagi' },
  below: { icon: '⚠️', text: 'Di bawah BEP — tiap jam masih tekor' },
  unknown: { icon: 'ℹ️', text: 'Isi jam kerja untuk lihat laju per jam' },
};

export function BepGaugeView({ g, totalCost }: { g: BepGauge; totalCost: number }) {
  const BEP_AT = 2 / 3; // posisi marker BEP pada track
  const fillFrac = Math.min(1, (Math.min(g.coverage, 1.5) / 1.5));
  const label = PACE_LABEL[g.pace];
  const pctCovered = Math.round(g.coverage * 100);
  // Jam belum diisi: warnai fill berdasarkan progres biaya, bukan abu-abu.
  const fillClass =
    g.pace !== 'unknown' ? g.pace : g.coverage >= 1 ? 'above' : g.coverage > 0 ? 'near' : 'unknown';
  return (
    <div
      role="img"
      aria-label={`Progres menutup biaya harian ${pctCovered}%. ${label.text}`}
    >
      <div className="row between">
        <span className="muted">Menutup biaya harian ({formatRupiah(totalCost)})</span>
        <strong style={{ fontSize: 13 }}>{pctCovered}%</strong>
      </div>
      <div className="gauge-track">
        <div
          className={`gauge-fill ${fillClass}`}
          style={{ width: `${Math.max(2, fillFrac * 100)}%` }}
        />
        <div className="gauge-bep" style={{ left: `${BEP_AT * 100}%` }}>
          <i>BEP</i>
        </div>
      </div>
      <div className="row" style={{ fontSize: 13, fontWeight: 600 }}>
        <span aria-hidden="true">{label.icon}</span>
        <span>{label.text}</span>
      </div>
      {g.pace !== 'unknown' && (
        <div className="tiny mt8">
          Laju kotor: <b>{formatRupiah(Math.round(g.currentGrossPerHour))}/jam</b> · minimal BEP:{' '}
          <b>{formatRupiah(Math.round(g.bepGrossPerHour))}/jam</b>
        </div>
      )}
    </div>
  );
}

// ---------- sparkline 7 hari ----------
// Satu seri (tanpa legend — judul kartu menamai). Polaritas lewat tanda:
// hijau = cuan, oranye = tekor, disertai label saat bar dipilih.
// Tampilan tabel lengkap ada di layar Riwayat.

export interface SparkDay {
  date: string;
  net: number;
  hasData: boolean;
}

export function Sparkline({ days }: { days: SparkDay[] }) {
  const today = todayStr();
  const [sel, setSel] = useState<string>(today);
  const max = Math.max(1, ...days.map((d) => Math.abs(d.net)));
  const selected = days.find((d) => d.date === sel) ?? days[days.length - 1];
  return (
    <div>
      <div className="spark" role="img" aria-label="Grafik cuan bersih 7 hari terakhir">
        {days.map((d) => {
          const h = d.hasData ? Math.max(4, Math.round((Math.abs(d.net) / max) * 52)) : 3;
          const cls = !d.hasData ? 'zero' : d.net < 0 ? 'neg' : '';
          return (
            <div className="col" key={d.date}>
              <div className="barwrap">
                <button
                  type="button"
                  className={`bar ${cls} ${d.date === today ? 'today' : ''}`}
                  style={{ height: h }}
                  onClick={() => setSel(d.date)}
                  aria-label={`${shortDayID(d.date)}: ${d.hasData ? formatRupiahSigned(d.net) : 'belum ada data'}`}
                />
              </div>
              <span className="day">{shortDayID(d.date)}</span>
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="tiny center mt8">
          {shortDayID(selected.date)}, {selected.date.slice(8)}/{selected.date.slice(5, 7)}:{' '}
          {selected.hasData ? (
            <b className={selected.net < 0 ? 'neg-t' : 'pos-t'}>
              {formatRupiahSigned(selected.net)}
            </b>
          ) : (
            <b>belum ada data</b>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- breakdown per platform ----------

export function PlatformBreakdown({
  rows,
}: {
  rows: Array<{ platform: Platform; gross: number }>;
}) {
  const total = rows.reduce((a, r) => a + r.gross, 0);
  if (total <= 0) return <p className="tiny">Belum ada pendapatan hari ini.</p>;
  return (
    <div>
      <div className="pbar" role="img" aria-label="Komposisi pendapatan per aplikasi">
        {rows.map((r) => (
          <i
            key={r.platform}
            style={{ width: `${(r.gross / total) * 100}%`, background: platformMeta(r.platform).color }}
          />
        ))}
      </div>
      <div className="plist">
        {rows.map((r) => {
          const m = platformMeta(r.platform);
          return (
            <div className="row" key={r.platform}>
              <span className="chip-dot dot" style={{ width: 10, height: 10, borderRadius: 5, background: m.color, flex: 'none' }} />
              <span className="name">{m.label}</span>
              <span className="amt">{formatRupiah(r.gross)}</span>
              <span className="tiny" style={{ width: 38, textAlign: 'right' }}>
                {Math.round((r.gross / total) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- chip platform ----------

export function PlatformChip({
  id,
  on,
  onClick,
  disabled,
}: {
  id: Platform;
  on: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const m = platformMeta(id);
  return (
    <button
      type="button"
      className={`chip ${on ? 'on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <span className="dot" style={{ background: m.color }} />
      {m.label}
    </button>
  );
}

// ---------- sheet & toast ----------

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="sheet-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

let toastFn: ((msg: string) => void) | null = null;

export function toast(msg: string) {
  toastFn?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    toastFn = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      toastFn = null;
      clearTimeout(t);
    };
  }, []);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

// ---------- appbar ----------

export function AppBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="appbar">
      {onBack && (
        <button className="back" onClick={onBack} aria-label="Kembali">
          ←
        </button>
      )}
      <h1>{title}</h1>
    </div>
  );
}

// ---------- input rupiah ----------

export function RupiahInput({
  label,
  value,
  onChange,
  hint,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  step?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="input-rp">
        <span>Rp</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={step ?? 1000}
          value={Number.isFinite(value) && value !== 0 ? value : value === 0 ? 0 : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
        />
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
