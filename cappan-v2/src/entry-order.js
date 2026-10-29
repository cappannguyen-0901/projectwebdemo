/* order.html — Bước B: đặt nhanh theo cấu hình món (size/topping/qty).
   LƯU Ý: giá do facade tính lại — client chỉ gửi "tên lựa chọn", không gửi giá. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');
const state = document.getElementById('state');
let activeCat = 'all';
let picked = null; // món đang chuẩn bị
let opts = { size: null, toppings: new Set(), qty: 1 };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function paint(errMsg = '') {
  try {
    const [cats, items, cart] = await Promise.all([api.categories.getAll(), api.menu.getAll(), api.cart.get()]);
    renderHeader(document.getElementById('hdr'), { user, count: cart.reduce((s, i) => s + i.qty, 0) });
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const total = await api.cart.subtotal();

    const shown = activeCat === 'all' ? items : items.filter((m) => m.categoryId === activeCat);
    main.innerHTML = `
      <h2>🧋 Đặt nhanh</h2>
      <div class="tabs">
        ${['all', ...cats.map((c) => c.id)]
          .map((id) => {
            const c = cats.find((x) => x.id === id);
            return `<button data-cat="${id}" class="${activeCat === id ? 'active' : ''}">${id === 'all' ? 'Tất cả' : esc(c.name)}</button>`;
          })
          .join('')}
      </div>

      ${
        picked
          ? `<form class="panel" id="cfg">
              <h3>🧾 ${esc(picked.name)} — <span class="price">${api.utils.formatVND(picked.price)}</span></h3>
              ${picked.sizes?.length ? `<label>Size</label><div class="opt-row" id="sizes">${picked.sizes.map((s, i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-size="${esc(s.name)}">Size ${esc(s.name)}${s.extraPrice ? ` (+${api.utils.formatVND(s.extraPrice)})` : ''}</button>`).join('')}</div>` : ''}
              ${picked.toppings?.length ? `<label>Topping (chọn nhiều)</label><div class="opt-row" id="tops">${picked.toppings.map((t) => `<button type="button" class="chip" data-top="${esc(t.name)}">${esc(t.name)} +${api.utils.formatVND(t.price)}</button>`).join('')}</div>` : ''}
              <label>Số lượng</label>
              <div class="qty" style="margin-bottom:6px">
                <button type="button" class="btn small ghost" id="q-del">−</button>
                <strong id="qv">${opts.qty}</strong>
                <button type="button" class="btn small ghost" id="q-add">+</button>
              </div>
              <div class="err" id="msg">${esc(errMsg)}</div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button class="btn">Thêm ${opts.qty > 1 ? `× ${opts.qty}` : ''} vào giỏ</button>
                <button type="button" class="btn ghost" id="cx">Bỏ</button>
              </div>
            </form>`
          : errMsg
            ? `<div class="panel"><div class="err">${esc(errMsg)}</div></div>`
            : ''
      }

      <div class="grid" id="grid">
        ${
          shown.length
            ? shown
                .map(
                  (m) => `
          <div class="card">
            <img src="${esc(m.img)}" alt="${esc(m.name)}" loading="lazy" />
            <div class="body">
              <div class="name">${esc(m.name)} ${m.badge ? `<span class="badge">${esc(m.badge)}</span>` : ''}</div>
              <div class="row">
                <span class="price">${api.utils.formatVND(m.price)}</span>
                ${
                  m.inStock
                    ? `<button class="btn small" data-pick="${m.id}">Chọn</button>`
                    : `<span class="badge badge-oos">Hết món</span>`
                }
              </div>
            </div>
          </div>`
                )
                .join('')
            : '<div class="panel">Nhóm này chưa có món. Thử nhóm khác nhé.</div>'
        }
      </div>

      ${
        count
          ? `<div class="mini-cart">
              <span>🧺 ${count} món — ${api.utils.formatVND(total)} (chưa ship)</span>
              <a class="btn small" href="cart.html">Giỏ & đặt đơn</a>
              <button class="btn small ghost" id="mc">Dọn</button>
            </div>`
          : ''
      }`;
    state.remove();
    bind();
  } catch (e) {
    state.remove();
    main.innerHTML = `<div class="panel"><div class="err">Lỗi khi tải trang: ${esc(e.message)}</div></div>`;
  }
}

function bind() {
  main.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      activeCat = b.dataset.cat;
      paint();
    })
  );
  main.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', async () => {
      picked = await api.menu.getById(b.dataset.pick);
      opts = { size: null, toppings: new Set(), qty: 1 };
      paint();
    })
  );
  const cx = document.getElementById('cx');
  if (cx) {
    cx.onclick = () => (picked = null, paint());
    main.querySelectorAll('[data-size]').forEach((c) =>
      c.addEventListener('click', () => {
        main.querySelectorAll('[data-size]').forEach((x) => x.classList.remove('on'));
        c.classList.add('on');
        opts.size = c.dataset.size;
      })
    );
    main.querySelectorAll('[data-top]').forEach((c) =>
      c.addEventListener('click', () => {
        const t = c.dataset.top;
        if (opts.toppings.has(t)) { opts.toppings.delete(t); c.classList.remove('on'); }
        else { opts.toppings.add(t); c.classList.add('on'); }
      })
    );
    document.getElementById('q-del').onclick = () => (opts.qty = Math.max(1, opts.qty - 1), document.getElementById('qv').textContent = opts.qty);
    document.getElementById('q-add').onclick = () => (opts.qty = Math.min(99, opts.qty + 1), document.getElementById('qv').textContent = opts.qty);
    document.getElementById('cfg').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        await api.cart.add({
          itemId: picked.id,
          size: opts.size || picked.sizes?.[0]?.name,
          toppings: [...opts.toppings],
          qty: opts.qty
        });
        toast(`✓ ${esc(picked.name)} × ${opts.qty} vào giỏ`);
        picked = null;
        opts = { size: null, toppings: new Set(), qty: 1 };
        paint();
      } catch (e) {
        paint(e.message);
      }
    };
  }
  const mc = document.getElementById('mc');
  if (mc) mc.onclick = async () => { await api.cart.clear(); paint(); };
}

paint();
