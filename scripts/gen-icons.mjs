// Membuat ikon PWA (PNG) + gambar OG dari logo SVG, dirender via Chromium
// bawaan lingkungan (playwright-core, tanpa unduhan browser).
// Hasil di-commit ke repo supaya build tidak butuh Playwright.

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'web', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (existsSync(c)) return c;
    } catch {
      /* lanjut */
    }
  }
  return undefined; // biar playwright resolve sendiri via PLAYWRIGHT_BROWSERS_PATH
}

const LOGO = (pad) => `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:transparent}
  .wrap{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:${pad ? '#00A86B' : 'transparent'}}
  svg{width:${pad ? '66%' : '100%'};height:${pad ? '66%' : '100%'}}
</style></head><body><div class="wrap">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect x="4" y="4" width="88" height="88" rx="24" fill="#00A86B"/>
  <path d="M 22 62 A 30 30 0 1 1 74 62" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="9" stroke-linecap="round"/>
  <path d="M 48 18 A 30 30 0 0 1 74 62" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
  <line x1="48" y1="58" x2="66" y2="38" stroke="#1A1A2E" stroke-width="7" stroke-linecap="round"/>
  <circle cx="48" cy="60" r="7.5" fill="#1A1A2E"/>
  <circle cx="48" cy="60" r="3" fill="#4ECDC4"/>
</svg></div></body></html>`;

const OG = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0}
  .og{width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;padding:72px;box-sizing:border-box;
      background:linear-gradient(135deg,#063F2D 0%,#00815A 55%,#00A86B 100%);
      font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#fff}
  .row{display:flex;align-items:center;gap:24px}
  h1{font-size:64px;margin:28px 0 8px;font-weight:800;letter-spacing:-0.02em}
  p{font-size:30px;margin:0;opacity:.92;font-weight:600}
  .tag{font-size:38px;font-weight:800;margin-top:4px}
  .brand{font-size:40px;font-weight:800}
  svg{width:96px;height:96px}
</style></head><body><div class="og">
  <div class="row">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect x="4" y="4" width="88" height="88" rx="24" fill="#00A86B" stroke="rgba(255,255,255,.5)" stroke-width="2"/>
      <path d="M 22 62 A 30 30 0 1 1 74 62" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="9" stroke-linecap="round"/>
      <path d="M 48 18 A 30 30 0 0 1 74 62" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/>
      <line x1="48" y1="58" x2="66" y2="38" stroke="#1A1A2E" stroke-width="7" stroke-linecap="round"/>
      <circle cx="48" cy="60" r="7.5" fill="#1A1A2E"/><circle cx="48" cy="60" r="3" fill="#4ECDC4"/>
    </svg>
    <div class="brand">CUAN DRIVER</div>
  </div>
  <h1>Cek: tekor atau cuan?</h1>
  <div class="tag">Penghasilan BERSIH ojol, bukan cuma kotor.</div>
  <p>Scan screenshot → Gojek + Grab + Maxim + inDrive jadi satu dashboard.</p>
</div></body></html>`;

const exe = findChromium();
console.log('Chromium:', exe ?? '(auto)');
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

async function shot(html, w, h, file, transparent = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: join(outDir, file), omitBackground: transparent });
  await page.close();
  console.log('✔', file, `${w}x${h}`);
}

await shot(LOGO(false), 512, 512, 'icon-512.png', true);
await shot(LOGO(false), 192, 192, 'icon-192.png', true);
await shot(LOGO(true), 512, 512, 'maskable-512.png');
await shot(OG, 1200, 630, 'og-image.png');

await browser.close();
console.log('Selesai →', outDir);
