/* ============================================================
   CAPPAN v2 — BOOT (dùng chung cho mọi entry-*.js)
   Nối: facade ← identity(session) — pages chỉ import từ đây.
   BOOT: trả về { api, user } sau khi identity đã set.
   ============================================================ */
import { createApi } from '../api/index.js';
import { createStorage } from '../core/storage.js';
import { SEED } from '../data/seed.js';
import { getIdentity, setIdentity } from './identity.js';
export async function createAppApi() {
  const api = createApi({ storage: createStorage('browser'), seed: SEED, identity: getIdentity });
  const user = await api.auth.current();
  setIdentity(user ? user.id : null); // identity sync sẵn sàng trước mọi thao tác cart/orders
  return { api, user };
}

/* Toast nhỏ dùng chung các trang */
export function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => el.remove(), 2600);
}
