// Pembacaan screenshot pendapatan via Claude Vision.
// Tanpa ANTHROPIC_API_KEY -> mock deterministik (shared/mockscan) supaya
// seluruh alur tetap bisa didemokan tanpa biaya.

import Anthropic from '@anthropic-ai/sdk';
import type { Env } from './env';
import type { ParsedScan, Platform } from '../shared/types';
import { mockScan } from '../shared/mockscan';
import { isPlatform } from '../shared/platforms';
import { isValidDateStr } from '../shared/dates';

// Model murah by-design — spec produk: "Claude Vision is expensive — use
// smaller models where possible". Override via env ANTHROPIC_MODEL.
const DEFAULT_MODEL = 'claude-haiku-4-5';

export class AiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    platform: { type: 'string', enum: ['gojek', 'grab', 'maxim', 'indrive'] },
    gross_amount: {
      type: 'number',
      description: 'Total pendapatan (Rupiah) yang tampil di layar, angka utuh',
    },
    order_count: { type: 'integer', description: 'Jumlah order/trip selesai; 0 jika tidak tampil' },
    incentive_amount: {
      type: 'number',
      description: 'Porsi bonus/insentif jika tampil terpisah; 0 jika tidak ada',
    },
    date: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Tanggal pada layar dalam YYYY-MM-DD, null jika tidak terlihat',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['platform', 'gross_amount', 'order_count', 'incentive_amount', 'date', 'confidence'],
  additionalProperties: false,
} as const;

function buildPrompt(hint?: Platform): string {
  return [
    'You are reading a screenshot of an Indonesian ride-hailing / food-delivery driver app',
    'earnings screen (Gojek, Grab, Maxim, or inDrive).',
    'Platform-specific cues: Gojek shows "Pendapatan" / GoRide/GoFood in green UI;',
    'Grab shows "Earnings"/"Pendapatan" with green Grab branding; Maxim uses yellow/black UI',
    'with rides list; inDrive uses green/lime UI with "Income".',
    'Amounts are Indonesian Rupiah: "Rp112.500" means 112500 (dots are thousand separators).',
    'Extract: platform, total gross earnings shown for the day/period, completed order count',
    '(0 if not visible), incentive/bonus portion if listed separately (else 0), and the date',
    'shown on screen as YYYY-MM-DD (null if none).',
    hint ? `The driver says this screenshot is from: ${hint}. Use it unless clearly wrong.` : '',
    'If the image is NOT an earnings screen, return gross_amount 0, order_count 0, confidence "low".',
  ]
    .filter(Boolean)
    .join(' ');
}

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export const ALLOWED_MEDIA: MediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function isAiConfigured(env: Env): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

export async function scanScreenshot(
  env: Env,
  imageBase64: string,
  mediaType: MediaType,
  platformHint?: Platform
): Promise<ParsedScan> {
  if (!isAiConfigured(env)) {
    return mockScan(imageBase64, platformHint);
  }

  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY!,
    baseURL: env.ANTHROPIC_BASE_URL || undefined,
    maxRetries: 1,
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: buildPrompt(platformHint) },
          ],
        },
      ],
      output_config: {
        format: { type: 'json_schema', schema: SCAN_SCHEMA as unknown as Record<string, unknown> },
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AiError('Konfigurasi AI bermasalah (API key tidak valid)', 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiError('Layanan AI lagi sibuk, coba lagi sebentar ya', 503);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new AiError('Tidak bisa terhubung ke layanan AI, coba lagi', 503);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[scan] Anthropic API error', err.status, err.message);
      throw new AiError('Layanan AI bermasalah, coba lagi nanti', 502);
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new AiError('Gambar tidak bisa diproses. Coba screenshot layar pendapatan ya', 422);
  }

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    throw new AiError('AI tidak mengembalikan hasil, coba lagi', 502);
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.text);
  } catch {
    throw new AiError('Hasil AI tidak bisa dibaca, coba lagi', 502);
  }

  return coerceScan(raw, platformHint);
}

/** Rapikan & clamp hasil ekstraksi supaya aman disimpan. */
export function coerceScan(raw: Record<string, unknown>, hint?: Platform): ParsedScan {
  const clampMoney = (v: unknown) =>
    Math.min(10_000_000, Math.max(0, Math.round(Number(v) || 0)));
  const platform = isPlatform(raw.platform) ? raw.platform : (hint ?? 'gojek');
  const conf = raw.confidence;
  const date = isValidDateStr(raw.date) ? raw.date : null;
  return {
    platform,
    gross_amount: clampMoney(raw.gross_amount),
    order_count: Math.min(500, Math.max(0, Math.round(Number(raw.order_count) || 0))),
    incentive_amount: clampMoney(raw.incentive_amount),
    date,
    confidence: conf === 'high' || conf === 'medium' || conf === 'low' ? conf : 'low',
    mock: false,
  };
}

export async function sha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
