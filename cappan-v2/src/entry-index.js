/* CAPPAN v2 — smoke page: chứng minh pages chỉ chạm src/api, không biết storage tồn tại */
import { createApi } from './api/index.js';
import { createStorage } from './core/storage.js';
import { SEED } from './data/seed.js';

const api = createApi({ storage: createStorage('browser'), seed: SEED });
document.getElementById('app').dataset.state = 'loading';

async function render() {
  const [items, cats, cart, top] = await Promise.all([
    api.menu.getAll(),
    api.categories.getAll(),
    api.cart.get(),
    api.menu.getAvailable()
  ]);
  const app = document.getElementById('app');
  app.dataset.state = 'ready';
  app.innerHTML = `
    <p><strong>Nhóm:</strong> ${cats.map((c) => c.name).join(' · ')}</p>
    <p><strong>Món:</strong> ${items.length} · <strong>Bàn:</strong> ${(await api.seats.getAll()).length} ·
       <strong>Giỏ:</strong> ${cart.length} món — tổng ${api.utils.formatVND(await api.cart.subtotal())}</p>
    <p><button id="addTop">+ Thêm "${top[0]?.name}"</button>
       <button id="clearCart">Xóa giỏ</button>
       <button id="exportAll">exportAll()</button></p>
    <pre id="dump" style="background:#111;color:#9f9;padding:8px;max-height:260px;overflow:auto">…</pre>`;

  document.getElementById('addTop').onclick = async () => {
    await api.cart.add({ itemId: top[0].id, qty: 1 });
    render();
  };
  document.getElementById('clearCart').onclick = async () => {
    await api.cart.clear();
    render();
  };
  document.getElementById('exportAll').onclick = async () => {
    document.getElementById('dump').textContent = JSON.stringify(
      await api.exportAll(),
      null,
      2
    ).slice(0, 2000);
  };
}

render().catch((e) => {
  document.getElementById('app').innerHTML = `<p style="color:red">${e.name}: ${e.message}</p>`;
  console.error(e);
});
