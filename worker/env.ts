export interface Env {
  DB: D1Database;
  SCREENSHOTS?: R2Bucket;
  ASSETS: Fetcher;
  /** Wajib di produksi (wrangler secret put JWT_SECRET). Kosong = secret sementara per-boot (dev). */
  JWT_SECRET?: string;
  /** Token dashboard admin. Kosong = endpoint admin nonaktif. */
  ADMIN_TOKEN?: string;
  /** Kosong = AI scan berjalan dalam MODE MOCK (tetap bisa didemokan). */
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_BASE_URL?: string;
  APP_URL?: string;
  /** "true" = terima kode lisensi demo CUAN-DEMO-2026. */
  DEMO_MODE?: string;
}

/** Tipe environment Hono: bindings + variabel per-request. */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    userId: string;
  };
};
