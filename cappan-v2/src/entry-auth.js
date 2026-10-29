/* auth.html — Bước 3: phiên đăng nhập thật.
   Vá legacy: mật khẩu HASH (không plaintext), session = {userId} (không full object),
   register công khai chỉ tạo customer (invite-code staff là lỗ hổng đã đóng). */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';
import { setIdentity } from './lib/identity.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');

await api.users.seedDemo(); // tài khoản demo tạo đúng cơ chế hash chuẩn

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

if (user) {
  renderHeader(document.getElementById('hdr'));
  main.innerHTML = `
    <div class="panel">
      <h2>👤 ${esc(user.name)}</h2>
      <p>SĐT <strong>${esc(user.phone)}</strong> · vai trò ${esc(user.role)}</p>
      <a class="btn ghost" href="menu.html">Soi menu</a>
      <a class="btn ghost" href="cart.html">Giỏ hàng</a>
      <button class="btn danger" id="out">Đăng xuất</button>
    </div>`;
  document.getElementById('out').onclick = async () => {
    await api.auth.logout();
    setIdentity(null);
    toast('Đã đăng xuất');
    setTimeout(() => (window.location.href = 'auth.html'), 400);
  };
} else {
  let mode = 'login';
  const paint = (msg = '') => {
    renderHeader(document.getElementById('hdr'), { user: null });
    main.innerHTML = `
      <div class="tabs">
        <button id="t-login" class="${mode === 'login' ? 'active' : ''}">Đăng nhập</button>
        <button id="t-reg" class="${mode === 'register' ? 'active' : ''}">Đăng ký</button>
      </div>
      <form class="panel" id="f">
        ${mode === 'register' ? ` <label for="nm">Tên</label> <input id="nm" required placeholder="Nguyễn Văn A" />` : ''}
        <label for="ph">SĐT</label>
        <input id="ph" required placeholder="0901234567" />
        <label for="pw">Mật khẩu (≥ 6 ký tự)</label>
        <input id="pw" type="password" required minlength="6" />
        ${
          mode === 'register'
            ? ` <label for="ad">Địa chỉ (dụng cho giao hàng)</label> <input id="ad" placeholder="Số nhà, đường, phường/xã, TP" />`
            : ''
        }
        <div class="err" id="msg">${esc(msg)}</div>
        <button class="btn" id="go" style="margin-top:12px">${mode === 'login' ? 'Vào quán' : 'Tạo tài khoản'}</button>
      </form>
      <div class="panel">
        <b>Tài khoản demo:</b> 0900000001 hoặc 0900000002 — mật khẩu <code>cappan123</code>
      </div>`;
    document.getElementById('t-login').onclick = () => ((mode = 'login'), paint());
    document.getElementById('t-reg').onclick = () => ((mode = 'register'), paint());
    document.getElementById('f').onsubmit = async (ev) => {
      ev.preventDefault();
      const phone = document.getElementById('ph').value.trim();
      const password = document.getElementById('pw').value;
      try {
        let u;
        if (mode === 'login') u = await api.auth.login(phone, password);
        else {
          u = await api.users.create({
            name: document.getElementById('nm').value,
            phone,
            password,
            address: document.getElementById('ad')?.value || ''
          });
          u = await api.auth.login(phone, password); // đăng ký xong → tạo session luôn
        }
        setIdentity(u.id);
        toast(`Xin chào ${u.name}!`);
        setTimeout(() => (window.location.href = 'menu.html'), 350);
      } catch (e) {
        paint(e.message);
      }
    };
  };
  paint();
}
