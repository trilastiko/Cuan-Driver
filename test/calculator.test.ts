import { describe, it, expect } from 'vitest';
import { calcBeforeAfter, validateBeforeAfter } from '../shared/calculator';

describe('calcBeforeAfter (Perpres 27/2026: komisi 20% -> 8%)', () => {
  it('contoh utama: gross 250rb/hari', () => {
    const r = calcBeforeAfter({ daily_gross: 250000, old_rate: 0.2, new_rate: 0.08 });
    // tarif dasar = 250.000 / 0,8 = 312.500; gross baru = 312.500 * 0,92 = 287.500
    expect(r.fare_base).toBe(312500);
    expect(r.new_gross).toBe(287500);
    expect(r.delta_daily).toBe(37500);
    expect(r.delta_monthly).toBe(37500 * 26);
    expect(r.pct_change).toBe(15);
    expect(r.lebih_cuan).toBe(true);
  });

  it('dengan biaya harian menghasilkan net sebelum/sesudah', () => {
    const r = calcBeforeAfter({
      daily_gross: 250000, old_rate: 0.2, new_rate: 0.08, daily_cost: 101000,
    });
    expect(r.old_net).toBe(149000);
    expect(r.new_net).toBe(186500);
  });

  it('komisi naik berarti tekor', () => {
    const r = calcBeforeAfter({ daily_gross: 200000, old_rate: 0.08, new_rate: 0.2 });
    expect(r.delta_daily).toBeLessThan(0);
    expect(r.lebih_cuan).toBe(false);
  });

  it('validasi menolak input aneh', () => {
    expect(validateBeforeAfter({ daily_gross: 0, old_rate: 0.2, new_rate: 0.08 })).toBeTruthy();
    expect(validateBeforeAfter({ daily_gross: 100, old_rate: 0.95, new_rate: 0.08 })).toBeTruthy();
    expect(validateBeforeAfter({ daily_gross: 100, old_rate: 0.2, new_rate: -0.1 })).toBeTruthy();
    expect(validateBeforeAfter({ daily_gross: 250000, old_rate: 0.2, new_rate: 0.08 })).toBeNull();
  });
});
