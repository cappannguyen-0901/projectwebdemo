/* ============================================================
   CAPPAN v2 — HASH MẬT KHẨU (docs/api-contract.md §3.10)
   PBKDF2-SHA256 qua WebCrypto — chạy được cả browser lẫn Node (globalThis.crypto).
   Zero-dep. Khắc phục legacy: mật khẩu plaintext trong `cappan_users`.
   Khi backend ra đời: thay bằng argon2id server-side, chữ ký giữ nguyên.
   ============================================================ */
const ITERATIONS = 150000;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashPassword(password, saltB64 = undefined) {
  if (typeof password !== 'string' || password.length < 1)
    throw new Error('hashPassword: mật khẩu rỗng');
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256
  );
  return { salt: toB64(salt), hash: toB64(bits), iterations: ITERATIONS, algo: 'PBKDF2-SHA256' };
}

/* so sánh hằng thời gian (chống timing attack ở mức demo) */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, credential) {
  if (!credential?.salt || !credential?.hash) return false;
  const { hash } = await hashPassword(String(password), credential.salt);
  return constantTimeEqual(hash, String(credential.hash));
}
