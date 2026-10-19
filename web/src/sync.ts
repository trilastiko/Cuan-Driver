// Mesin sinkronisasi offline-first (mode normal saja; demo tidak sinkron).
// - Semua tulisan masuk store lokal + antrian outbox.
// - flush(): kirim antrian ke server saat online.
// - pull(): tarik data server & gabungkan (item yang masih di outbox menang).

import { ApiError, realApi } from './api';
import { getState, setState } from './store';
import { shiftDate, todayStr } from '../../shared/dates';

let flushing = false;

export async function flushOutbox(): Promise<void> {
  const s = getState();
  if (s.demo || !s.token || flushing || !navigator.onLine) return;
  if (s.outbox.length === 0) return;

  flushing = true;
  setState({ syncing: true });
  try {
    while (getState().outbox.length > 0) {
      const op = getState().outbox[0];
      try {
        if (op.kind === 'earning') {
          const e = getState().earnings.find((x) => x.id === op.id);
          if (e) {
            await realApi.addEarning(e);
            // tandai sudah sinkron
            setState({
              earnings: getState().earnings.map((x) =>
                x.id === op.id ? { ...x, synced: true } : x
              ),
            });
          }
        } else if (op.kind === 'delete') {
          await realApi.deleteEarning(op.id).catch((err) => {
            if (!(err instanceof ApiError && err.status === 404)) throw err;
          });
        } else if (op.kind === 'settings') {
          await realApi.updateProfile({ settings: getState().settings });
        }
        setState({ outbox: getState().outbox.slice(1) });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // sesi habis — berhenti; UI akan minta login ulang
          break;
        }
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 0) {
          // data ditolak server (validasi) — buang supaya antrian tidak macet
          console.warn('[sync] op ditolak server, dibuang:', op, err.message);
          setState({ outbox: getState().outbox.slice(1) });
          continue;
        }
        break; // offline / server error: coba lagi nanti
      }
    }
  } finally {
    flushing = false;
    setState({ syncing: false });
  }
}

export async function pullFromServer(): Promise<void> {
  const s = getState();
  if (s.demo || !s.token || !navigator.onLine) return;
  try {
    const today = todayStr();
    const [{ earnings: remote }, prof] = await Promise.all([
      realApi.listEarnings(shiftDate(today, -90), today),
      realApi.profile(),
    ]);
    const pendingIds = new Set(
      getState().outbox.filter((o) => o.kind !== 'settings').map((o) => ('id' in o ? o.id : ''))
    );
    const local = getState().earnings;
    const merged = new Map<string, (typeof local)[number]>();
    for (const r of remote) merged.set(r.id, { ...r, synced: true });
    for (const l of local) {
      if (pendingIds.has(l.id) || !merged.has(l.id)) {
        // perubahan lokal yang belum terkirim menang; item lokal murni ikut
        if (!getState().outbox.some((o) => o.kind === 'delete' && 'id' in o && o.id === l.id)) {
          merged.set(l.id, l);
        }
      }
    }
    // item yang menunggu dihapus jangan muncul lagi
    for (const o of getState().outbox) {
      if (o.kind === 'delete') merged.delete(o.id);
    }
    const earnings = [...merged.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const hasPendingSettings = getState().outbox.some((o) => o.kind === 'settings');
    setState({
      earnings,
      user: prof.user,
      ...(hasPendingSettings ? {} : { settings: prof.settings }),
    });
  } catch {
    // offline atau server bermasalah — data lokal tetap dipakai
  }
}

export function startSyncLoop() {
  const kick = () => {
    void flushOutbox().then(() => pullFromServer());
  };
  window.addEventListener('online', () => {
    setState({ online: true });
    kick();
  });
  window.addEventListener('offline', () => setState({ online: false }));
  // sinkron berkala ringan
  setInterval(() => {
    if (getState().outbox.length > 0) void flushOutbox();
  }, 30_000);
  kick();
}
