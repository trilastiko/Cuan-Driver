// Shared domain types — used by both the Worker (API) and the PWA (client).

export type Platform = 'gojek' | 'grab' | 'maxim' | 'indrive';

export type FuelMode = 'per_km' | 'per_day';

/** Biaya operasional & preferensi driver. Semua nominal dalam Rupiah utuh. */
export interface Settings {
  apps_used: Platform[];
  fuel_mode: FuelMode;
  /** Rp per km (dipakai jika fuel_mode = per_km) */
  fuel_cost_per_km: number;
  /** Estimasi km yang ditempuh per hari kerja */
  km_per_day: number;
  /** Rp per hari (dipakai jika fuel_mode = per_day) */
  fuel_cost_per_day: number;
  meal_cost_per_day: number;
  /** Rokok/parkir/lain-lain per hari */
  other_cost_per_day: number;
  /** Cicilan motor per bulan (dibagi hari kerja) */
  installment_per_month: number;
  /** Servis + sparepart per bulan (dibagi hari kerja) */
  service_per_month: number;
  /** Hari kerja per bulan, untuk membagi biaya bulanan (default 26) */
  work_days_per_month: number;
  /** Kuota data/pulsa per hari */
  data_cost_per_day: number;
  /** Jam kerja normal per hari */
  hours_per_day: number;
  /** Target cuan bersih per hari */
  target_daily_profit: number;
}

export const DEFAULT_SETTINGS: Settings = {
  apps_used: ['gojek'],
  fuel_mode: 'per_km',
  fuel_cost_per_km: 250,
  km_per_day: 100,
  fuel_cost_per_day: 25000,
  meal_cost_per_day: 20000,
  other_cost_per_day: 10000,
  installment_per_month: 0,
  service_per_month: 150000,
  work_days_per_month: 26,
  data_cost_per_day: 5000,
  hours_per_day: 10,
  target_daily_profit: 150000,
};

export interface Earning {
  id: string;
  platform: Platform;
  gross_amount: number;
  order_count: number;
  incentive_amount: number;
  /** YYYY-MM-DD (zona waktu perangkat driver) */
  date: string;
  hours_worked?: number | null;
  screenshot_key?: string | null;
  /** Hasil mentah ekstraksi AI (untuk audit) */
  parsed_data?: unknown;
  created_at?: string;
  /** Client-side saja: sudah tersinkron ke server? */
  synced?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  is_pro: boolean;
  pro_expires_at: string | null;
  referral_code: string;
  free_scans_used: number;
  created_at?: string;
}

export interface ParsedScan {
  platform: Platform;
  gross_amount: number;
  order_count: number;
  incentive_amount: number;
  /** YYYY-MM-DD jika terbaca dari screenshot, selain itu null */
  date: string | null;
  confidence: 'high' | 'medium' | 'low' | 'demo';
  /** true jika hasil dari mock parser (tanpa API key) */
  mock: boolean;
  /** true jika diambil dari cache (hemat biaya API) */
  cached?: boolean;
  notes?: string;
}

export type LicenseTier = 'monthly' | 'yearly' | 'demo';

export interface SummaryRow {
  date: string;
  platform: Platform;
  gross: number;
  orders: number;
  incentive: number;
  entries: number;
}
