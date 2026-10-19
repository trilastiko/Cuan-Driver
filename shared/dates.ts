// Tanggal lokal driver. Default zona waktu Asia/Jakarta (WIB) — mayoritas
// pengguna; perangkat di WITA/WIT tetap benar karena klien mengirim tanggal
// hasil hitung lokal, bukan UTC.

export const DEFAULT_TZ = 'Asia/Jakarta';

/** Tanggal "hari ini" sebagai YYYY-MM-DD pada zona waktu tertentu. */
export function todayStr(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  // en-CA menghasilkan format YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Geser tanggal YYYY-MM-DD sebanyak delta hari (kalender murni, bebas TZ). */
export function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d + delta);
  const dt = new Date(t);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** n tanggal terakhir berakhir di `end` (inklusif), urut naik. */
export function lastNDates(n: number, end: string): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftDate(end, -i));
  return out;
}

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_NAMES_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function dow(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2026-07-11" -> "Sabtu, 11 Juli 2026" */
export function formatDateID(date: string, short = false): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = short ? DAY_NAMES_SHORT_ID[dow(date)] : DAY_NAMES_ID[dow(date)];
  return `${day}, ${d} ${short ? MONTH_NAMES_ID[m - 1].slice(0, 3) : MONTH_NAMES_ID[m - 1]} ${y}`;
}

/** Nama hari pendek ("Sen") untuk label sparkline. */
export function shortDayID(date: string): string {
  return DAY_NAMES_SHORT_ID[dow(date)];
}

export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  return y >= 2020 && y <= 2100;
}
