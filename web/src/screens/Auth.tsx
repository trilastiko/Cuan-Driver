import { useState } from 'react';
import { AppBar, toast } from '../ui';
import { realApi, ApiError } from '../api';
import { setState } from '../store';
import { flushOutbox, pullFromServer } from '../sync';

export function Auth({ navigate, register }: { navigate: (r: string) => void; register: boolean }) {
  const [mode, setMode] = useState<'masuk' | 'daftar'>(register ? 'daftar' : 'masuk');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [refCode, setRefCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    setBusy(true);
    try {
      if (mode === 'daftar') {
        const r = await realApi.register({
          email,
          password,
          name,
          referral_code: refCode || undefined,
        });
        setState({ token: r.token, user: r.user, demo: false });
        navigate('wizard');
      } else {
        const r = await realApi.login({ email, password });
        setState({ token: r.token, user: r.user, demo: false, onboarded: true });
        await pullFromServer();
        void flushOutbox();
        toast(`Halo lagi, ${r.user.name || 'bang'}! 👋`);
        navigate('app');
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Terjadi kesalahan, coba lagi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen no-nav">
      <AppBar title={mode === 'daftar' ? 'Buat Akun' : 'Masuk'} onBack={() => navigate('splash')} />

      <div className="card">
        <div className="grid2 mb12">
          <button
            className={`btn small ${mode === 'masuk' ? '' : 'ghost'}`}
            style={{ width: '100%' }}
            onClick={() => setMode('masuk')}
          >
            Masuk
          </button>
          <button
            className={`btn small ${mode === 'daftar' ? '' : 'ghost'}`}
            style={{ width: '100%' }}
            onClick={() => setMode('daftar')}
          >
            Daftar
          </button>
        </div>

        {mode === 'daftar' && (
          <div className="field">
            <label>Nama panggilan</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bang Budi" />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
          />
        </div>
        {mode === 'daftar' && (
          <div className="field">
            <label>Kode referral (opsional)</label>
            <input
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              placeholder="Dapat dari teman? Bonus Pro 7 hari"
            />
          </div>
        )}

        {err && <div className="banner warn">⚠️ {err}</div>}

        <button className="btn" onClick={submit} disabled={busy || !email || password.length < 6}>
          {busy ? 'Sebentar…' : mode === 'daftar' ? 'Daftar Gratis' : 'Masuk'}
        </button>
      </div>

      <p className="tiny center">
        Data kamu milikmu. Kami tidak menjual data — fitur penawaran selalu opt-in.
      </p>
    </div>
  );
}
