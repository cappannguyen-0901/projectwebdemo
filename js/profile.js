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
            ${b.note ? `<div class="history-note">📝 ${b.note}</div>` : ''}
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
      const isDone = o.step >= 4;
      return `
        <div class="history-card">
          <div class="history-icon">📦</div>
          <div class="history-body">
            <div class="history-title">
              Đơn #${o.id}
              <span class="order-status ${isDone ? 'success' : 'pending'}">
                ${isDone ? 'Đã giao' : 'Đang xử lý'}
              </span>
            </div>
            <div class="history-meta"><span>📅 ${new Date(o.createdAt).toLocaleString('vi-VN')}</span></div>
            <div class="order-items">
              ${o.items.map(i => `<span class="order-item-tag">${i.name} × ${i.qty}</span>`).join('')}
            </div>
            ${o.address ? `<div class="history-note">📍 ${o.address}</div>` : ''}
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

    const orders = API.orders.getByUser(user.id).filter(o => o.step >= 4);
    const points = Math.floor(orders.reduce((s, o) => s + o.total, 0) / 10000);

    const vouchers = [
      { code: 'WELCOME10', desc: 'Giảm 10% đơn đầu tiên', minPoints: 0 },
      { code: 'FREESHIP',  desc: 'Miễn phí giao hàng',     minPoints: 5 },
      { code: 'CAFE20',    desc: 'Giảm 20k cho đơn từ 100k', minPoints: 10 }
    ];

    el.innerHTML = `
      <div class="voucher-header">
        <div class="points-box">
          <div class="points-value">${points}</div>
          <div class="points-label">Điểm tích lũy</div>
        </div>
        <p class="points-hint">💡 10.000đ chi tiêu = 1 điểm</p>
      </div>
      <div class="voucher-grid">
        ${vouchers.map(v => {
          const canUse = points >= v.minPoints;
          return `
            <div class="voucher-card ${canUse ? '' : 'disabled'}">
              <div class="voucher-code">${v.code}</div>
              <div class="voucher-desc">${v.desc}</div>
              <div class="voucher-points">${v.minPoints === 0 ? 'Miễn phí' : `Cần ${v.minPoints} điểm`}</div>
            </div>
          `;
        }).join('')}
      </div>
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

window.reorder = function(orderId) {
  const order = API.orders.getById(orderId);
  if (!order) return;
  if (!confirm(`Thêm lại ${order.items.length} món vào giỏ?`)) return;
  order.items.forEach(it => {
    API.cart.add({
      itemId: it.itemId,
      name: it.name,
      price: it.price,
      img: it.img,
      size: it.size || 'M',
      toppings: it.toppings || []
    });
    const cart = API.cart.get();
    const found = cart.find(c => c.itemId === it.itemId && c.size === (it.size || 'M'));
    if (found && it.qty > 1) found.qty = it.qty;
    API.cart.set(cart);
  });
  updateUserArea();
  showToast('✓ Đã thêm vào giỏ!');
  setTimeout(() => { window.location.href = 'cart.html'; }, 800);
};