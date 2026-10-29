/* cart.html — Bước C: giỏ + mã khuyến mãi + đặt đơn chạy trên facade (hợp đồng v1.2).
   Discount KHÔNG tự trừ bên UI — chỉ preview bằng promotions.evaluate, tổng thật do facade tính lại. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');
const SHIP = api.utils.SHIPPING_FEE;
let promoCode = ''; // nhớ mã giữa các lần re-render

async function paint(msg = '') {
  const cart = await api.cart.get();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  renderHeader(document.getElementById('hdr'), { user, count });
  const subtotal = await api.cart.subtotal();

  /* preview mã (PROMISE-style theo hợp đồng — lỗi hiện ra mặt, không throw) */
  let discount = 0;
  let promoErr = '';
  let promoOk = false;
  if (promoCode && cart.length) {
    const ev = await api.promotions.evaluate(promoCode, subtotal, SHIP, user?.id || null);
    if (ev.ok) {
      discount = ev.discount;
      promoOk = true;
    } else {
      promoErr = ev.error;
    }
  }
  const newTotal = subtotal + SHIP - discount;

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
        <form class="row-t promo-row" id="promo">
          <span>Mã khuyến mãi ${promoCode ? `<code>${esc(promoCode)}</code>` : ''}</span>
          <span style="display:flex;gap:6px;align-items:center">
            ${discount ? `<b style="color:var(--brand-2)">−${api.utils.formatVND(discount)}</b>` : ''}
            <input id="pc" placeholder="VD: WELCOME10" value="${esc(promoCode)}" style="width:130px" />
            <button class="btn small">${promoOk ? 'Đổi mã' : 'Áp dụng'}</button>
          </span>
        </form>
        <div class="row-t"><span>Khuyến mãi</span><b>${discount ? '−' + api.utils.formatVND(discount) : '—'}</b></div>
        <div class="row-t"><span>Phải trả</span><span>${api.utils.formatVND(newTotal)}</span></div>
        ${promoErr ? `<div class="err">${esc(promoErr)}</div>` : ''}
        <div class="row-t strong"><span>Tổng (gồm ship, trừ mã)</span><span>${api.utils.formatVND(newTotal)}</span></div>
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
      <p class="ok-note" style="margin:10px 0 0">🔒 Tổng tiền + giảm giá được TÍNH LẠI từ menu & mã — không tin giá client (contract §0.7, v1.2)</p>
      <button class="btn" style="margin-top:10px">Đặt đơn — ${api.utils.formatVND(newTotal)}</button>
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
    document.getElementById('promo').onsubmit = (ev) => {
      ev.preventDefault();
      const next = document.getElementById('pc').value.toUpperCase().trim();
      if (next !== promoCode) promoCode = next; // đổi mã → re-render preview
      paint();
    };
    document.getElementById('f').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const order = await api.orders.create({
          items: cart.map((l) => ({ itemId: l.itemId, size: l.size, toppings: l.toppings.map((t) => t.name), qty: l.qty })),
          address: document.getElementById('ad').value,
          phone: document.getElementById('ph').value,
          note: document.getElementById('nt').value,
          customerName: user?.name,
          promoCode: promoCode || undefined // facade tự evaluate — chính trị "không tin client"
        });
        await api.cart.clear();
        promoCode = '';
        await api.orders.setCurrent(order.id);
        main.innerHTML = `
          <div class="panel">
            <h2>🎉 Đặt đơn thành công — ${order.id}</h2>
            <p>Tổng: <strong>${api.utils.formatVND(order.total)}</strong>${order.discount ? ` (đã giảm ${api.utils.formatVND(order.discount)} bằng ${order.promoCode})` : ''} · Trạng thái: ${order.status}</p>
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
