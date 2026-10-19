import { useEffect, useRef, useState } from 'react';
import { AppBar, toast } from '../ui';
import { api, ApiError, IS_DEMO_BUILD } from '../api';
import { setState, useStore } from '../store';
import { DEMO_LICENSE_CODE } from '../../../shared/license';
import qrcode from 'qrcode-generator';

// Alur pembayaran QRIS manual (tanpa potongan Play Store):
// bayar -> kirim bukti via WhatsApp -> admin kirim kode -> masukkan kode.
// Nomor WA admin dikonfigurasi di sini (ganti dengan nomormu saat launch).
const ADMIN_WA = '6281234567890';
const WA_TEXT = encodeURIComponent('Halo admin Cuan Driver, saya mau upgrade Pro. Bukti bayar terlampir.');
const WA_LINK = `https://wa.me/${ADMIN_WA}?text=${WA_TEXT}`;

const FEATURES = [
  ['🤖', 'Scan screenshot AI tanpa batas — 2 ketukan, angka keisi sendiri'],
  ['📱', 'Gabungkan semua aplikasi (Gojek + Grab + Maxim + inDrive)'],
  ['⚡', 'Sinyal BEP live — tahu kapan gas terus, kapan mending pulang'],
  ['📊', 'Kartu rekap mingguan buat dipamerin ke grup'],
  ['⬇️', 'Export data CSV — buat arsip atau pengajuan pinjaman'],
] as const;

export function Pro({ navigate }: { navigate: (r: string) => void }) {
  const store = useStore();
  const pro = !!store.user?.is_pro;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);
  const demoMode = store.demo || IS_DEMO_BUILD;

  useEffect(() => {
    // QR mengarah ke alur pembayaran WA (pengganti QRIS statis untuk MVP).
    if (!qrRef.current) return;
    const qr = qrcode(0, 'M');
    qr.addData(WA_LINK);
    qr.make();
    qrRef.current.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
    const svg = qrRef.current.querySelector('svg');
    if (svg) {
      svg.style.width = '160px';
      svg.style.height = '160px';
    }
  }, []);

  async function redeem() {
    setErr('');
    setBusy(true);
    try {
      const r = await api().verifyLicense(code);
      setState({ user: r.user });
      toast('🎉 Pro aktif! Semua fitur kebuka.');
      navigate('app');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Gagal memverifikasi kode');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-nav">
      <AppBar title="Cuan Driver Pro" onBack={() => navigate('app')} />

      {pro ? (
        <div className="banner ok">
          ✅ Pro aktif sampai{' '}
          {store.user?.pro_expires_at
            ? new Date(store.user.pro_expires_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '—'}
          . Makasih sudah dukung sesama pejuang aspal! 🙏
        </div>
      ) : (
        <p className="muted mb12">
          Semua fitur biar narikmu makin terarah — harga secangkir kopi sebulan.
        </p>
      )}

      <div className="card">
        {FEATURES.map(([ic, txt]) => (
          <div className="feat" key={txt}>
            <span className="ic">{ic}</span>
            <span>{txt}</span>
          </div>
        ))}
      </div>

      {!pro && (
        <>
          <div className="grid2 mb12">
            <div className="pricebox">
              <div className="p">Rp15.000</div>
              <div className="tiny">per bulan</div>
            </div>
            <div className="pricebox hot">
              <div className="p">Rp99.000</div>
              <div className="tiny">per tahun — hemat 45%</div>
            </div>
          </div>

          <div className="card center">
            <h2 className="mb8">Cara bayar (QRIS/transfer)</h2>
            <div ref={qrRef} aria-label="QR menuju WhatsApp admin" style={{ display: 'flex', justifyContent: 'center' }} />
            <ol style={{ textAlign: 'left', fontSize: 13.5, paddingLeft: 20, marginTop: 10 }} className="muted">
              <li>Scan QR di atas / chat admin via WhatsApp</li>
              <li>Bayar via QRIS / transfer sesuai paket</li>
              <li>Kirim bukti bayar — admin balas <b>kode Pro</b></li>
              <li>Masukkan kode di bawah. Beres! 💪</li>
            </ol>
            <a className="btn secondary" href={WA_LINK} target="_blank" rel="noreferrer">
              💬 Chat Admin via WhatsApp
            </a>
          </div>
        </>
      )}

      <div className="card">
        <h2 className="mb8">Masukkan kode Pro</h2>
        <div className="field">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CUAN-XXXX-XXXX"
            autoCapitalize="characters"
            style={{ textAlign: 'center', letterSpacing: '0.08em', fontWeight: 700 }}
          />
          {demoMode && (
            <div className="hint">
              Mode demo: pakai kode <b>{DEMO_LICENSE_CODE}</b>
            </div>
          )}
        </div>
        {err && <div className="banner warn">⚠️ {err}</div>}
        <button className="btn" onClick={redeem} disabled={busy || code.length < 8}>
          {busy ? 'Memeriksa…' : '🔓 Aktifkan Pro'}
        </button>
      </div>

      {store.user && (
        <div className="card">
          <h2 className="mb8">🎁 Ajak teman, sama-sama untung</h2>
          <p className="muted mb8">
            Teman daftar pakai kode kamu → <b>kalian berdua</b> dapat Pro gratis 7 hari.
          </p>
          <div className="row">
            <code
              style={{
                flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 800,
                background: 'var(--bg)', borderRadius: 10, padding: '10px 0', letterSpacing: '0.15em',
              }}
            >
              {store.user.referral_code}
            </code>
            <button
              className="btn small secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(store.user!.referral_code);
                  toast('Kode disalin ✔');
                } catch {
                  toast(`Kode: ${store.user!.referral_code}`);
                }
              }}
            >
              Salin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
