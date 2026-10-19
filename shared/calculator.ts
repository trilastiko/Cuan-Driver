// Kalkulator "Sebelum vs Sesudah" perubahan komisi (Perpres 27/2026: 20% -> 8%).
//
// Asumsi (ditampilkan juga di UI): jumlah order dan tarif dasar (yang dibayar
// penumpang) tidak berubah. Input driver adalah pendapatan kotor HARIAN yang
// DITERIMA saat komisi lama berlaku, sehingga:
//   tarifDasar   = grossLama / (1 - komisiLama)
//   grossBaru    = tarifDasar * (1 - komisiBaru)
//   selisih/hari = grossLama * (komisiLama - komisiBaru) / (1 - komisiLama)

export interface BeforeAfterInput {
  /** Pendapatan kotor per hari yang diterima driver saat komisi lama (Rp) */
  daily_gross: number;
  /** Komisi lama sebagai pecahan, mis. 0.20 */
  old_rate: number;
  /** Komisi baru sebagai pecahan, mis. 0.08 */
  new_rate: number;
  /** Opsional: total biaya operasional harian untuk menghitung net (Rp) */
  daily_cost?: number;
  /** Hari kerja per bulan untuk proyeksi bulanan (default 26) */
  work_days?: number;
}

export interface BeforeAfterResult {
  fare_base: number;
  old_gross: number;
  new_gross: number;
  delta_daily: number;
  delta_monthly: number;
  /** persen perubahan gross, mis. 15 artinya +15% */
  pct_change: number;
  old_net: number | null;
  new_net: number | null;
  /** true jika driver jadi lebih cuan */
  lebih_cuan: boolean;
}

export function validateBeforeAfter(input: BeforeAfterInput): string | null {
  if (!Number.isFinite(input.daily_gross) || input.daily_gross <= 0)
    return 'Isi pendapatan kotor harian dulu ya';
  if (input.daily_gross > 10_000_000) return 'Angka pendapatan tidak masuk akal';
  for (const [label, v] of [
    ['komisi lama', input.old_rate],
    ['komisi baru', input.new_rate],
  ] as const) {
    if (!Number.isFinite(v) || v < 0 || v >= 0.9) return `Persen ${label} harus 0–90%`;
  }
  return null;
}

export function calcBeforeAfter(input: BeforeAfterInput): BeforeAfterResult {
  const err = validateBeforeAfter(input);
  if (err) throw new Error(err);
  const { daily_gross, old_rate, new_rate } = input;
  const workDays = input.work_days && input.work_days > 0 ? input.work_days : 26;

  const fareBase = daily_gross / (1 - old_rate);
  const newGross = fareBase * (1 - new_rate);
  const delta = newGross - daily_gross;

  const cost = input.daily_cost;
  const hasCost = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;

  return {
    fare_base: Math.round(fareBase),
    old_gross: Math.round(daily_gross),
    new_gross: Math.round(newGross),
    delta_daily: Math.round(delta),
    delta_monthly: Math.round(delta * workDays),
    pct_change: daily_gross > 0 ? Math.round((delta / daily_gross) * 1000) / 10 : 0,
    old_net: hasCost ? Math.round(daily_gross - cost!) : null,
    new_net: hasCost ? Math.round(newGross - cost!) : null,
    lebih_cuan: delta > 0,
  };
}
