import { useEffect, useMemo, useRef, useState } from 'react';
import { AppBar, Money, toast } from '../ui';
import { useStore } from '../store';
import { dailyCosts, netProfit } from '../../../shared/pnl';
import { lastNDates, shortDayID, todayStr } from '../../../shared/dates';
import { formatRupiah } from '../../../shared/money';
import { appUrl, drawRecapCard, shareCanvas, type RecapCardData } from '../sharecard';

export function Recap({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore();
  const pro = !!store.user?.is_pro;
  const today = todayStr();
  const imgRef = useRef<HTMLImageElement>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const stats = useMemo(() => {
    const costs = dailyCosts(store.settings);
    const dates = lastNDates(7, today);
    const days = dates.map((date) => {
      const entries = store.earnings.filter((e) => e.date === date);
      const gross = entries.reduce((a, e) => a + e.gross_amount, 0);
      const orders = entries.reduce((a, e) => a + e.order_count, 0);
      return { date, gross, orders, hasData: entries.length > 0, net: entries.length ? netProfit(gross, costs) : 0 };
    });
    const active = days.filter((d) => d.hasData);
    const totalGross = active.reduce((a, d) => a + d.gross, 0);
    const totalNet = active.reduce((a, d) => a + d.net, 0);
    const totalOrders = active.reduce((a, d) => a + d.orders, 0);
    const totalHours = active.reduce(
      (a, d) => a + (store.hoursByDate[d.date] ?? store.settings.hours_per_day),
      0
    );
    const best = [...active].sort((a, b) => b.net - a.net)[0] ?? null;
    const worst = [...active].sort((a, b) => a.net - b.net)[0] ?? null;
    return {
      days,
      active: active.length,
      totalGross,
      totalNet,
      totalOrders,
      perHour: totalHours > 0 ? totalNet / totalHours : 0,
      best,
      worst,
      rangeLabel: `${dates[0].slice(8)}/${dates[0].slice(5, 7)} – ${dates[6].slice(8)}/${dates[6].slice(5, 7)}`,
    };
  }, [store.earnings, store.settings, store.hoursByDate, today]);

  useEffect(() => {
    if (!pro || stats.active === 0) return;
    const data: RecapCardData = {
      rangeLabel: `Minggu ${stats.rangeLabel} · ${stats.active} hari narik`,
      totalNet: Math.round(stats.totalNet),
      totalGross: stats.totalGross,
      totalOrders: stats.totalOrders,
      perHour: stats.perHour,
      bestDay: stats.best ? { label: shortDayID(stats.best.date), net: Math.round(stats.best.net) } : null,
      worstDay: stats.worst ? { label: shortDayID(stats.worst.date), net: Math.round(stats.worst.net) } : null,
      appUrl: appUrl(),
    };
    const c = drawRecapCard(data);
    setCanvas(c);
    if (imgRef.current) imgRef.current.src = c.toDataURL('image/png');
  }, [pro, stats]);

  async function share() {
    if (!canvas) return;
    const r = await shareCanvas(
      canvas,
      'rekap-cuan-driver.png',
      `Rekap minggu ini: bersih ${formatRupiah(Math.round(stats.totalNet))} 💪 Cek punyamu di ${appUrl()}`
    );
    if (r === 'downloaded') toast('Gambar tersimpan — tinggal kirim ke grup 👍');
  }

  return (
    <div className="screen">
      <AppBar title="Rekap Minggu Ini" />

      <div className="card">
        <div className="row between mb8">
          <span className="muted">{stats.rangeLabel} · {stats.active} hari narik</span>
        </div>
        <div className="grid2">
          <div className="stat">
            <div className={`v ${stats.totalNet >= 0 ? 'pos-t' : 'neg-t'}`}>
              <Money v={Math.round(stats.totalNet)} />
            </div>
            <div className="l">Total bersih</div>
          </div>
          <div className="stat">
            <div className="v">{formatRupiah(stats.totalGross)}</div>
            <div className="l">Total kotor</div>
          </div>
          <div className="stat">
            <div className="v">{stats.totalOrders}</div>
            <div className="l">Total order</div>
          </div>
          <div className="stat">
            <div className="v">{formatRupiah(Math.round(stats.perHour))}</div>
            <div className="l">Bersih per jam</div>
          </div>
        </div>
        {stats.best && (
          <div className="tiny mt8">
            🏆 Terbaik: {shortDayID(stats.best.date)} (<Money v={Math.round(stats.best.net)} signed />)
            {stats.worst && stats.worst.date !== stats.best.date && (
              <>
                {' '}· 😮‍💨 Terberat: {shortDayID(stats.worst.date)} (
                <Money v={Math.round(stats.worst.net)} signed />)
              </>
            )}
          </div>
        )}
      </div>

      {stats.active === 0 ? (
        <div className="card center">
          <p className="muted">Belum ada data minggu ini. Yuk mulai catat!</p>
          <button className="btn mt12" onClick={() => navigate('tambah')}>
            ＋ Tambah Pendapatan
          </button>
        </div>
      ) : pro ? (
        <div className="card">
          <h2 className="mb8">Kartu share</h2>
          <img
            ref={imgRef}
            className="share-preview"
            alt="Kartu rekap mingguan siap dibagikan"
          />
          <div className="grid2 mt12">
            <button className="btn" onClick={share}>
              📤 Bagikan ke grup
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                if (!canvas) return;
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = 'rekap-cuan-driver.png';
                a.click();
              }}
            >
              ⬇️ Unduh
            </button>
          </div>
          <p className="tiny mt8">
            Kartu berisi logo + QR ke aplikasi — biar teman segrup ikut melek cuan.
          </p>
        </div>
      ) : (
        <div className="card">
          <h2 className="mb8">🔒 Kartu share mingguan (Pro)</h2>
          <p className="muted mb12">
            Rekap otomatis yang cakep buat dipamerin ke grup WhatsApp/Facebook — total bersih, hari
            terbaik, rata-rata per jam, plus QR ajak teman.
          </p>
          <button className="btn secondary" onClick={() => navigate('pro')}>
            Buka dengan Pro — Rp15rb/bulan
          </button>
        </div>
      )}
    </div>
  );
}
