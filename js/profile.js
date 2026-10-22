/* ============================================================
   PROFILE — KHÁCH HÀNG (5 tab)
============================================================ */

const Profile = {

  init() {
    if (!document.getElementById('profileContent')) return;
    this.render();
  },

  render() {
    const user = API.users.getCurrent();
    const guest = document.getElementById('profileGuest');
    const content = document.getElementById('profileContent');
    if (!guest || !content) return;

    if (!user) {
      guest.hidden = false;
      content.hidden = true;
      return;
    }
    guest.hidden = true;
    content.hidden = false;

    this.renderHeader(user);
    this.renderForm(user);
    this.renderBookings(user);
    this.renderOrders(user);
    this.renderVouchers(user);
  },

  renderHeader(user) {
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const phone = document.getElementById('profilePhone');
    const joined = document.getElementById('profileJoined');

    if (avatar) avatar.textContent = (user.name || user.phone).charAt(0).toUpperCase();
    if (name) name.textContent = user.name || 'Khách';
    if (phone) phone.textContent = '📞 ' + (user.phone || '');
    if (joined) {
      joined.textContent = user.joinedAt
        ? '🗓️ Thành viên từ ' + new Date(user.joinedAt).toLocaleDateString('vi-VN')
        : '';
    }
  },

  renderForm(user) {
    const fields = {
      editName: user.name || '',
      editPhone: user.phone || '',
      editEmail: user.email || '',
      editBirthday: user.birthday || '',
      editAddress: user.address || ''
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  },

  /* ---------- TAB ĐẶT CHỖ ---------- */
  renderBookings(user) {
    const el = document.getElementById('bookingsList');
    if (!el) return;
    const bookings = API.bookings.getByUser(user.id).slice().reverse();

    if (bookings.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🪑</div>
          <p>Bạn chưa có lịch sử đặt chỗ nào.</p>
          <a href="booking.html" class="btn">Đặt chỗ ngay</a>
        </div>`;
      return;
    }

    el.innerHTML = '<div class="history-list">' + bookings.map(b => {
      const floor = API.floors.getById(b.floorId);
      const canCancel = b.status === 'confirmed';
      return `
        <div class="history-card">
          <div class="history-icon">🪑</div>
          <div class="history-body">
            <div class="history-title">Chỗ ${b.seatId} – ${floor ? floor.name : b.floorId}</div>
            <div class="history-meta">
              <span>📅 ${b.date}</span>
              <span>🕐 ${b.time}</span>
              <span>👥 ${b.guests || 2} người</span>
            </div>
            ${b.note ? `<div class="history-note">📝 ${esc(b.note)}</div>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            <div class="history-status ${b.status === 'cancelled' ? 'cancelled' : 'success'}">
              ${b.status === 'cancelled' ? 'Đã hủy' : (b.status === 'completed' ? 'Hoàn tất' : 'Đang hoạt động')}
            </div>
            ${canCancel ? `<button class="btn-outline" style="padding:4px 12px; font-size:0.78rem;"
              onclick="cancelBooking('${b.id}')">Hủy</button>` : ''}
          </div>
        </div>
      `;
    }).join('') + '</div>';
  },

  /* ---------- TAB ĐƠN HÀNG ---------- */
  renderOrders(user) {
    const el = document.getElementById('ordersList');
    if (!el) return;
    const orders = API.orders.getByUser(user.id).slice().reverse();

    if (orders.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>Bạn chưa có đơn hàng nào.</p>
          <a href="order.html" class="btn">Đặt nước ngay</a>
        </div>`;
      return;
    }

    el.innerHTML = '<div class="history-list">' + orders.map(o => {
      const isCancelled = o.status === 'cancelled';
      const isDone = !isCancelled && o.step >= 4;
      return `
        <div class="history-card">
          <div class="history-icon">📦</div>
          <div class="history-body">
            <div class="history-title">
              Đơn #${o.id}
              <span class="order-status ${isCancelled ? 'cancelled' : (isDone ? 'success' : 'pending')}">
                ${isCancelled ? 'Đã hủy' : (isDone ? 'Đã giao' : 'Đang xử lý')}
              </span>
            </div>
            <div class="history-meta"><span>📅 ${new Date(o.createdAt).toLocaleString('vi-VN')}</span></div>
            <div class="order-items">
              ${o.items.map(i => `<span class="order-item-tag">${esc(i.name)} × ${i.qty}</span>`).join('')}
            </div>
            ${o.address ? `<div class="history-note">📍 ${esc(o.address)}</div>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            <div class="history-total">
              <div class="total-label">Tổng</div>
              <div class="total-value">${API.utils.formatVND(o.total)}</div>
            </div>
            <button class="btn-outline" style="padding:4px 12px; font-size:0.78rem;"
              onclick="reorder('${o.id}')">Đặt lại</button>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  },

  /* ---------- TAB ƯU ĐÃI ---------- */
  renderVouchers(user) {
    const el = document.getElementById('vouchersList');
    if (!el) return;

    const orders = API.orders.getByUser(user.id).filter(o => o.step >= 4 && o.status !== 'cancelled');
    const points = Math.floor(orders.reduce((s, o) => s + o.total, 0) / 10000);

    // Khuyến mãi lấy từ dữ liệu staff thiết lập — chỉ hiện mã còn hiệu lực hôm nay
    // ⚡ P1-7: Chỉ hiện mã mà user CÓ THỂ DÙNG ĐƯỢC ngay (loại WELCOME10 nếu user đã có đơn)
const fmtDate = d => d.split('-').reverse().join('/');
const promos = API.promotions.getActive().filter(p => {
  const testAmount = Math.max(p.minOrder || 0, 1);
  const r = API.promotions.evaluate(p.code, testAmount, 15000, user.id);
  return r.ok;
});

    el.innerHTML = `
      <div class="voucher-header">
        <div class="points-box">
          <div class="points-value">${points}</div>
          <div class="points-label">Điểm tích lũy</div>
        </div>
        <p class="points-hint">💡 10.000đ chi tiêu = 1 điểm</p>
      </div>
      ${promos.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🎁</div>
          <p>Hiện chưa có khuyến mãi nào đang áp dụng.</p>
        </div>` : `
      <div class="voucher-grid">
        ${promos.map(p => `
          <div class="voucher-card">
            <div class="voucher-code">${esc(p.code)}</div>
            <div class="voucher-desc">${esc(p.description || p.name)}</div>
            <div class="voucher-points">
              ${p.minOrder ? 'Đơn từ ' + API.utils.formatVND(p.minOrder) : 'Không yêu cầu tối thiểu'}
              ${p.endDate ? ' · HSD ' + fmtDate(p.endDate) : ''}
            </div>
          </div>
        `).join('')}
      </div>`}
    `;
  },

  /* ---------- SAVE ---------- */
  save() {
    const user = API.users.getCurrent();
    if (!user) return;
    const patch = {
      name: document.getElementById('editName').value.trim() || user.name,
      email: document.getElementById('editEmail').value.trim(),
      birthday: document.getElementById('editBirthday').value,
      address: document.getElementById('editAddress').value.trim()
    };
    API.users.update(user.id, patch);
    if (typeof updateUserArea === 'function') updateUserArea();
    this.render();
    showToast('✓ Đã lưu thông tin!');
  },

  switchTab(tabId) {
    document.querySelectorAll('.profile-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tabId)
    );
    document.querySelectorAll('.profile-panel').forEach(p =>
      p.classList.toggle('active', p.id === 'panel-' + tabId)
    );
  }
};

document.addEventListener('DOMContentLoaded', () => Profile.init());

/* ---------- ACTIONS ---------- */
window.saveProfile = () => Profile.save();
window.switchProfileTab = (id) => Profile.switchTab(id);

window.cancelBooking = function(bookingId) {
  if (!confirm('Hủy đặt chỗ này?')) return;
  API.bookings.cancel(bookingId);
  showToast('✓ Đã hủy đặt chỗ');
  const user = API.users.getCurrent();
  Profile.renderBookings(user);
};

window.reorder = function (orderId) {
  const order = API.orders.getById(orderId);
  if (!order) return;
  if (!confirm(`Thêm lại ${order.items.length} món vào giỏ?`)) return;

  // ⚡ FIX H2: KHÔNG ghi đè qty — chỉ cần add, API.cart.add đã cộng dồn đúng.
  // Nếu item chưa có trong giỏ → add qty 1; nếu có → cộng thêm đúng qty đặt lại.
  order.items.forEach(it => {
    const addTimes = Math.max(1, Number(it.qty) || 1);
    for (let k = 0; k < addTimes; k++) {
      API.cart.add({
        itemId: it.itemId,
        name: it.name,
        price: it.price,
        img: it.img,
        size: it.size || 'M',
        toppings: it.toppings || []
      });
    }
  });

  updateUserArea();
  showToast(`✓ Đã thêm ${order.items.length} món vào giỏ!`);
  setTimeout(() => { window.location.href = 'cart.html'; }, 800);
};