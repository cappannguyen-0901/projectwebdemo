/* ============================================================
   AUTH — ĐĂNG NHẬP / ĐĂNG KÝ / PHÂN QUYỀN
   ⚠ DEMO: hash SHA-256 + salt phone chỉ để tránh plaintext,
     KHÔNG phải bảo mật thật (client-side, ai có DevTools đều xem được).
============================================================ */

const Auth = {

  INVITE_CODE: 'CAPPANNGUYEN-STAFF',
  DEMO_MODE: true,   // ⚡ đặt false khi có backend thật

  /* ---------- HASH PASSWORD (demo) ---------- */
  async hashPassword(phone, password) {
    try {
      const data = new TextEncoder().encode(`${phone}::${password}::cappan-salt-v1`);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback nếu trình duyệt cũ không có crypto.subtle
      console.warn('[Auth] crypto.subtle không khả dụng, dùng fallback đơn giản:', e);
      let h = 0;
      const s = `${phone}::${password}`;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return 'fb_' + Math.abs(h).toString(16);
    }
  },

  /* ---------- TRẠNG THÁI ---------- */
  isLoggedIn() { return !!API.users.getCurrent(); },
  isStaff() {
    const u = API.users.getCurrent();
    return !!(u && u.role === 'staff');
  },
  isCustomer() {
    const u = API.users.getCurrent();
    return !!(u && u.role === 'customer');
  },

  /* ---------- ĐĂNG NHẬP (async) ---------- */
  async login(phone, password) {
    if (!phone || !password) {
      return { ok: false, error: 'Vui lòng nhập đầy đủ thông tin' };
    }

    const user = API.users.getByPhone(phone.trim());
    if (!user) return { ok: false, error: 'Số điện thoại chưa đăng ký' };

    const hashed = await this.hashPassword(user.phone, password);
    const match = user.password === hashed || user.password === password; // legacy fallback

    if (!match) return { ok: false, error: 'Mật khẩu không đúng' };

    // Migration: nếu đang plaintext → hash lại
    if (user.password === password) {
      API.users.update(user.id, { password: hashed });
      const refreshed = API.users.getById(user.id);
      if (refreshed) Object.assign(user, refreshed);
    }

    API.users.setCurrent(user);
    try { API.cart.mergeGuestToUser(user.id); } catch (e) { console.warn(e); }
    return { ok: true, user };
  },

  /* ---------- ĐĂNG KÝ (async) ---------- */
  async register(data) {
    if (!data || !data.name || !data.phone || !data.password) {
      return { ok: false, error: 'Vui lòng điền đầy đủ thông tin' };
    }
    if (data.password.length < 3) {
      return { ok: false, error: 'Mật khẩu phải có ít nhất 3 ký tự' };
    }
    if (data.role === 'staff' && data.inviteCode !== this.INVITE_CODE) {
      return { ok: false, error: 'Mã mời nhân viên không đúng' };
    }
    if (API.users.getByPhone(data.phone)) {
      return { ok: false, error: 'Số điện thoại đã được đăng ký' };
    }

    const hashed = await this.hashPassword(data.phone.trim(), data.password);

    const user = API.users.create({
      name: data.name.trim(),
      phone: data.phone.trim(),
      password: hashed,
      role: data.role || 'customer'
    });

    API.users.setCurrent(user);

    if (user.role === 'staff') {
      const newStaff = API.staff.addFromUser(user);
      if (newStaff) console.log(`✅ Đã thêm NV: ${newStaff.id}`);
    }

    try { API.cart.mergeGuestToUser(user.id); } catch (e) { console.warn(e); }
    return { ok: true, user };
  },

  /* ---------- ĐĂNG XUẤT ---------- */
  logout() {
    const user = API.users.getCurrent();
    API.users.setCurrent(null);

    if (user) {
      const sid = `${user.role}_${user.id}`;
      try {
        sessionStorage.removeItem('cappan_history_' + sid);
        sessionStorage.removeItem('cappan_greeted_' + sid);
      } catch (e) {}
    }
    return true;
  },

  /* ---------- GUARD ---------- */
  requireLogin() {
    if (!this.isLoggedIn()) {
      if (typeof showToast === 'function') showToast('🔒 Vui lòng đăng nhập!', '#c62828');
      setTimeout(() => { window.location.href = 'login.html'; }, 800);
      return false;
    }
    return true;
  },

  requireStaff() {
    if (!this.isStaff()) {
      if (typeof showToast === 'function') showToast('⛔ Chỉ nhân viên mới vào được!', '#c62828');
      setTimeout(() => { window.location.href = 'login.html'; }, 800);
      return false;
    }
    return true;
  },

  requireCustomer() {
    if (this.isStaff()) {
      if (typeof showToast === 'function') showToast('⛔ Nhân viên không dùng chức năng này!', '#c62828');
      setTimeout(() => { window.location.href = 'staff-dashboard.html'; }, 800);
      return false;
    }
    return true;
  }
};