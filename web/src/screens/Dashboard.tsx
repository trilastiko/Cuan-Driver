import { useMemo } from 'react';
import { setHoursToday, useStore } from '../store';
import {
  BepGaugeView, Money, PlatformBreakdown, Sparkline, type SparkDay,
} from '../ui';
import {
  bepGauge, dailyCosts, netPerHour, netPerOrder, netPerKm, netProfit,
} from '../../../shared/pnl';
import { formatDateID, lastNDates, todayStr } from '../../../shared/dates';
import { formatRupiah } from '../../../shared/money';
import type { Platform } from '../../../shared/types';

export function Dashboard({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore();
  const today = todayStr();
  const pro = !!store.user?.is_pro;

  const d = useMemo(() => {
    const costs = dailyCosts(store.settings);
    const todays = store.earnings.filter((e) => e.date === today);
    const gross = todays.reduce((a, e) => a + e.gross_amount, 0);
    const orders = todays.reduce((a, e) => a + e.order_count, 0);
    const net = netProfit(gross, costs);
    const hours = store.hoursByDate[today] ?? 0;
    const gauge = bepGauge(gross, hours, costs, store.settings.hours_per_day);

    const byPlatform = new Map<Platform, number>();
    for (const e of todays) byPlatform.set(e.platform, (byPlatform.get(e.platform) ?? 0) + e.gross_amount);
    const breakdown = [...byPlatform.entries()]
      .map(([platform, g]) => ({ platform, gross: g }))
      .sort((a, b) => b.gross - a.gross);

    const week: SparkDay[] = lastNDates(7, today).map((date) => {
      const entries = store.earnings.filter((e) => e.date === date);
      const g = entries.reduce((a, e) => a + e.gross_amount, 0);
      return { date, hasData: entries.length > 0, net: entries.length > 0 ? netProfit(g, costs) : 0 };
    });

    return { costs, gross, orders, net, hours, gauge, breakdown, week, hasData: todays.length > 0 };
  }, [store.earnings, store.settings, store.hoursByDate, today]);

  const unsynced = store.outbox.length;
  const targetFrac = store.settings.target_daily_profit > 0
    ? Math.max(0, Math.min(1, d.net / store.settings.target_daily_profit))
    : 0;

  return (
    <div className="screen">
      <div className="row between mb12">
        <div>
          <h1>Halo, {store.user?.name || 'bang'} 👋</h1>
          <div className="muted">{formatDateID(today)}</div>
        </div>
        {store.demo && <span className="banner info" style={{ margin: 0, padding: '6px 10px' }}>MODE DEMO</span>}
      </div>

      {!store.online && !store.demo && (
        <div className="banner warn">📡 Lagi offline — data tersimpan di HP, otomatis sinkron nanti.</div>
      )}
      {store.online && unsynced > 0 && (
        <div className="banner info">⏳ {unsynced} data menunggu sinkron{store.syncing ? '…' : ''}</div>
      )}

      {/* ---- kartu cuan bersih ---- */}
      <div className="card center">
        <div className="muted">Cuan bersih hari ini</div>
        <div className={`hero-number ${d.net >= 0 ? 'pos' : 'neg'}`}>
          <Money v={Math.round(d.net)} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 14 }} className={d.net >= 0 ? 'pos-t' : 'neg-t'}>
          {!d.hasData ? '· belum ada data hari ini ·' : d.net >= 0 ? '✅ CUAN' : '⚠️ MASIH TEKOR'}
        </div>
        <div className="tiny mt8">
          Kotor {formatRupiah(d.gross)} · Biaya {formatRupiah(Math.round(d.costs.total))} · {d.orders} order
        </div>

        {/* target harian (fitur gratis) */}
        <div className="gauge-track" aria-hidden="true">
          <div
            className="gauge-fill above"
            style={{ width: `${Math.max(2, targetFrac * 100)}%`, background: 'var(--teal)' }}
          />
        </div>
        <div className="tiny">
          Target {formatRupiah(store.settings.target_daily_profit)} — tercapai {Math.round(targetFrac * 100)}%
        </div>

        {/* jam kerja hari ini */}
        <div className="row mt12" style={{ justifyContent: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>Jam kerja hari ini:</span>
          <button className="btn small ghost" onClick={() => setHoursToday(today, Math.max(0, d.hours - 0.5))} aria-label="Kurangi jam">
            −
          </button>
          <b style={{ minWidth: 58, textAlign: 'center' }}>{d.hours} jam</b>
          <button className="btn small ghost" onClick={() => setHoursToday(today, Math.min(24, d.hours + 0.5))} aria-label="Tambah jam">
            +
          </button>
        </div>
      </div>

      {/* ---- sinyal BEP (Pro) ---- */}
      <div className="card">
        <h2 className="mb8">⚡ Sinyal BEP Live</h2>
        {pro ? (
          <BepGaugeView g={d.gauge} totalCost={Math.round(d.costs.total)} />
        ) : (
          <div>
            <p className="muted mb8">
              Tahu kapan harus <b>gas terus</b> dan kapan <b>mending pulang</b> — laju Rp/jam kamu
              dibanding titik impas, live sepanjang hari.
            </p>
            <button className="btn secondary" onClick={() => navigate('pro')}>
              🔓 Buka dengan Pro
            </button>
          </div>
        )}
      </div>

      {/* ---- statistik cepat ---- */}
      <div className="grid2 mb12">
        <div className="stat">
          <div className="v">{d.orders > 0 ? formatRupiah(Math.round(netPerOrder(d.net, d.orders))) : '—'}</div>
          <div className="l">Bersih per order</div>
        </div>
        <div className="stat">
          <div className="v">
            {d.hours > 0 ? `${formatRupiah(Math.round(netPerHour(d.net, d.hours)))}` : '—'}
          </div>
          <div className="l">Bersih per jam</div>
        </div>
        <div className="stat">
          <div className="v">
            {store.settings.km_per_day > 0 && d.hasData
              ? formatRupiah(Math.round(netPerKm(d.net, store.settings.km_per_day)))
              : '—'}
          </div>
          <div className="l">Bersih per km (est.)</div>
        </div>
        <div className="stat">
          <div className="v">
            {d.breakdown[0] ? d.breakdown[0].platform.toUpperCase() : '—'}
          </div>
          <div className="l">App terbaik hari ini</div>
        </div>
      </div>

      {/* ---- per aplikasi ---- */}
      <div className="card">
        <h2 className="mb8">📱 Per aplikasi hari ini</h2>
        <PlatformBreakdown rows={d.breakdown} />
        {!pro && store.settings.apps_used.length > 1 && (
          <div className="tiny mt8">
            🔒 Gabungan multi-app penuh (input semua aplikasi) adalah fitur <b>Pro</b>.
          </div>
        )}
      </div>

      {/* ---- 7 hari ---- */}
      <div className="card">
        <h2 className="mb8">📈 7 hari terakhir (bersih)</h2>
        <Sparkline days={d.week} />
      </div>

      {/* ---- aksi utama ---- */}
      <button className="btn" style={{ marginBottom: 10 }} onClick={() => navigate('tambah')}>
        ＋ Tambah Pendapatan
      </button>
      <button className="btn secondary" onClick={() => navigate('rekap')}>
        📊 Lihat Rekap Minggu Ini
      </button>

      <div className="card mt12 row between" onClick={() => navigate('kalkulator')} style={{ cursor: 'pointer' }}>
        <div>
          <b>🧮 Tarif baru: tekor atau cuan?</b>
          <div className="tiny">Komisi 20% → 8%. Hitung &amp; bagikan ke grup.</div>
        </div>
        <span style={{ fontSize: 20 }}>›</span>
      </div>
    </div>
  );
}
