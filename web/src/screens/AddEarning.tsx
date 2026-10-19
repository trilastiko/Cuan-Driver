import { useRef, useState } from 'react';
import { AppBar, PlatformChip, RupiahInput, toast } from '../ui';
import { PLATFORMS } from '../../../shared/platforms';
import type { Earning, ParsedScan, Platform } from '../../../shared/types';
import { queueOp, upsertEarningLocal, useStore } from '../store';
import { api, ApiError } from '../api';
import { flushOutbox } from '../sync';
import { todayStr } from '../../../shared/dates';

type Mode = 'pick' | 'scanning' | 'confirm' | 'manual';

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Kompres gambar di HP: sisi terpanjang 1280px, JPEG q0.8 — hemat kuota & biaya AI. */
async function compressImage(file: File): Promise<{ base64: string; mediaType: string }> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('Gagal membaca file'));
    r.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('File bukan gambar'));
    img.src = dataUrl;
  });
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL('image/jpeg', 0.8);
  return { base64: out.split(',')[1], mediaType: 'image/jpeg' };
}

export function AddEarning({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore();
  const pro = !!store.user?.is_pro;
  const apps = store.settings.apps_used;
  const [platform, setPlatform] = useState<Platform>(apps[0] ?? 'gojek');
  const [mode, setMode] = useState<Mode>('pick');
  const [scanInfo, setScanInfo] = useState<{ parsed: ParsedScan; scans_left: number | null; screenshot_key: string | null } | null>(null);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // form (dipakai confirm & manual)
  const [gross, setGross] = useState(0);
  const [orders, setOrders] = useState(0);
  const [incentive, setIncentive] = useState(0);
  const [date, setDate] = useState(todayStr());

  const scansLeft = pro ? null : Math.max(0, 3 - (store.user?.free_scans_used ?? 0));

  function pickPlatform(id: Platform) {
    // Free tier: satu aplikasi saja (aplikasi pertama). Multi-app = Pro.
    if (!pro && id !== apps[0]) {
      toast('Multi-app khusus Pro — upgrade dulu ya 🙏');
      return;
    }
    setPlatform(id);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr('');
    setMode('scanning');
    try {
      const { base64, mediaType } = await compressImage(file);
      const r = await api().scan(base64, mediaType, platform);
      setScanInfo({ parsed: r.parsed, scans_left: r.scans_left, screenshot_key: r.screenshot_key });
      setGross(r.parsed.gross_amount);
      setOrders(r.parsed.order_count);
      setIncentive(r.parsed.incentive_amount);
      if (r.parsed.date) setDate(r.parsed.date);
      setPlatform(r.parsed.platform);
      setMode('confirm');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Gagal memproses gambar';
      if (e instanceof ApiError && e.code === 'upgrade_required') {
        toast(msg);
        navigate('pro');
        return;
      }
      setErr(msg);
      setMode('pick');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function save() {
    if (gross <= 0) {
      setErr('Isi pendapatan kotor dulu ya');
      return;
    }
    const e: Earning = {
      id: newId(),
      platform,
      gross_amount: gross,
      order_count: Math.max(0, Math.round(orders)),
      incentive_amount: Math.max(0, incentive),
      date,
      screenshot_key: scanInfo?.screenshot_key ?? null,
      parsed_data: scanInfo?.parsed,
      created_at: new Date().toISOString(),
      synced: false,
    };
    upsertEarningLocal(e);
    queueOp({ kind: 'earning', id: e.id });
    void flushOutbox();
    toast('Tersimpan ✔ Mantap!');
    navigate('app');
  }

  const form = (
    <>
      <RupiahInput label="Pendapatan kotor (termasuk bonus)" value={gross} onChange={setGross} step={500} />
      <div className="grid2">
        <div className="field">
          <label>Jumlah order</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={orders || ''}
            placeholder="0"
            onChange={(e) => setOrders(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div className="field">
          <label>Tanggal</label>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <RupiahInput
        label="Bonus/insentif (bagian dari kotor)"
        value={incentive}
        onChange={setIncentive}
        step={500}
        hint="Sekadar catatan — sudah termasuk di angka kotor."
      />
      {err && <div className="banner warn">⚠️ {err}</div>}
      <button className="btn" onClick={save}>
        💾 Simpan
      </button>
    </>
  );

  return (
    <div className="screen no-nav">
      <AppBar title="Tambah Pendapatan" onBack={() => (mode === 'confirm' || mode === 'manual' ? setMode('pick') : navigate('app'))} />

      {/* pilih platform */}
      <div className="card">
        <label className="muted" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
          Dari aplikasi mana?
        </label>
        <div className="chips">
          {PLATFORMS.filter((p) => apps.includes(p.id)).map((p) => (
            <PlatformChip
              key={p.id}
              id={p.id}
              on={platform === p.id}
              onClick={() => pickPlatform(p.id)}
              disabled={!pro && p.id !== apps[0]}
            />
          ))}
        </div>
        {!pro && apps.length > 1 && (
          <div className="tiny mt8">🔒 Multi-app khusus Pro. Gratis: 1 aplikasi.</div>
        )}
      </div>

      {mode === 'pick' && (
        <>
          {err && <div className="banner warn">⚠️ {err}</div>}
          <div className="card">
            <button
              className="btn"
              onClick={() => {
                if (!pro && (scansLeft ?? 0) <= 0) {
                  toast('Jatah scan gratis habis — upgrade ke Pro ya');
                  navigate('pro');
                  return;
                }
                fileRef.current?.click();
              }}
            >
              📷 Scan Screenshot (AI)
            </button>
            <div className="tiny center mt8">
              Screenshot layar pendapatan → AI isi otomatis.{' '}
              {pro ? 'Tanpa batas (Pro)' : `Sisa gratis: ${scansLeft}×`}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
          <div className="card">
            <button className="btn secondary" onClick={() => setMode('manual')}>
              ⌨️ Isi Manual
            </button>
          </div>
        </>
      )}

      {mode === 'scanning' && (
        <div className="card center" aria-live="polite">
          <div style={{ fontSize: 42 }}>🤖</div>
          <h2>AI lagi baca screenshot…</h2>
          <p className="muted">Sebentar ya, angkanya lagi diambil.</p>
        </div>
      )}

      {mode === 'confirm' && scanInfo && (
        <div className="card">
          <div className="banner ok">
            ✅ Terbaca! Cek dulu angkanya, koreksi kalau meleset.
            {scanInfo.parsed.confidence === 'low' && ' (AI kurang yakin — mohon dicek)'}
          </div>
          {scanInfo.parsed.mock && (
            <div className="banner info">
              ℹ️ Hasil contoh — mode demo tanpa API key. Angka dibuat dari isi gambar.
            </div>
          )}
          {form}
        </div>
      )}

      {mode === 'manual' && <div className="card">{form}</div>}
    </div>
  );
}
