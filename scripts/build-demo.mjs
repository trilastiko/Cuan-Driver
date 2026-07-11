// Menggabungkan hasil `vite build --mode demo` menjadi SATU file HTML mandiri
// (JS + CSS + favicon inline) — bisa dibuka dari file lokal, dikirim via chat,
// atau dipublikasikan sebagai halaman demo. Tidak ada permintaan jaringan.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist', 'demo');

let html = readFileSync(join(dist, 'index.html'), 'utf8');

// Inline semua <script type="module" src="/assets/xxx.js">
html = html.replace(
  /<script type="module"[^>]*src="\/(assets\/[^"]+)"[^>]*><\/script>/g,
  (_, path) => {
    const js = readFileSync(join(dist, path), 'utf8');
    return `<script type="module">${js}</script>`;
  }
);

// Inline semua stylesheet
html = html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+)"[^>]*>/g, (_, path) => {
  const css = readFileSync(join(dist, path), 'utf8');
  return `<style>${css}</style>`;
});

// Favicon → data URI; buang referensi eksternal yang akan 404 di halaman tunggal.
const fav = readFileSync(join(here, '..', 'web', 'public', 'favicon.svg'), 'utf8');
const favData = `data:image/svg+xml;base64,${Buffer.from(fav).toString('base64')}`;
html = html
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${favData}" type="image/svg+xml" />`)
  .replace(/<link rel="manifest"[^>]*>\s*/g, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '')
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
  .replace(/<meta property="og:image"[^>]*>\s*/g, '');

// Penanda demo di judul.
html = html.replace(/<title>[^<]*<\/title>/, '<title>Cuan Driver — Demo Interaktif</title>');

const out = join(dist, 'cuan-driver-demo.html');
writeFileSync(out, html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`✔ Demo satu-file: ${out} (${kb} KB)`);
for (const f of readdirSync(dist)) console.log('  -', f);
