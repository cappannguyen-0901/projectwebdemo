/* ============================================================
   DEMO DATA — nạp dữ liệu mẫu đẹp / reset sạch để trình diễn
   Mở bảng điều khiển: nút 🎬 (trang nhân viên) hoặc phím tắt Ctrl + Shift + D (mọi trang)
   Dữ liệu sinh theo công thức cố định → mỗi lần nạp đều giống nhau.
============================================================ */

const DemoData = {

  /* Khóa localStorage bị xóa khi reset (KHÔNG xóa phiên đăng nhập và cài đặt khung chat) */
  KEYS: [
    'cappan_users', 'cappan_bookings', 'cappan_orders', 'cappan_current_order', 'cappan_cart_guest',
    'cappan_menu_custom', 'cappan_menu_overrides', 'cappan_menu_removed', 'cappan_menu_state',
    'cappan_promotions', 'cappan_schedule', 'cappan_seats_state', 'cappan_staff_list',
    'cappan_ai_cache', 'cappan_ai_metrics'
  ],

  /* Bộ sinh số giả ngẫu nhiên cố định (mulberry32) */
  _rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  _pad: n => String(n).padStart(2, '0'),
  _ymd(d) { return `${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())}`; },

  /* ---------- RESET ---------- */
  reset() {
    this.KEYS.forEach(k => localStorage.removeItem(k));
    Object.keys(localStorage).forEach(k => { if (k.startsWith('cappan_cart_')) localStorage.removeItem(k); });
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith('cappan_history_') || k.startsWith('cappan_greeted_') || k === 'cappan_ai_cool') sessionStorage.removeItem(k);
    });

    API.users.seedDemo();
    if (API.menu._syncSeed) API.menu._syncSeed();
    API.seats.resetToDefault();

    const cur = API.users.getCurrent();
    if (cur && !API.users.getById(cur.id)) API.users.setCurrent(null);
  },

  /* ---------- NẠP DỮ LIỆU MẪU ---------- */
  seed() {
    const rnd = this._rng(20261017);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];

    /* Khách hàng */
    const people = [
      ['Nguyễn Minh Anh', '0900000011', '12 Quang Trung, Gò Vấp'],
      ['Trần Quốc Bảo',   '0900000012', '45 Phạm Văn Chiêu, Gò Vấp'],
      ['Lê Thu Hà',       '0900000013', '8 Nguyễn Oanh, Gò Vấp'],
      ['Phạm Gia Hân',    '0900000014', '231 Lê Đức Thọ, Gò Vấp'],
      ['Võ Hoàng Long',   '0900000015', '67 Dương Quảng Hàm, Gò Vấp']
    ];
    const users = people.map(([name, phone, address]) => {
      const exist = API.users.getByPhone(phone);
      if (exist) return exist;
      const u = API.users.create({ name, phone, password: '123', role: 'customer' });
      API.users.update(u.id, { address });
      return API.users.getById(u.id);
    });
    users.push(API.users.getByPhone('0900000001'));   // Khách Demo

    /* Món bán chạy hơn → tần suất cao hơn */
    const menu = API.menu.getAll().filter(m => m.inStock);
    const weight = m => ({ M001: 6, M101: 5, M006: 4, M002: 4, M102: 3, M201: 3, M403: 2 }[m.id] || 1);
    const bag = menu.flatMap(m => Array(weight(m)).fill(m));

    /* Đơn hàng 7 ngày gần nhất */
    const perDay = [6, 9, 7, 11, 8, 12, 6];            // cũ → hôm nay
    const now = new Date();
    const orders = [];
    let seq = 1001;
    perDay.forEach((count, idx) => {
      const daysAgo = 6 - idx;
      for (let i = 0; i < count; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - daysAgo);
        const hour = 7 + Math.floor(rnd() * 14);
        const minute = Math.floor(rnd() * 60);
        d.setHours(hour, minute, 0, 0);
        if (daysAgo === 0) {   // đơn hôm nay phải nằm trong quá khứ (nếu không sẽ không tính vào doanh thu)
          const sinceMidnight = now.getHours() * 60 + now.getMinutes();
          const span = Math.max(30, Math.min(780, sinceMidnight - 10));
          d.setTime(now.getTime() - (10 + Math.floor(rnd() * span)) * 60000);
        }

        const user = pick(users);
        const lines = {};
        const n = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const m = pick(bag);
          lines[m.id] = lines[m.id] || { itemId: m.id, name: m.name, price: m.price, img: m.img, size: 'M', toppings: [], qty: 0 };
          lines[m.id].qty += 1 + (rnd() > 0.7 ? 1 : 0);
        }
        const items = Object.values(lines);
        const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
        const shipping = 15000;

        let step = 4, status = 'completed';
        if (rnd() < 0.07) { status = 'cancelled'; step = 0; }

        orders.push({
          id: 'OD' + (seq++), userId: user.id, items, total: subtotal + shipping, subtotal, shipping,
          address: user.address || 'Công viên Gia Định, Gò Vấp', phone: user.phone, note: '',
          customerName: user.name, status, step, createdAt: d.toISOString()
        });
      }
    });

    /* 3 đơn mới nhất của hôm nay để đang xử lý ở các bước khác nhau */
    const todays = orders.filter(o => new Date(o.createdAt).toDateString() === now.toDateString() && o.status !== 'cancelled');
    todays.slice(-3).forEach((o, i) => {
      o.step = [0, 1, 2][i];
      o.status = ['pending', 'preparing', 'delivering'][i];
      o.createdAt = new Date(now.getTime() - (4 + i * 3) * 60000).toISOString();
    });
    orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));

    /* Booking: một số đang hoạt động (làm ghế sáng đỏ), một số đã xong/hủy */
    const today = API.utils.today();
    const plan = [
      ['A1', 'F1', 2, 1, 'Cửa sổ, ngắm phố'],
      ['A5', 'F1', 4, 2, ''],
      ['B2', 'F2', 2, 3, 'Cần ổ cắm, học thi'],
      ['B7', 'F2', 4, 4, 'Nhóm học tập'],
      ['C5', 'F3', 6, 0, 'Họp nhóm, cần máy chiếu'],
      ['D8', 'F4', 5, 5, 'Sinh nhật nhỏ']
    ];
    plan.forEach(([seatId, floorId, guests, ui, note], i) => {
      const t = new Date(now.getTime() + (20 + i * 25) * 60000);
      API.bookings.create({
        userId: users[ui].id, seatId, floorId, date: today,
        time: `${this._pad(t.getHours())}:${this._pad(t.getMinutes())}`, guests, note
      });
    });
    const past = API.bookings.getAll();
    [['A3', 'F1', 'completed', 1], ['B4', 'F2', 'completed', 2], ['C2', 'F3', 'cancelled', 3], ['D2', 'F4', 'completed', 4]].forEach(([seatId, floorId, status, ago], i) => {
      const d = new Date(now); d.setDate(d.getDate() - ago);
      past.push({
        id: 'BK' + (2001 + i), userId: users[i].id, seatId, floorId, date: this._ymd(d), time: `${this._pad(9 + i * 2)}:30`,
        guests: 2, note: '', status, createdAt: d.toISOString()
      });
    });
    localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(past));
    API.seats.syncFromBookings();

    /* Khuyến mãi còn hạn (mã mặc định đã hết hạn từ 2025) */
    const d0 = new Date(now); d0.setDate(d0.getDate() - 30);
    const d1 = new Date(now); d1.setDate(d1.getDate() + 90);
    const promos = [
      { code: 'WELCOME10', name: 'Chào khách mới', description: 'Giảm 10% cho đơn hàng đầu tiên', discount: '10%', minOrder: 0, maxDiscount: 30000, terms: 'Áp dụng cho đơn hàng đầu tiên của khách mới' },
      { code: 'FREESHIP',  name: 'Miễn phí giao hàng', description: 'Miễn phí ship cho đơn từ 100.000đ', discount: '15.000đ', minOrder: 100000, terms: 'Áp dụng cho đơn giao hàng trong bán kính 3km' },
      { code: 'CAFE20',    name: 'Giảm giá cà phê', description: 'Giảm 20.000đ cho đơn từ 100.000đ', discount: '20.000đ', minOrder: 100000, terms: 'Không áp dụng cùng lúc với mã khác' }
    ].map(p => ({ ...p, active: true, startDate: this._ymd(d0), endDate: this._ymd(d1) }));
    localStorage.setItem(API.promotions.KEY, JSON.stringify(promos));
    if (API.promotions._sync) API.promotions._sync(promos);

    /* Lịch ca tuần này */
    try {
      const staff = API.staff.getAll();
      const shifts = API.shifts.getAll();
      const monday = new Date(now);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) {
        const day = new Date(monday); day.setDate(day.getDate() + i);
        shifts.forEach((sh, si) => {
          for (let k = 0; k < 2; k++) {
            const s = staff[(i + si * 2 + k) % staff.length];
            if (s) API.shifts.addStaffToShift(this._ymd(day), sh.id, s.id);
          }
        });
      }
    } catch (e) { console.warn('[Demo] Không tạo được lịch ca:', e); }

    /* Một món hết hàng để có chuyện hỏi AI */
    try { API.menu.markOutOfStock('M104'); } catch (e) {}

    API.orders.setCurrent(null);
    return { orders: orders.length, bookings: past.length };
  },

  load()  { this.reset(); return this.seed(); },
  clear() { this.reset(); },

  /* ---------- GIAO DIỆN ---------- */
  _panel: null,

  _build() {
    if (this._panel) return this._panel;
    const p = document.createElement('div');
    p.className = 'demo-panel';
    p.innerHTML = `
      <div class="demo-panel-head">
        <strong>🎬 Chế độ trình diễn</strong>
        <button class="demo-x" aria-label="Đóng">✕</button>
      </div>
      <p class="demo-hint">Chuẩn bị dữ liệu trước khi demo. Thao tác sẽ tải lại trang.</p>
      <button class="demo-act primary" data-act="load">✨ Nạp dữ liệu mẫu đẹp</button>
      <button class="demo-act" data-act="clear">🧹 Xóa sạch (trạng thái trống)</button>
      <button class="demo-act" data-act="chat">🤖 Xóa cache AI &amp; lịch sử chat</button>
      <div class="demo-keys">Phím tắt: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></div>`;
    document.body.appendChild(p);

    p.querySelector('.demo-x').onclick = () => this.toggle(false);
    p.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'load') {
        if (!confirm('Nạp dữ liệu mẫu? Dữ liệu hiện tại (đơn, booking, giỏ hàng, số liệu AI) sẽ bị thay thế.')) return;
        const r = this.load();
        this._done(`✓ Đã nạp ${r.orders} đơn và ${r.bookings} booking mẫu`);
      } else if (act === 'clear') {
        if (!confirm('Xóa sạch toàn bộ dữ liệu? Tài khoản demo sẽ được tạo lại.')) return;
        this.clear();
        this._done('✓ Đã xóa sạch dữ liệu');
      } else if (act === 'chat') {
        try { localStorage.removeItem('cappan_ai_cache'); } catch (e) {}
        Object.keys(sessionStorage).forEach(k => {
          if (k.startsWith('cappan_history_') || k.startsWith('cappan_greeted_')) sessionStorage.removeItem(k);
        });
        this._done('✓ Đã xóa cache và lịch sử chat');
      }
    });
    this._panel = p;
    return p;
  },

      _done(msg) {
    if (typeof showToast === 'function') showToast(msg);
    setTimeout(() => {
      try {
        if (typeof refreshAll === 'function') {
          refreshAll(); // Dành cho trang Staff
        } else {
          location.reload(); // Dành cho trang Customer (ép tải lại)
        }
      } catch (e) {
        console.warn('[demo] refresh failed, fallback reload:', e);
        location.reload();
      }
    }, 300);
  },

  toggle(force) {
    const p = this._build();
    if (!p) return;
    const open = typeof force === 'boolean' ? force : !p.classList.contains('open');
    p.classList.toggle('open', open);
  },

  init() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); DemoData.toggle(); }
      if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) { e.preventDefault(); DemoData.toggle(); }
      if (e.key === 'Escape' && DemoData._panel) DemoData.toggle(false);
    });
    
    try {
      if (!sessionStorage.getItem('cappan_demo_banner_off')) {
        const bn = document.createElement('div');
        bn.className = 'demo-banner';
        bn.setAttribute('role', 'note');
        bn.innerHTML = '🎬 Bản demo — dữ liệu lưu ngay trên trình duyệt này, không gửi lên máy chủ. ' +
          '<a href="privacy.html">Chính sách bảo mật</a>' +
          '<button type="button" aria-label="Ẩn thông báo">✕</button>';
        bn.querySelector('button').onclick = () => { bn.remove(); try { sessionStorage.setItem('cappan_demo_banner_off', '1'); } catch (e) {} };
        document.body.appendChild(bn);
      }
    } catch (e) {}
    
    const isStaff = (document.body.dataset.page || '').startsWith('staff-');
    if (isStaff) {
      const fab = document.createElement('button');
      fab.className = 'demo-fab';
      fab.title = 'Chế độ trình diễn (Ctrl+Shift+D)';
      fab.innerHTML = '<span>🎬</span>';
      fab.onclick = () => DemoData.toggle();
      document.body.appendChild(fab);
    }
  }
};

window.DemoData = DemoData;
document.addEventListener('DOMContentLoaded', () => DemoData.init());
