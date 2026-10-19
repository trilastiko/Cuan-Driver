// Matematika laba-rugi (P&L) driver — satu sumber kebenaran untuk Worker & PWA.

import type { Settings } from './types';

export interface DailyCosts {
  fuel: number;
  meals: number;
  other: number;
  installment: number;
  service: number;
  data: number;
  total: number;
}

/** Rincian biaya per hari kerja berdasarkan pengaturan driver. */
export function dailyCosts(s: Settings): DailyCosts {
  const workDays = s.work_days_per_month > 0 ? s.work_days_per_month : 26;
  const fuel =
    s.fuel_mode === 'per_km' ? s.fuel_cost_per_km * s.km_per_day : s.fuel_cost_per_day;
  const installment = s.installment_per_month / workDays;
  const service = s.service_per_month / workDays;
  const parts = {
    fuel: Math.max(0, fuel || 0),
    meals: Math.max(0, s.meal_cost_per_day || 0),
    other: Math.max(0, s.other_cost_per_day || 0),
    installment: Math.max(0, installment || 0),
    service: Math.max(0, service || 0),
    data: Math.max(0, s.data_cost_per_day || 0),
  };
  const total =
    parts.fuel + parts.meals + parts.other + parts.installment + parts.service + parts.data;
  return { ...parts, total };
}

/** Cuan bersih = kotor - total biaya harian. Bisa negatif (tekor). */
export function netProfit(gross: number, costs: DailyCosts): number {
  return gross - costs.total;
}

export function netPerOrder(net: number, orders: number): number {
  return orders > 0 ? net / orders : 0;
}

export function netPerKm(net: number, km: number): number {
  return km > 0 ? net / km : 0;
}

export function netPerHour(net: number, hours: number): number {
  return hours > 0 ? net / hours : 0;
}

/**
 * Titik impas (BEP) dalam pendapatan kotor per jam:
 * berapa Rp kotor/jam minimal supaya biaya harian tertutup dalam jam kerja normal.
 */
export function bepGrossPerHour(costs: DailyCosts, plannedHours: number): number {
  const h = plannedHours > 0 ? plannedHours : 10;
  return costs.total / h;
}

export type PaceStatus = 'above' | 'near' | 'below' | 'unknown';

export interface BepGauge {
  /** 0..n — porsi biaya harian yang sudah tertutup pendapatan kotor (1 = BEP) */
  coverage: number;
  /** Rp kotor/jam saat ini (0 jika jam belum diisi) */
  currentGrossPerHour: number;
  /** Rp kotor/jam minimal untuk BEP */
  bepGrossPerHour: number;
  /** Laju saat ini vs BEP: above (>=105%), near (>=85%), below (<85%) */
  pace: PaceStatus;
}

/**
 * Sinyal BEP live untuk dashboard.
 * - coverage: gross / total biaya (progress menuju impas)
 * - pace: membandingkan Rp/jam berjalan dengan Rp/jam minimum
 */
export function bepGauge(
  grossToday: number,
  hoursSoFar: number,
  costs: DailyCosts,
  plannedHours: number
): BepGauge {
  const bep = bepGrossPerHour(costs, plannedHours);
  const coverage = costs.total > 0 ? grossToday / costs.total : grossToday > 0 ? 2 : 0;
  const currentGrossPerHour = hoursSoFar > 0 ? grossToday / hoursSoFar : 0;
  let pace: PaceStatus = 'unknown';
  if (hoursSoFar > 0 && bep > 0) {
    const ratio = currentGrossPerHour / bep;
    pace = ratio >= 1.05 ? 'above' : ratio >= 0.85 ? 'near' : 'below';
  }
  return { coverage, currentGrossPerHour, bepGrossPerHour: bep, pace };
}
