import { useMemo, useRef, useState } from 'react';
import { AppBar, Money, RupiahInput, toast } from '../ui';
import { calcBeforeAfter, validateBeforeAfter } from '../../../shared/calculator';
import { dailyCosts } from '../../../shared/pnl';
import { formatRupiah } from '../../../shared/money';
import { useStore } from '../store';
import { appUrl, drawCalcCard, shareCanvas } from '../sharecard';

export function Calculator({ navigate, session }: { navigate: (r: string) => void; session: boolean }) {
  const store = useStore();
  const [gross, setGross] = useState(250000);
  const [oldPct, setOldPct] = useState(20);
  const [newPct, setNewPct] = useState(8);
  const [useCosts, setUseCosts] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showCard, setShowCard] = useState(false);

  const input = useMemo(
    () => ({
      daily_gross: gross,
      old_rate: oldPct / 100,
      new_rate: newPct / 100,
      daily_cost: useCosts && session ? Math.round(dailyCosts(store.settings).total) : undefined,
      work_days: store.settings.work_days_per_month || 26,
    }),
    [gross, oldPct, newPct, useCosts, session, store.settings]
  );

  const err = validateBeforeAfter(input);
  const result = err ? null : calcBeforeAfter(input);

  function makeCard() {
    if (!result) return;
    const c = drawCalcCard({
      oldPct,
      newPct,
      oldGross: result.old_gross,
      newGross: result.new_gross,
      deltaDaily: result.delta_daily,
      deltaMonthly: result.delta_monthly,
      appUrl: appUrl(),
    });
    canvasRef.current = c;
    setShowCard(true);
    requestAnimationFrame(() => {
      if (imgRef.current) imgRef.current.src = c.toDataURL('image/png');
    });
  }

  async function share() {
    if (!canvasRef.current || !result) return;
    const teks = result.lebih_cuan
      ? `Setelah komisi ${oldPct}%→${newPct}%, aku harusnya lebih cuan ${formatRupiah(result.delta_daily)}/hari. Benarkah kamu juga? Cek: ${appUrl()}`
      : `Hitung-hitungan tarif baru malah tekor ${formatRupiah(Math.abs(result.delta_daily))}/hari 😤 Cek punyamu: ${appUrl()}`;
    const r = await shareCanvas(canvasRef.current, 'cek-tekor-atau-cuan.png', teks);
    if (r === 'downloaded') toast('Gambar tersimpan — gas share ke grup!');
  }

  return (
    <div className="screen no-nav">
      <AppBar title="Cek: Tekor atau Cuan?" onBack={() => navigate(session ? 'app' : 'splash')} />
      <p className="muted mb12">
        Komisi aplikator dipangkas jadi 8% (Perpres 27/2026, berlaku 1 Juli). Harusnya kamu lebih
        cuan — <b>benarkah?</b>
      </p>

      <div className="card">
        <RupiahInput
          label="Pendapatan kotor harianmu (saat komisi lama)"
          value={gross}
          step={5000}
          onChange={setGross}
        />
        <div className="grid2">
          <div className="field">
            <label>Komisi lama (%)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={89}
              value={oldPct}
              onChange={(e) => setOldPct(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Komisi baru (%)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={89}
              value={newPct}
              onChange={(e) => setNewPct(Number(e.target.value))}
            />
          </div>
        </div>
        {session && (
          <label className="row" style={{ fontSize: 14, gap: 8 }}>
            <input
              type="checkbox"
              checked={useCosts}
              onChange={(e) => setUseCosts(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
            />
            Hitung bersih pakai biaya harianku ({formatRupiah(Math.round(dailyCosts(store.settings).total))})
          </label>
        )}
      </div>

      {err && <div className="banner warn">⚠️ {err}</div>}

      {result && (
        <div className="card">
          <div className="vs">
            <div className="side">
              <div className="cap">Sebelum ({oldPct}%)</div>
              <div className="num">{formatRupiah(useCosts && result.old_net !== null ? result.old_net : result.old_gross)}</div>
            </div>
            <div className="mid">VS</div>
            <div className="side" style={{ background: 'var(--green-soft)' }}>
              <div className="cap">Sesudah ({newPct}%)</div>
              <div className="num pos-t">
                {formatRupiah(useCosts && result.new_net !== null ? result.new_net : result.new_gross)}
              </div>
            </div>
          </div>

          <div className={`delta-box ${result.lebih_cuan ? 'pos' : 'neg'}`}>
            <div style={{ fontWeight: 800 }}>
              {result.lebih_cuan ? '🎉 Kamu LEBIH CUAN' : '😤 Kamu MALAH TEKOR'}
            </div>
            <div className="big">
              <Money v={result.delta_daily} signed />/hari
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              ≈ <Money v={result.delta_monthly} signed />/bulan ({result.pct_change > 0 ? '+' : ''}
              {result.pct_change}%)
            </div>
          </div>
          <p className="tiny center mb8">Asumsi: jumlah order &amp; tarif dasar tetap sama.</p>

          <button className="btn" onClick={makeCard}>
            🖼️ Buat Kartu Share
          </button>

          {showCard && (
            <>
              <img ref={imgRef} className="share-preview mt12" alt="Kartu hasil kalkulator siap dibagikan" />
              <div className="grid2 mt12">
                <button className="btn" onClick={share}>
                  📤 Bagikan ke grup
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    if (!canvasRef.current) return;
                    const a = document.createElement('a');
                    a.href = canvasRef.current.toDataURL('image/png');
                    a.download = 'cek-tekor-atau-cuan.png';
                    a.click();
                  }}
                >
                  ⬇️ Unduh
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!session && (
        <div className="card center">
          <b>Mau tahu cuan bersihmu tiap hari — bukan cuma pas ganti tarif?</b>
          <p className="tiny mt8 mb8">Catat otomatis dari screenshot, gabung semua aplikasi, gratis.</p>
          <button className="btn" onClick={() => navigate('splash')}>
            Mulai pakai Cuan Driver
          </button>
        </div>
      )}
    </div>
  );
}
