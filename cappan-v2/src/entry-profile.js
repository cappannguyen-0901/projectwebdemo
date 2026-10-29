/* profile.html — Bước B: identity dùng chung (api.auth.currentUser + users.update whitelist).
   Đơn: chỉ hủy được khi step ≤ CANCEL_MAX_STEP — chặn bằng facade (CONFLICT), UI ẩn nút khi rõ ràng. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');
const state = document.getElementById('state');
if (!user) {
  location.assign('auth.html'); // guard login — demo-grade, backend sẽ thay bằng 401 server-side
}

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
const STATUS_LABEL = {
  pending: 'Chờ xử lý',
  preparing: 'Đang pha',
  delivering: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy'
};

async function paint(errMsg = '') {
  try {
    const [me, orders, bookings] = await Promise.all([
      api.users.getCurrent(),
      api.orders.getByUser(user.id),
      api.bookings.getByUser(user.id)
    ]);
    renderHeader(document.getElementById('hdr'), { user });
    const myOrders = orders.slice().reverse(); // mới nhất trước
    const myBookings = bookings.slice().reverse();

    main.innerHTML = `
      <h2>👤 Hồ sơ</h2>

      <form class="panel" id="pf">
        <label>Tên</label><input id="nm" value="${esc(me.name)}" required />
        <label>SĐT (tài khoản đăng nhập)</label><input id="ph" value="${esc(me.phone)}" readonly />
        <label>Địa chỉ giao hàng mặc định</label><input id="ad" value="${esc(me.address || '')}" />
        <label>Email</label><input id="em" type="email" value="${esc(me.email || '')}" />
        <label>Sinh nhật</label><input id="bd" type="date" value="${esc(me.birthday || '')}" />
        <div class="err" id="pmsg">${esc(errMsg)}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn">Lưu hồ sơ</button>
          <button type="button" class="btn danger" id="out">Đăng xuất</button>
        </div>
      </form>

      <div class="panel">
        <h3>☕ Đơn hàng của tôi (${myOrders.length})</h3>
        ${
          myOrders.length
            ? myOrders
                .map(
                  (o) => `
          <div class="hist-row">
            <div>
              <div><b>${esc(o.id)}</b> <span class="pill ${esc(o.status)}">${STATUS_LABEL[o.status] || esc(o.status)}</span></div>
              <div class="det">${esc(o.items.map((l) => `${l.name}×${l.qty}`).join(', '))} · ${api.utils.formatVND(o.total)}</div>
            </div>
            ${
              o.status === 'pending' || o.status === 'preparing'
                ? `<button class="btn danger small" data-ocancel="${esc(o.id)}">Hủy đơn</button>`
                : ''
            }
          </div>`
                )
                .join('')
            : '<p class="muted-empty">Chưa có đơn nào. <a href="order.html">Đặt ngay</a>!</p>'
        }
      </div>

      <div class="panel">
        <h3>🪑 Đặt chỗ của tôi (${myBookings.length})</h3>
        ${
          myBookings.length
            ? myBookings
                .map(
                  (b) => `
          <div class="hist-row">
            <div><b>${esc(b.seatId)}</b> · ${esc(b.date)} ${esc(b.time)} · ${b.guests} khách <span class="pill ${esc(b.status)}">${b.status === 'confirmed' ? 'Hiệu lực' : b.status === 'completed' ? 'Đã dùng' : 'Đã hủy'}</span></div>
            ${b.status === 'confirmed' ? `<button class="btn danger small" data-bcancel="${esc(b.id)}">Hủy</button>` : ''}
          </div>`
                )
                .join('')
            : '<p class="muted-empty">Chưa có đặt chỗ. <a href="booking.html">Đặt bàn</a>!</p>'
        }
      </div>`;
    state.remove();
    bind();
  } catch (e) {
    state.remove();
    main.innerHTML = `<div class="panel"><div class="err">Lỗi: ${esc(e.message)}</div></div>`;
  }
}

function bind() {
  document.getElementById('out').onclick = async () => {
    await api.auth.logout();
    toast('Đã đăng xuất');
    setTimeout(() => location.assign('auth.html'), 400);
  };
  document.getElementById('pf').onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      const updated = await api.users.update(user.id, {
        name: document.getElementById('nm').value.trim(),
        address: document.getElementById('ad').value.trim(),
        email: document.getElementById('em').value.trim(),
        birthday: document.getElementById('bd').value
      });
      user.name = updated.name; // identity var cập nhật — header vẽ lại
      toast('✓ Đã lưu hồ sơ');
      paint();
    } catch (e) {
      paint(e.message); // CONFLICT trùng SĐT nếu sau này cho sửa phone — hiển thị đúng hợp đồng
    }
  };
  main.querySelectorAll('[data-ocancel]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Hủy đơn này?')) return;
      try {
        await api.orders.cancel(b.dataset.ocancel); // guard step ≥ CANCEL_MAX_STEP → CONFLICT sẽ hiện toast
        toast('Đã hủy đơn');
        paint();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
  main.querySelectorAll('[data-bcancel]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Hủy đặt chỗ này?')) return;
      try {
        await api.bookings.cancel(b.dataset.bcancel);
        toast('Đã hủy đặt chỗ');
        paint();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
}

paint();
