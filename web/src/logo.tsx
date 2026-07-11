// Logo Cuan Driver: speedometer "cuan" — jarum menunjuk ke zona hijau.
// Digambar programatik (SVG di UI, canvas di share card & ikon PWA).

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <rect x="4" y="4" width="88" height="88" rx="24" fill="#00A86B" />
      <path
        d="M 22 62 A 30 30 0 1 1 74 62"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M 48 18 A 30 30 0 0 1 74 62"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line x1="48" y1="58" x2="66" y2="38" stroke="#1A1A2E" strokeWidth="7" strokeLinecap="round" />
      <circle cx="48" cy="60" r="7.5" fill="#1A1A2E" />
      <circle cx="48" cy="60" r="3" fill="#4ECDC4" />
    </svg>
  );
}

/** Versi canvas — dipakai share card & pembuatan ikon. */
export function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opts: { bg?: boolean } = { bg: true }
) {
  const u = size / 96;
  ctx.save();
  ctx.translate(x, y);
  if (opts.bg !== false) {
    roundRect(ctx, 4 * u, 4 * u, 88 * u, 88 * u, 24 * u);
    ctx.fillStyle = '#00A86B';
    ctx.fill();
  }
  ctx.lineCap = 'round';
  // busur redup penuh
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 9 * u;
  ctx.beginPath();
  ctx.arc(48 * u, 48 * u, 30 * u, rad(139), rad(41), false);
  ctx.stroke();
  // busur terang (zona cuan)
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(48 * u, 48 * u, 30 * u, rad(-90), rad(41), false);
  ctx.stroke();
  // jarum
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth = 7 * u;
  ctx.beginPath();
  ctx.moveTo(48 * u, 58 * u);
  ctx.lineTo(66 * u, 38 * u);
  ctx.stroke();
  ctx.fillStyle = '#1A1A2E';
  ctx.beginPath();
  ctx.arc(48 * u, 60 * u, 7.5 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4ECDC4';
  ctx.beginPath();
  ctx.arc(48 * u, 60 * u, 3 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
