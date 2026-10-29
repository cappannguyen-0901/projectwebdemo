/* menu.html — trang thật đầu tiên migrate sang v2 (Bước 1).
   KHÁC legacy: mọi call đều await; không chạm storage; lỗi bắt qua ApiError. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const hdr = document.getElementById('hdr');
let activeCat = 'all';

async function paint() {
  const [cats, items, cart] = await Promise.all([api.categories.getAll(), api.menu.getAll(), api.cart.get()]);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  renderHeader(hdr, { user, count });

  const tabs = document.getElementById('tabs');
  tabs.innerHTML = ['all', ...cats.map((c) => c.id)]
    .map((id) => {
      const c = cats.find((x) => x.id === id);
      return `<button data-cat="${id}" class="${activeCat === id ? 'active' : ''}">${id === 'all' ? 'Tất cả' : c.name}</button>`;
    })
    .join('');
  tabs.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      activeCat = b.dataset.cat;
      paint();
    })
  );

  const shown = activeCat === 'all' ? items : items.filter((m) => m.categoryId === activeCat);
  document.getElementById('grid').innerHTML = shown
    .map(
      (m) => `
    <div class="card">
      <img src="${m.img || ''}" alt="${m.name}" loading="lazy" />
      <div class="body">
        <div class="name">${m.name} ${m.badge ? `<span class="badge">${m.badge}</span>` : ''}</div>
        <div class="desc">${m.description || ''}</div>
        <div class="row">
          <span class="price">${api.utils.formatVND(m.price)}</span>
          ${
            m.inStock
              ? `<button class="btn small" data-add="${m.id}">+ Thêm</button>`
              : `<span class="badge badge-oos">Hết món</span>`
          }
        </div>
      </div>
    </div>`
    )
    .join('');

  document.querySelectorAll('[data-add]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await api.cart.add({ itemId: b.dataset.add, qty: 1 });
        toast('✓ Đã thêm vào giỏ');
        paint();
      } catch (e) {
        toast(e.message || 'Lỗi không rõ', 'err');
      }
    })
  );
}

paint().catch((e) => {
  document.getElementById('grid').innerHTML = `<div class="err">${e.name}: ${e.message}</div>`;
  console.error(e);
});
