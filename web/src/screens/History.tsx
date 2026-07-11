import { useMemo, useState } from 'react';
import { AppBar, Money, toast } from '../ui';
import { queueOp, removeEarningLocal, useStore } from '../store';
import { platformMeta } from '../../../shared/platforms';
import { dailyCosts, netProfit } from '../../../shared/pnl';
import { formatDateID, shiftDate, todayStr } from '../../../shared/dates';
import { formatRupiah } from '../../../shared/money';
import { flushOutbox } from '../sync';

export function History({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore();
  const [rangeDays, setRangeDays] = useState(7);
  const today = todayStr();

  const groups = useMemo(() => {
    const from = shiftDate(today, -(rangeDays - 1));
    const rows = store.earnings.filter((e) => e.date >= from && e.date <= today);
    const byDate = new Map<string, typeof rows>();
    for (const e of rows) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1));
  }, [store.earnings, rangeDays, today]);

  const costs = dailyCosts(store.settings);

  function del(id: string) {
    if (!confirm('Hapus catatan ini?')) return;
    removeEarningLocal(id);
    queueOp({ kind: 'delete', id });
    void flushOutbox();
    toast('Dihapus');
  }

  return (
    <div className="screen">
      <AppBar title="Riwayat" />
      <div className="chips mb12">
        {[7, 30, 90].map((n) => (
          <button key={n} className={`chip ${rangeDays === n ? 'on' : ''}`} onClick={() => setRangeDays(n)}>
            {n} hari
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="card center">
          <div style={{ fontSize: 40 }}>🗒️</div>
          <p className="muted">Belum ada catatan di rentang ini.</p>
          <button className="btn mt12" onClick={() => navigate('tambah')}>
            ＋ Tambah Pendapatan
          </button>
        </div>
      )}

      {groups.map(([date, entries]) => {
        const gross = entries.reduce((a, e) => a + e.gross_amount, 0);
        const net = netProfit(gross, costs);
        return (
          <div key={date}>
            <div className="datehead">
              {formatDateID(date, true)} — kotor {formatRupiah(gross)} ·{' '}
              <span className={net >= 0 ? 'pos-t' : 'neg-t'}>
                bersih <Money v={Math.round(net)} signed />
              </span>
            </div>
            <div className="elist">
              {entries.map((e) => {
                const m = platformMeta(e.platform);
                return (
                  <div className="eitem" key={e.id}>
                    <span className="dot" style={{ width: 12, height: 12, borderRadius: 6, background: m.color, flex: 'none' }} />
                    <div className="mid">
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {m.label}
                        {!e.synced && !store.demo && <span className="tiny"> · ⏳ belum sinkron</span>}
                      </div>
                      <div className="tiny">
                        {e.order_count} order
                        {e.incentive_amount > 0 ? ` · bonus ${formatRupiah(e.incentive_amount)}` : ''}
                        {e.parsed_data ? ' · 🤖 AI' : ''}
                      </div>
                    </div>
                    <div className="amt">{formatRupiah(e.gross_amount)}</div>
                    <button className="del" onClick={() => del(e.id)} aria-label={`Hapus ${m.label} ${formatRupiah(e.gross_amount)}`}>
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
