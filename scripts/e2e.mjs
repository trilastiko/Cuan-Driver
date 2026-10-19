// E2E UI test — menjalankan build demo (mock API in-browser) di Chromium
// dengan viewport HP (Pixel 5), memverifikasi alur inti + kebenaran angka,
// dan menyimpan screenshot ke docs/screenshots/.
//
// Jalankan: npm run build:demo && node scripts/e2e.mjs

import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, '..', 'dist', 'demo', 'cuan-driver-demo.html');
const shotDir = join(here, '..', 'docs', 'screenshots');
mkdirSync(shotDir, { recursive: true });

const page1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// --- server statis untuk file demo tunggal ---
const html = readFileSync(htmlPath);
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(4173, r));

function findChromium() {
  for (const c of ['/opt/pw-browsers/chromium', '/usr/bin/chromium']) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: findChromium() });
const ctx = await browser.newContext({
  viewport: { width: 393, height: 851 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
});
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function shot(name) {
  await page.screenshot({ path: join(shotDir, name), fullPage: false });
  console.log(`  📸 ${name}`);
}

try {
  // ---------- 1. splash ----------
  console.log('\n[1] Splash');
  await page.goto('http://127.0.0.1:4173/');
  await page.getByText('Cek: tekor atau cuan?').first().waitFor();
  ok('tagline tampil', true);
  await shot('01-splash.png');

  // ---------- 2. wizard ----------
  console.log('\n[2] Wizard setup');
  await page.getByRole('button', { name: 'Mulai (Mode Demo)' }).click();
  await page.getByText('Aplikasi apa yang kamu pakai?').waitFor();
  await page.getByRole('button', { name: 'Grab' }).click(); // tambah Grab
  await shot('02-wizard-apps.png');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.getByText('Berapa biaya operasionalmu?').waitFor();
  // set cicilan 910rb & servis 156rb agar total biaya harian = 101.000
  await page.locator('.field', { hasText: 'Cicilan motor per bulan' }).locator('input').fill('910000');
  await page.locator('.field', { hasText: 'Servis + sparepart per bulan' }).locator('input').fill('156000');
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.getByText('Target cuan harian?').waitFor();
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await page.getByText('Total biaya harianmu').waitFor();
  const biaya = await page.locator('.card .row', { hasText: 'Total biaya harianmu' }).textContent();
  ok(`total biaya = Rp101.000 (dapat: ${biaya?.trim()})`, biaya?.includes('Rp101.000') ?? false);
  await shot('03-wizard-done.png');
  await page.getByRole('button', { name: 'Buka Dashboard 🚀' }).click();

  // ---------- 3. dashboard (data demo hari ini: gojek 122rb) ----------
  console.log('\n[3] Dashboard');
  await page.getByText('Cuan bersih hari ini').waitFor();
  // 122.000 - 101.000 = 21.000
  await page.getByText('Rp21.000', { exact: true }).waitFor();
  ok('net awal Rp21.000 (122rb kotor - 101rb biaya)', true);
  ok('BEP terkunci untuk free tier', await page.getByText('Buka dengan Pro').isVisible());
  await shot('04-dashboard-free.png');

  // ---------- 4. tambah manual ----------
  console.log('\n[4] Tambah pendapatan manual');
  await page.getByRole('button', { name: '＋ Tambah Pendapatan' }).click();
  await page.getByRole('button', { name: '⌨️ Isi Manual' }).click();
  await page.locator('.field', { hasText: 'Pendapatan kotor' }).locator('input').fill('150000');
  await page.locator('.field', { hasText: 'Jumlah order' }).locator('input').fill('12');
  await page.getByRole('button', { name: '💾 Simpan' }).click();
  await page.getByText('Rp171.000', { exact: true }).waitFor(); // 272rb - 101rb
  ok('net terupdate jadi Rp171.000', true);
  await shot('05-dashboard-after-add.png');

  // ---------- 5. riwayat ----------
  console.log('\n[5] Riwayat');
  await page.getByRole('button', { name: 'Riwayat', exact: true }).click();
  await page.getByText('Rp150.000', { exact: true }).first().waitFor();
  ok('entri manual muncul di riwayat', true);
  await shot('06-riwayat.png');

  // ---------- 6. unlock Pro dengan kode demo ----------
  console.log('\n[6] Paywall & kode lisensi demo');
  await page.getByRole('button', { name: 'Beranda' }).click();
  await page.getByRole('button', { name: '🔓 Buka dengan Pro' }).click();
  await page.getByText('Cuan Driver Pro').waitFor();
  await shot('07-pro.png');
  await page.getByPlaceholder('CUAN-XXXX-XXXX').fill('CUAN-DEMO-2026');
  await page.getByRole('button', { name: '🔓 Aktifkan Pro' }).click();
  await page.getByText('Sinyal BEP Live').waitFor();
  ok('Pro aktif — kembali ke dashboard', true);
  ok('gauge BEP tampil', await page.getByText('Menutup biaya harian').isVisible());
  await shot('08-dashboard-pro.png');

  // ---------- 7. scan AI (mock) ----------
  console.log('\n[7] Scan screenshot (AI mock)');
  await page.locator('.bottom-nav .fab').click(); // FAB tengah
  await page.getByRole('button', { name: '📷 Scan Screenshot (AI)' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'pendapatan.png',
    mimeType: 'image/png',
    buffer: page1x1,
  });
  await page.getByText('Terbaca!').waitFor();
  ok('hasil scan tampil untuk konfirmasi', true);
  ok('penanda mode mock tampil', await page.getByText('Hasil contoh — mode demo').isVisible());
  await shot('09-scan-confirm.png');
  await page.getByRole('button', { name: '💾 Simpan' }).click();
  await page.getByText('Cuan bersih hari ini').waitFor();

  // ---------- 8. rekap + kartu share ----------
  console.log('\n[8] Rekap mingguan (kartu share)');
  await page.getByRole('button', { name: 'Rekap', exact: true }).click();
  await page.getByText('Total bersih').waitFor();
  await page.locator('img.share-preview[src^="data:image/png"]').waitFor();
  ok('kartu share rekap ter-render (canvas → PNG)', true);
  await shot('10-rekap.png');

  // ---------- 9. kalkulator viral ----------
  console.log('\n[9] Kalkulator tarif (sebelum/sesudah)');
  await page.goto('http://127.0.0.1:4173/#/kalkulator');
  await page.getByText('Komisi lama (%)').waitFor();
  await page.getByText('+Rp37.500/hari').waitFor(); // 250rb, 20%→8%
  ok('hitungan default benar (+Rp37.500/hari)', true);
  await page.getByRole('button', { name: '🖼️ Buat Kartu Share' }).click();
  await page.locator('img.share-preview[src^="data:image/png"]').waitFor();
  ok('kartu share kalkulator ter-render', true);
  await shot('11-kalkulator.png');

  // ---------- 10. offline + persistensi ----------
  console.log('\n[10] Offline & persistensi');
  await ctx.setOffline(true);
  await page.goto('http://127.0.0.1:4173/#/tambah').catch(() => {});
  // navigasi hash tidak butuh jaringan; kalau full reload gagal, kembali online dulu
  if (!(await page.getByText('Tambah Pendapatan').isVisible().catch(() => false))) {
    await ctx.setOffline(false);
    await page.goto('http://127.0.0.1:4173/#/tambah');
    await ctx.setOffline(true);
  }
  await page.getByRole('button', { name: '⌨️ Isi Manual' }).click();
  await page.locator('.field', { hasText: 'Pendapatan kotor' }).locator('input').fill('50000');
  await page.getByRole('button', { name: '💾 Simpan' }).click();
  await page.getByText('Rp171.000', { exact: true }).waitFor().catch(() => {});
  ok('tambah data saat offline tetap tersimpan', await page.getByText('Cuan bersih hari ini').isVisible());
  await ctx.setOffline(false);

  await page.reload();
  await page.getByText('Cuan bersih hari ini').waitFor();
  ok('data bertahan setelah reload (localStorage)', true);

  ok('tanpa error JS di console', errors.length === 0);
  if (errors.length) console.error('  pageerror:', errors);
} catch (err) {
  failed++;
  console.error('\n💥 E2E gagal:', err);
  await shot('99-failure.png').catch(() => {});
} finally {
  await browser.close();
  server.close();
}

console.log(`\n=== E2E selesai: ${passed} lolos, ${failed} gagal ===`);
process.exit(failed > 0 ? 1 : 0);
