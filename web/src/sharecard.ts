// Kartu share (PNG 1080×1080) digambar via canvas — bekerja offline dan di
// mode demo. Dua varian: rekap mingguan & hasil kalkulator tarif.
// QR code: qrcode-generator (offline, tanpa jaringan).

import qrcode from 'qrcode-generator';
import { drawLogoMark, roundRect } from './logo';
import { formatRupiah, formatRupiahSigned } from '../../shared/money';

const W = 1080;
const H = 1080;

const INK = '#1A1A2E';
const GREEN = '#00A86B';
const GREEN_DARK = '#0B5C42';
const ORANGE = '#FF6B35';

export interface RecapCardData {
  rangeLabel: string;
  totalNet: number;
  totalGross: number;
  totalOrders: number;
  perHour: number;
  bestDay: { label: string; net: number } | null;
  worstDay: { label: string; net: number } | null;
  appUrl: string;
}

export interface CalcCardData {
  oldPct: number;
  newPct: number;
  oldGross: number;
  newGross: number;
  deltaDaily: number;
  deltaMonthly: number;
  appUrl: string;
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

function bg(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#063F2D');
  g.addColorStop(0.55, '#00815A');
  g.addColorStop(1, '#00A86B');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function header(ctx: CanvasRenderingContext2D, subtitle: string) {
  drawLogoMark(ctx, 64, 56, 110);
  ctx.fillStyle = '#fff';
  ctx.font = '800 52px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('CUAN DRIVER', 198, 74);
  ctx.font = '600 30px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(subtitle, 198, 134);
}

function footer(ctx: CanvasRenderingContext2D, appUrl: string) {
  // panel putih bawah dengan QR + ajakan
  const y = H - 208;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, 48, y, W - 96, 152, 24);
  ctx.fill();

  // QR
  const qr = qrcode(0, 'M');
  qr.addData(appUrl);
  qr.make();
  const n = qr.getModuleCount();
  const qsize = 116;
  const cell = qsize / n;
  const qx = 76;
  const qy = y + 18;
  ctx.fillStyle = INK;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }

  ctx.fillStyle = INK;
  ctx.font = '800 34px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Cek: tekor atau cuan?', 220, y + 34);
  ctx.font = '600 26px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#5B5E6E';
  ctx.fillText('Gratis buat driver ojol — scan QR atau buka:', 220, y + 78);
  ctx.fillStyle = GREEN_DARK;
  ctx.font = '800 27px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(appUrl.replace(/^https?:\/\//, ''), 220, y + 110);
}

function statBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueColor = INK
) {
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.fillStyle = '#5B5E6E';
  ctx.font = '700 24px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(label, x + 24, y + 22);
  ctx.fillStyle = valueColor;
  ctx.font = '800 40px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(value, x + 24, y + 58);
}

export function drawRecapCard(d: RecapCardData): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas();
  bg(ctx);
  header(ctx, 'Rekap Minggu Ini');

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 28px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(d.rangeLabel, 64, 218);

  // angka utama
  ctx.fillStyle = '#fff';
  ctx.font = '700 34px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Cuan bersih minggu ini', 64, 280);
  ctx.font = '800 110px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = d.totalNet >= 0 ? '#fff' : '#FFD9CB';
  ctx.fillText(formatRupiah(d.totalNet), 64, 330);

  // grid statistik
  const gw = (W - 96 - 24) / 2;
  statBox(ctx, 48, 500, gw, 108, 'Pendapatan kotor', formatRupiah(d.totalGross));
  statBox(ctx, 48 + gw + 24, 500, gw, 108, 'Total order', `${d.totalOrders} order`);
  statBox(ctx, 48, 632, gw, 108, 'Rata-rata per jam', `${formatRupiah(Math.round(d.perHour))}/jam`);
  statBox(
    ctx,
    48 + gw + 24,
    632,
    gw,
    108,
    'Hari terbaik',
    d.bestDay ? `${d.bestDay.label} · ${formatRupiahSigned(d.bestDay.net)}` : '—',
    GREEN
  );
  statBox(
    ctx,
    48,
    764,
    W - 96,
    108,
    'Hari terberat',
    d.worstDay ? `${d.worstDay.label} · ${formatRupiahSigned(d.worstDay.net)}` : '—',
    d.worstDay && d.worstDay.net < 0 ? ORANGE : INK
  );

  footer(ctx, d.appUrl);
  return canvas;
}

export function drawCalcCard(d: CalcCardData): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas();
  bg(ctx);
  header(ctx, 'Kalkulator Tarif Baru');

  ctx.fillStyle = '#fff';
  ctx.font = '800 54px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Cek: tekor atau cuan', 64, 226);
  ctx.fillText('setelah komisi turun?', 64, 292);

  // dua kolom sebelum/sesudah
  const gw = (W - 96 - 24) / 2;
  statBox(ctx, 48, 400, gw, 128, `SEBELUM (komisi ${d.oldPct}%)`, formatRupiah(d.oldGross));
  statBox(ctx, 48 + gw + 24, 400, gw, 128, `SESUDAH (komisi ${d.newPct}%)`, formatRupiah(d.newGross), GREEN_DARK);

  // hasil
  const pos = d.deltaDaily >= 0;
  ctx.fillStyle = pos ? 'rgba(224,245,236,0.97)' : 'rgba(255,233,224,0.97)';
  roundRect(ctx, 48, 560, W - 96, 240, 24);
  ctx.fill();
  ctx.fillStyle = pos ? GREEN_DARK : '#B23C14';
  ctx.font = '700 34px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(pos ? 'Kamu LEBIH CUAN' : 'Kamu MALAH TEKOR', 84, 592);
  ctx.font = '800 84px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${formatRupiahSigned(d.deltaDaily)}/hari`, 84, 646);
  ctx.font = '700 32px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`≈ ${formatRupiahSigned(d.deltaMonthly)}/bulan`, 84, 744);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 26px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Asumsi: jumlah order & tarif dasar tetap sama', 64, 828);

  footer(ctx, d.appUrl);
  return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob gagal'))), 'image/png');
  });
}

/** Bagikan (Web Share API dgn file) atau unduh sebagai fallback. */
export async function shareCanvas(canvas: HTMLCanvasElement, filename: string, text: string) {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch {
      // dibatalkan user — lanjut unduh? tidak, cukup diam
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export function appUrl(): string {
  if (typeof location !== 'undefined' && location.hostname !== 'localhost') {
    return `${location.origin}`;
  }
  return 'https://cuandriver.id';
}
