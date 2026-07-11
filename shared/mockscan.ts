// Mock parser screenshot — dipakai ketika ANTHROPIC_API_KEY tidak diset
// (mode demo tanpa biaya). Deterministik terhadap isi gambar: screenshot yang
// sama selalu menghasilkan angka yang sama, supaya demo terasa nyata.

import type { ParsedScan, Platform } from './types';
import { PLATFORM_IDS } from './platforms';

function fnv1a(data: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toBytes(input: Uint8Array | string): Uint8Array {
  if (typeof input !== 'string') return input;
  // Sampling supaya string base64 panjang tidak mahal di CPU.
  const step = Math.max(1, Math.floor(input.length / 4096));
  const out = new Uint8Array(Math.ceil(input.length / step));
  for (let i = 0, j = 0; i < input.length; i += step, j++) out[j] = input.charCodeAt(i) & 0xff;
  return out;
}

const INCENTIVES = [0, 0, 0, 10000, 15000, 20000, 25000];

export function mockScan(image: Uint8Array | string, platformHint?: Platform): ParsedScan {
  const rand = mulberry32(fnv1a(toBytes(image)) || 1);
  const gross = 80000 + Math.floor(rand() * 40) * 5000; // 80rb..275rb, kelipatan 5rb
  const orders = 6 + Math.floor(rand() * 19); // 6..24
  const incentive = INCENTIVES[Math.floor(rand() * INCENTIVES.length)];
  const platform = platformHint ?? PLATFORM_IDS[Math.floor(rand() * PLATFORM_IDS.length)];
  return {
    platform,
    gross_amount: gross,
    order_count: orders,
    incentive_amount: incentive,
    date: null,
    confidence: 'demo',
    mock: true,
    notes:
      'Hasil contoh (mode demo tanpa API key). Pasang ANTHROPIC_API_KEY untuk pembacaan AI sungguhan.',
  };
}
