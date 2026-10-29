/* cart.html — Bước 1: giỏ + đặt đơn chạy trên facade.
   Mã khuyến mãi (promotions) còn ở pha sau — UI ẩn, tồn tại hợp đồng §3.8 P2. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');
const SHIP = api.utils.SHIPPING_FEE;

async function paint(msg = '') {
  const cart = await api.cart.get();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  renderHeader(document.getElementById('hdr'), { user, count });
  const subtotal = await api.cart.subtotal();

  main.innerHTML = `
    <h2>🧺 Giỏ hàng</h2>
    <div id="lines">${cart.length ? cart.map((l, i) => line(i, l)).join('') : '<p>Giỏ trống. Quay <a href="menu.html">menu</a> chọn món nhé!</p>'}</div>

    ${
      cart.length
        ? `
    <div class="panel">
      <div class="totals">
        <div class="row-t"><span>Tạm tính</span><span>${api.utils.formatVND(subtotal)}</span></div>
        <div class="row-t"><span>Phí giao</span><span>${api.utils.formatVND(SHIP)}</span></div>
        <div class="row-t strong"><span>Tổng</span><span>${api.utils.formatVND(subtotal + SHIP)}</span></div>
      </div>
      <button class="btn danger small" id="clear" style="margin-top:10px">Xóa giỏ</button>
    </div>

    <form class="panel" id="f">
      <h3>Thông tin giao hàng</h3>
      <label for="ad">Địa chỉ *</label>
      <input id="ad" required placeholder="Số nhà, đường, phường/xã, TP" value="${esc(user?.address || '')}" />
      <label for="ph">SĐT *</label>
      <input id="ph" required placeholder="VD 0901234567" value="${esc(user?.phone || '')}" />
      <label for="nt">Ghi chú</label>
      <input id="nt" placeholder="VD: ít đá, giao giờ trưa" />
      <div class="err" id="msg">${esc(msg)}</div>
      <p class="ok-note" style="margin:10px 0 0">🔒 Tổng tiền được TÍNH LẠI server-side từ menu — không tin giá client (contract §0.7)</p>
      <button class="btn" style="margin-top:10px">Đặt đơn — ${api.utils.formatVND(subtotal + SHIP)}</button>
    </form>`
        : ''
    }`;

  if (cart.length) {
    document.getElementById('clear').onclick = async () => {
      await api.cart.clear();
      paint();
    };
    document.querySelectorAll('[data-minus]').forEach((b) => b.addEventListener('click', () => adjust(Number(b.dataset.minus), -1)));
    document.querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', () => adjust(Number(b.dataset.plus), +1)));
    document.getElementById('f').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const order = await api.orders.create({
          items: cart.map((l) => ({ itemId: l.itemId, size: l.size, toppings: l.toppings.map((t) => t.name), qty: l.qty })),
          address: document.getElementById('ad').value,
          phone: document.getElementById('ph').value,
          note: document.getElementById('nt').value,
          customerName: user?.name
        });
        await api.cart.clear();
        await api.orders.setCurrent(order.id);
        main.innerHTML = `
          <div class="panel">
            <h2>🎉 Đặt đơn thành công — ${order.id}</h2>
            <p>Tổng: <strong>${api.utils.formatVND(order.total)}</strong> · Trạng thái: ${order.status}</p>
            <a class="btn ghost" href="menu.html">Quay menu</a>
          </div>`;
        renderHeader(document.getElementById('hdr'), 0);
      } catch (e) {
        paint(e.message || 'Không đặt được đơn');
      }
    };
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const line = (i, l) => `
  <div class="line" style="margin-bottom:8px">
    <img src="${esc(l.img)}" alt="" />
    <div class="meta">
      <div class="n">${esc(l.name)}</div>
      <div class="s">Size ${esc(l.size)} ${l.toppings.length ? '· ' + l.toppings.map((t) => esc(t.name)).join(' + ') : ''} — ${api.utils.formatVND(l.price)}</div>
    </div>
    <div class="qty">
      <button class="btn small ghost" data-minus="${i}">−</button>
      <strong>${l.qty}</strong>
      <button class="btn small ghost" data-plus="${i}">+</button>
    </div>
    <strong style="min-width:84px;text-align:right">${api.utils.formatVND(l.price * l.qty)}</strong>
  </div>`;

async function adjust(i, d) {
  const cart = await api.cart.get();
  cart[i].qty += d;
  if (cart[i].qty < 1) cart.splice(i, 1);
  try {
    await api.cart.set(cart); // facade TÍNH LẠI giá từ catalog cả dòng (§0.7)
  } catch (e) {
    toast(e.message, 'err');
  }
  paint();
}

paint().catch((e) => (main.innerHTML = `<div class="err">${e.name}: ${e.message}</div>`));
