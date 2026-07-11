import type { Platform } from './types';

// Warna mengikuti spesifikasi produk (Gojek hijau, Grab biru, Maxim merah,
// inDrive ungu) — sengaja bukan warna brand persis, untuk kontras antar-app
// di dashboard.
export interface PlatformMeta {
  id: Platform;
  label: string;
  color: string;
}

export const PLATFORMS: PlatformMeta[] = [
  { id: 'gojek', label: 'Gojek', color: '#00AA13' },
  { id: 'grab', label: 'Grab', color: '#1E7CE8' },
  { id: 'maxim', label: 'Maxim', color: '#E0393E' },
  { id: 'indrive', label: 'inDrive', color: '#7B61FF' },
];

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

export function platformMeta(id: Platform): PlatformMeta {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

export function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && (PLATFORM_IDS as string[]).includes(v);
}
