import { LogoMark } from '../logo';
import { seedDemoData, setState } from '../store';
import { shiftDate, todayStr } from '../../../shared/dates';
import { IS_DEMO_BUILD } from '../api';

export function Splash({ navigate }: { navigate: (r: string) => void }) {
  function startDemo() {
    setState({
      demo: true,
      token: 'demo-token',
      user: {
        id: 'demo-user',
        email: 'demo@cuandriver.id',
        name: 'Driver Demo',
        is_pro: false,
        pro_expires_at: null,
        referral_code: 'DEMO26',
        free_scans_used: 0,
      },
      earnings: seedDemoData(todayStr(), shiftDate),
    });
    navigate('wizard');
  }

  return (
    <div className="splash">
      <LogoMark size={96} />
      <h1>Cuan Driver</h1>
      <div className="tag">Cek: tekor atau cuan?</div>
      <p className="sub">
        Hitung penghasilan <b>bersih</b> narikmu tiap hari — setelah bensin, makan, cicilan, dan
        kuota. Gabungkan Gojek, Grab, Maxim &amp; inDrive di satu layar.
      </p>
      <div className="actions">
        {IS_DEMO_BUILD ? (
          <button className="btn" onClick={startDemo}>
            Mulai (Mode Demo)
          </button>
        ) : (
          <>
            <button className="btn" onClick={() => navigate('masuk?daftar=1')}>
              Mulai — Gratis
            </button>
            <button className="btn ghost" onClick={() => navigate('masuk')}>
              Sudah punya akun? Masuk
            </button>
            <button className="btn ghost" onClick={startDemo}>
              Coba Mode Demo dulu
            </button>
          </>
        )}
        <button className="btn ghost" onClick={() => navigate('kalkulator')}>
          🧮 Kalkulator Tarif Baru (tanpa akun)
        </button>
      </div>
    </div>
  );
}
