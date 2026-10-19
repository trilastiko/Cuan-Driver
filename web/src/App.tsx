import { useEffect, useState } from 'react';
import { useStore } from './store';
import { ToastHost } from './ui';
import { Splash } from './screens/Splash';
import { Auth } from './screens/Auth';
import { Wizard } from './screens/Wizard';
import { Dashboard } from './screens/Dashboard';
import { AddEarning } from './screens/AddEarning';
import { History } from './screens/History';
import { Recap } from './screens/Recap';
import { Calculator } from './screens/Calculator';
import { Pro } from './screens/Pro';
import { SettingsScreen } from './screens/Settings';

// Router hash sederhana — tahan offline & tidak butuh konfigurasi server.
function currentRoute(): string {
  const h = location.hash.replace(/^#\/?/, '');
  if (h) return h;
  // dukung tautan langsung /kalkulator (SPA fallback menyajikan index.html)
  if (location.pathname.replace(/\/$/, '').endsWith('/kalkulator')) return 'kalkulator';
  return '';
}

export function navigate(route: string) {
  location.hash = `/${route}`;
}

const NAV = [
  { r: 'app', ic: '🏠', label: 'Beranda' },
  { r: 'riwayat', ic: '🗒️', label: 'Riwayat' },
  { r: 'fab', ic: '', label: '' },
  { r: 'rekap', ic: '📊', label: 'Rekap' },
  { r: 'pengaturan', ic: '⚙️', label: 'Akun' },
] as const;

export default function App() {
  const store = useStore();
  const [route, setRoute] = useState(currentRoute());

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const session = !!store.token;
  const base = route.split('?')[0];

  // penjaga rute
  let screen = base;
  if (!screen) screen = session ? (store.onboarded ? 'app' : 'wizard') : 'splash';
  const needSession = ['app', 'tambah', 'riwayat', 'rekap', 'pro', 'pengaturan', 'wizard'];
  if (needSession.includes(screen) && !session) screen = 'splash';

  const withNav = ['app', 'riwayat', 'rekap', 'pengaturan'].includes(screen);

  return (
    <div className="shell">
      {screen === 'splash' && <Splash navigate={navigate} />}
      {screen === 'masuk' && <Auth navigate={navigate} register={route.includes('daftar=1')} />}
      {screen === 'wizard' && <Wizard navigate={navigate} />}
      {screen === 'app' && <Dashboard navigate={navigate} />}
      {screen === 'tambah' && <AddEarning navigate={navigate} />}
      {screen === 'riwayat' && <History navigate={navigate} />}
      {screen === 'rekap' && <Recap navigate={navigate} />}
      {screen === 'kalkulator' && <Calculator navigate={navigate} session={session} />}
      {screen === 'pro' && <Pro navigate={navigate} />}
      {screen === 'pengaturan' && <SettingsScreen navigate={navigate} />}

      {withNav && (
        <nav className="bottom-nav" aria-label="Navigasi utama">
          {NAV.map((n) =>
            n.r === 'fab' ? (
              <button key="fab" className="fab" onClick={() => navigate('tambah')} aria-label="Tambah pendapatan">
                <span>＋</span>
              </button>
            ) : (
              <button
                key={n.r}
                className={screen === n.r ? 'on' : ''}
                onClick={() => navigate(n.r)}
              >
                <span className="nav-ic" aria-hidden="true">
                  {n.ic}
                </span>
                {n.label}
              </button>
            )
          )}
        </nav>
      )}
      <ToastHost />
    </div>
  );
}
