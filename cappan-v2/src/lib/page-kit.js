/* ============================================================
   CAPPAN v2 — PAGE KIT (UI helpers chung)
   KHÔNG tự boot — entry truyền { api, user } vào. Pages chỉ import từ đây.
   ============================================================ */
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );

export function renderHeader(el, { user = null, count = 0 } = {}) {
  el.innerHTML = `
    <a class="brand" href="./">CAPPAN v2</a>
    <nav>
      ${user ? `<span class="who">👤 ${esc(user.name)}</span>` : `<a href="auth.html">Đăng nhập</a>`}
      <a href="cart.html" class="cart-badge">🧺 ${count}</a>
    </nav>`;
}
