import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { getState } from './store';
import { startSyncLoop } from './sync';
import { IS_DEMO_BUILD } from './api';

createRoot(document.getElementById('root')!).render(<App />);

// Sinkronisasi offline-first (bukan untuk build demo).
if (!IS_DEMO_BUILD) {
  startSyncLoop();
}

// Service worker: app shell tetap bisa dibuka tanpa sinyal.
// Dilewati di build demo/artifact (origin sandbox tidak butuh SW).
if (!IS_DEMO_BUILD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] gagal daftar (diabaikan):', err);
    });
  });
}

// Prompt pasang PWA (Android Chrome) — tampil setelah user punya data.
let deferredPrompt: (Event & { prompt?: () => void }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as never;
  const s = getState();
  if (s.onboarded && s.earnings.length >= 1) {
    setTimeout(() => deferredPrompt?.prompt?.(), 1500);
  }
});
