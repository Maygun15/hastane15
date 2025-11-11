// src/lib/api.js — Vite uyumlu, sağlamlaştırılmış

/* ========= BASE ========= */
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3000')
  .replace(/\/+$/, ''); // sondaki /'ları sil

// Route prefix — backend kökte sunduğu için boş bırakıyoruz
const AUTH_PREFIX = ''; // <-- ÖNEMLİ: '/api/auth' değil

/* ========= TOKEN ========= */
export function getToken() {
  try { return localStorage.getItem('authToken') || ''; } catch { return ''; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem('authToken', token);
    else localStorage.removeItem('authToken');
  } catch {}
}

/* ========= FETCH HELPERS ========= */
async function safeJson(resp) {
  const text = await resp.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}
async function okOrThrow(resp) {
  const data = await safeJson(resp);
  if (!resp.ok) {
    if (resp.status === 401) setToken(''); // token bozuk/expired ise temizle
    const msg = (data && (data.message || data.error)) || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// basit timeout (opsiyonel)
function withTimeout(promise, ms = 20000) {
  let t;
  const timeout = new Promise((_res, rej) => {
    t = setTimeout(() => rej(new Error('İstek zaman aşımına uğradı')), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
}

// tek path için istek
function req(path, { method = 'GET', body, headers, timeoutMs } = {}) {
  const f = fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return withTimeout(f, timeoutMs).then(okOrThrow);
}

// dışarı da ver (bazı bileşenlerde kullanışlı)
export const http = {
  req,
  get: (p, opt) => req(p, { method: 'GET', ...(opt || {}) }),
  post: (p, body, opt) => req(p, { method: 'POST', body, ...(opt || {}) }),
};

/* ========= Çoklu path dene (fallback) ========= */
async function postTry(paths, body, opts = {}) {
  let lastErr;
  for (const p of paths) {
    try {
      return await req(p, { method: 'POST', body, ...opts });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Uygun uç bulunamadı');
}

/* ========= HEALTH ========= */
export const apiHealth = () => req('/health');

/* ========= AUTH ========= */
// Kayıt: name, tc, phone, email, password
export async function apiRegister({ email, phone, tc, name, password }) {
  const data = await req(`${AUTH_PREFIX}/register`, {
    method: 'POST',
    body: { email, phone, tc, name, password }
  });
  if (data?.token) setToken(data.token);
  return data;
}

// Giriş: identifier (e-posta / telefon / TCKN / ad) + password
export async function apiLogin({ identifier, password }) {
  const data = await req(`${AUTH_PREFIX}/login`, {
    method: 'POST',
    body: { identifier, password }
  });
  if (data?.token) setToken(data.token);
  return data;
}

// /me → backend doğrudan user döndürüyor (wrapper yok)
export const apiMe     = () => req(`${AUTH_PREFIX}/me`);
export const apiLogout = () => { setToken(''); return Promise.resolve({ ok: true }); };

/* ========= PASSWORD RESET ========= */
export const apiRequestReset  = (email) =>
  req(`${AUTH_PREFIX}/password/request-reset`, { method: 'POST', body: { email } });
export const apiResetPassword = (token, newPassword) =>
  req(`${AUTH_PREFIX}/password/reset`, { method: 'POST', body: { token, newPassword } });

/* ========= INVITES (iki farklı backend yolu için tolerans) ========= */
// Önce /api/... dener, yoksa köke düşer (veya tersi). AUTH_PREFIX boş olduğu için
// ikinci path doğrudan '/admin/accept-invite' vb. olacaktır.
export const apiAdminAcceptInvite = (code) =>
  postTry([`${AUTH_PREFIX}/admin/accept-invite`, '/api/admin/accept-invite'], { code });

export const apiStaffAcceptInvite = (code) =>
  postTry([`${AUTH_PREFIX}/staff/accept-invite`, '/api/staff/accept-invite'], { code });

/* ========= ADMIN (opsiyonel örnek) ========= */
export const apiSetUserServices = (userId, serviceIds) =>
  req(`${AUTH_PREFIX}/admin/users/${userId}/services`, { method: 'POST', body: { serviceIds } });

/* ========= AI (opsiyonel) ========= */
export const apiAiPing = () => req('/api/ai/ping');

/* ========= Convenience ========= */
export const API = {
  base: API_BASE,
  health: apiHealth,
  register: apiRegister,
  login: apiLogin,
  me: apiMe,
  logout: apiLogout,
  requestReset: apiRequestReset,
  resetPassword: apiResetPassword,
  adminAcceptInvite: apiAdminAcceptInvite,
  staffAcceptInvite: apiStaffAcceptInvite,
  setUserServices: apiSetUserServices,
  aiPing: apiAiPing,
  http,
};
