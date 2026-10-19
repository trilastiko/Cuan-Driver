// Lapisan API. Mode normal memanggil Worker (/api/*); mode demo meniru
// seluruh API secara lokal (tanpa jaringan) supaya app bisa dicoba tanpa
// akun, tanpa server, tanpa API key.

import type { Earning, ParsedScan, Platform, Settings, User } from '../../shared/types';
import { mockScan } from '../../shared/mockscan';
import { DEMO_LICENSE_CODE, extendProUntil, normalizeLicense, tierDays } from '../../shared/license';
import { getState, setState } from './store';

declare const __DEMO__: boolean;

/** Build demo (artifact/preview) memaksa mode demo penuh. */
export const IS_DEMO_BUILD = typeof __DEMO__ !== 'undefined' && __DEMO__;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getState().token;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('Tidak ada koneksi internet', 0, 'offline');
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (json.error as string) || 'Terjadi kesalahan',
      res.status,
      json.code as string | undefined
    );
  }
  return json as T;
}

// ---------- API sungguhan ----------

export const realApi = {
  register(input: { email: string; password: string; name?: string; referral_code?: string }) {
    return call<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  login(input: { email: string; password: string }) {
    return call<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  profile() {
    return call<{ user: User; settings: Settings }>('/user/profile');
  },
  updateProfile(patch: { name?: string; settings?: Settings }) {
    return call<{ user: User; settings: Settings }>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },
  addEarning(e: Earning) {
    return call<{ earning: Earning }>('/earnings', { method: 'POST', body: JSON.stringify(e) });
  },
  deleteEarning(id: string) {
    return call<{ ok: boolean }>(`/earnings/${id}`, { method: 'DELETE' });
  },
  listEarnings(from: string, to: string) {
    return call<{ earnings: Earning[] }>(`/earnings?from=${from}&to=${to}&limit=1000`);
  },
  scan(imageBase64: string, mediaType: string, platform?: Platform) {
    return call<{
      parsed: ParsedScan;
      screenshot_key: string | null;
      scans_left: number | null;
      mock_mode?: boolean;
    }>('/scan-screenshot', {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64, media_type: mediaType, platform }),
    });
  },
  verifyLicense(code: string) {
    return call<{ ok: boolean; tier: string; user: User }>('/verify-license', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
};

// ---------- API demo (lokal penuh) ----------

const FREE_SCAN_LIMIT = 3;

function demoUser(): User {
  const u = getState().user;
  if (u) return u;
  return {
    id: 'demo-user',
    email: 'demo@cuandriver.id',
    name: 'Driver Demo',
    is_pro: false,
    pro_expires_at: null,
    referral_code: 'DEMO26',
    free_scans_used: 0,
  };
}

export const demoApi: typeof realApi = {
  async register() {
    return { token: 'demo-token', user: demoUser() };
  },
  async login() {
    return { token: 'demo-token', user: demoUser() };
  },
  async profile() {
    return { user: demoUser(), settings: getState().settings };
  },
  async updateProfile(patch) {
    const user = { ...demoUser(), ...(patch.name !== undefined ? { name: patch.name } : {}) };
    setState({ user });
    return { user, settings: patch.settings ?? getState().settings };
  },
  async addEarning(e) {
    return { earning: e };
  },
  async deleteEarning() {
    return { ok: true };
  },
  async listEarnings() {
    return { earnings: getState().earnings };
  },
  async scan(imageBase64, _mediaType, platform) {
    const u = demoUser();
    if (!u.is_pro && u.free_scans_used >= FREE_SCAN_LIMIT) {
      throw new ApiError(
        'Jatah scan gratis habis. Upgrade ke Pro untuk scan tanpa batas',
        402,
        'upgrade_required'
      );
    }
    await new Promise((r) => setTimeout(r, 900)); // rasa "AI mikir"
    const parsed = mockScan(imageBase64, platform);
    const user = u.is_pro ? u : { ...u, free_scans_used: u.free_scans_used + 1 };
    setState({ user });
    return {
      parsed,
      screenshot_key: null,
      scans_left: user.is_pro ? null : Math.max(0, FREE_SCAN_LIMIT - user.free_scans_used),
      mock_mode: true,
    };
  },
  async verifyLicense(codeInput) {
    const code = normalizeLicense(codeInput);
    if (code !== DEMO_LICENSE_CODE) {
      throw new ApiError(`Di mode demo, pakai kode ${DEMO_LICENSE_CODE}`, 404);
    }
    const u = demoUser();
    const user: User = {
      ...u,
      is_pro: true,
      pro_expires_at: extendProUntil(u.pro_expires_at, tierDays('demo')),
    };
    setState({ user });
    return { ok: true, tier: 'demo', user };
  },
};

export function api(): typeof realApi {
  return getState().demo || IS_DEMO_BUILD ? demoApi : realApi;
}
