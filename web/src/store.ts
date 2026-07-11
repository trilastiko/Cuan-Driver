// Store lokal (offline-first). localStorage adalah sumber kebenaran UI;
// server hanya sinkronisasi. Di lingkungan tanpa storage (mis. artifact
// sandbox) jatuh ke memori — app tetap jalan, hanya tidak persisten.

import { useSyncExternalStore } from 'react';
import type { Earning, Settings, User } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

export type OutboxOp =
  | { kind: 'earning'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'settings' };

export interface State {
  token: string | null;
  user: User | null;
  /** Mode demo: tanpa server, data contoh, semua fitur kebuka via kode demo */
  demo: boolean;
  onboarded: boolean;
  settings: Settings;
  earnings: Earning[];
  /** Jam kerja per tanggal (input driver di dashboard, disimpan lokal) */
  hoursByDate: Record<string, number>;
  outbox: OutboxOp[];
  online: boolean;
  syncing: boolean;
}

const KEY = 'cuan.v1';

function freshState(): State {
  return {
    token: null,
    user: null,
    demo: false,
    onboarded: false,
    settings: { ...DEFAULT_SETTINGS },
    earnings: [],
    hoursByDate: {},
    outbox: [],
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    syncing: false,
  };
}

let memoryFallback: string | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memoryFallback;
  }
}

function writeRaw(v: string) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    memoryFallback = v;
  }
}

function load(): State {
  const base = freshState();
  const raw = readRaw();
  if (!raw) return base;
  try {
    const saved = JSON.parse(raw) as Partial<State>;
    return {
      ...base,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
      earnings: Array.isArray(saved.earnings) ? saved.earnings : [],
      outbox: Array.isArray(saved.outbox) ? saved.outbox : [],
      hoursByDate: saved.hoursByDate ?? {},
      online: base.online,
      syncing: false,
    };
  } catch {
    return base;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  const { online: _o, syncing: _s, ...toSave } = state;
  writeRaw(JSON.stringify(toSave));
}

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((fn) => fn());
}

export function useStore(): State {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state
  );
}

// ---------- aksi ----------

export function upsertEarningLocal(e: Earning) {
  const rest = state.earnings.filter((x) => x.id !== e.id);
  const earnings = [...rest, e].sort((a, b) =>
    a.date === b.date ? (a.created_at ?? '').localeCompare(b.created_at ?? '') : a.date < b.date ? -1 : 1
  );
  setState({ earnings });
}

export function removeEarningLocal(id: string) {
  setState({ earnings: state.earnings.filter((x) => x.id !== id) });
}

export function queueOp(op: OutboxOp) {
  if (state.demo) return; // demo tidak sinkron ke server
  // 'settings' cukup satu di antrian; earning/delete diganti dgn yang terbaru
  const rest = state.outbox.filter((o) =>
    op.kind === 'settings' ? o.kind !== 'settings' : !(o.kind === op.kind && 'id' in o && 'id' in op && o.id === op.id)
  );
  setState({ outbox: [...rest, op] });
}

export function setHoursToday(date: string, hours: number) {
  setState({ hoursByDate: { ...state.hoursByDate, [date]: hours } });
}

export function logout() {
  const keep = state.onboarded;
  state = { ...freshState(), onboarded: keep };
  persist();
  listeners.forEach((fn) => fn());
}

/** Data contoh untuk mode demo: seminggu narik dengan pola realistis. */
export function seedDemoData(todayIso: string, shift: (d: string, n: number) => string): Earning[] {
  const spec: Array<[number, Array<[Earning['platform'], number, number, number]>]> = [
    [6, [['gojek', 155000, 14, 10000], ['grab', 88000, 7, 0]]],
    [5, [['gojek', 201000, 18, 20000]]],
    [4, [['grab', 74000, 6, 0], ['maxim', 43000, 5, 0]]],
    [3, [['gojek', 230500, 21, 25000], ['grab', 61000, 5, 0]]],
    [2, [['gojek', 96000, 9, 0]]],
    [1, [['gojek', 178000, 16, 15000], ['maxim', 52000, 6, 0]]],
    [0, [['gojek', 122000, 11, 10000]]],
  ];
  const out: Earning[] = [];
  for (const [daysAgo, entries] of spec) {
    for (const [platform, gross, orders, inc] of entries) {
      out.push({
        id: `demo-${daysAgo}-${platform}`,
        platform,
        gross_amount: gross,
        order_count: orders,
        incentive_amount: inc,
        date: shift(todayIso, -daysAgo),
        synced: true,
        created_at: new Date().toISOString(),
      });
    }
  }
  return out;
}
