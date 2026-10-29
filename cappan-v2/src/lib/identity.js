/* ============================================================
   CAPPAN v2 — TẦNG IDENTITY (docs/api-contract.md §3.10)
   Bridge giữa session (nạp async lúc boot) và createApi( identity )
   vốn là hàm SYNC. Pages boot: `await createAppApi()` (lib/boot.js)
   → identity được set trước mọi thao tác cart/orders.
   Chỉ nên import qua lib/boot.js — pages KHÔNG đụng storage.
   ============================================================ */

let _userId = null;
const listeners = new Set();

export function setIdentity(userId) {
  const prev = _userId;
  _userId = userId || null;
  if (prev !== _userId) listeners.forEach((fn) => fn(_userId, prev));
}

export function getIdentity() {
  return _userId;
}

export function onIdentityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
