import { describe, it, expect } from 'vitest';
import { dailyCosts, netProfit, netPerHour, netPerKm, netPerOrder, bepGauge, bepGrossPerHour } from '../shared/pnl';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types';

// Profil driver realistis (dari riset pasar di spec): gross 175-350rb/hari,
// biaya 28-31% dari gross sebelum cicilan.
const s: Settings = {
  ...DEFAULT_SETTINGS,
  fuel_mode: 'per_km',
  fuel_cost_per_km: 250,
  km_per_day: 100,       // bensin 25.000
  meal_cost_per_day: 20000,
  other_cost_per_day: 10000,
  installment_per_month: 910000, // 35.000/hari @26 hari
  service_per_month: 156000,     // 6.000/hari
  work_days_per_month: 26,
  data_cost_per_day: 5000,
  hours_per_day: 10,
};

describe('dailyCosts', () => {
  it('menjumlahkan semua komponen biaya harian', () => {
    const c = dailyCosts(s);
    expect(c.fuel).toBe(25000);
    expect(c.meals).toBe(20000);
    expect(c.other).toBe(10000);
    expect(c.installment).toBe(35000);
    expect(c.service).toBe(6000);
    expect(c.data).toBe(5000);
    expect(c.total).toBe(101000);
  });

  it('mode bensin per hari mengabaikan per-km', () => {
    const c = dailyCosts({ ...s, fuel_mode: 'per_day', fuel_cost_per_day: 30000 });
    expect(c.fuel).toBe(30000);
  });

  it('work_days 0 tidak membagi nol (fallback 26)', () => {
    const c = dailyCosts({ ...s, work_days_per_month: 0 });
    expect(c.installment).toBeCloseTo(910000 / 26);
  });

  it('nilai negatif dianggap 0', () => {
    const c = dailyCosts({ ...s, meal_cost_per_day: -5 });
    expect(c.meals).toBe(0);
  });
});

describe('netProfit & turunannya', () => {
  const c = dailyCosts(s);
  it('net = gross - biaya (verifikasi manual)', () => {
    expect(netProfit(250000, c)).toBe(149000);
    expect(netProfit(80000, c)).toBe(-21000); // tekor
  });
  it('per order / km / jam', () => {
    expect(netPerOrder(149000, 20)).toBe(7450);
    expect(netPerKm(149000, 100)).toBe(1490);
    expect(netPerHour(149000, 10)).toBe(14900);
    expect(netPerOrder(149000, 0)).toBe(0);
  });
});

describe('bepGauge', () => {
  const c = dailyCosts(s); // total 101.000, BEP 10.100/jam @10 jam
  it('BEP per jam = biaya / jam kerja', () => {
    expect(bepGrossPerHour(c, 10)).toBe(10100);
  });
  it('di atas BEP saat laju >= 105%', () => {
    const g = bepGauge(60000, 5, c, 10); // 12.000/jam vs 10.100
    expect(g.pace).toBe('above');
    expect(g.coverage).toBeCloseTo(60000 / 101000);
  });
  it('mendekati BEP di 85-105%', () => {
    const g = bepGauge(50000, 5, c, 10); // 10.000/jam ≈ 99%
    expect(g.pace).toBe('near');
  });
  it('di bawah BEP saat laju < 85%', () => {
    const g = bepGauge(30000, 5, c, 10); // 6.000/jam
    expect(g.pace).toBe('below');
  });
  it('unknown ketika jam belum diisi', () => {
    expect(bepGauge(30000, 0, c, 10).pace).toBe('unknown');
  });
});
