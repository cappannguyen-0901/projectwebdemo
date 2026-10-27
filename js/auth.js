/* ============================================================
   AUTH — ĐĂNG NHẬP / ĐĂNG KÝ / PHÂN QUYỀN
   PATCH: Logout xóa sạch state in-memory (AIBrain.histories, LocalBrain.*)
============================================================ */

const Auth = {

  INVITE_CODE: 'CAPPANNGUYEN-STAFF',

  isLoggedIn() { return !!API.users.getCurrent(); },
  isStaff() {
    const u = API.users.getCurrent();
    return !!(u && u.role === 'staff');
  },
  isCustomer() {
    const u = API.users.getCurrent();
    return !!(u && u.role === 'customer');
  },

  login(phone, password) {
    if (!phone || !password) {
      return { ok: false, error: 'Vui lòng nhập đầy đủ thông tin' };
    }
    const user = API.users.getByPhone(phone.trim());
    if (!user) return { ok: false, error: 'Số điện thoại chưa đăng ký' };
    if (user.password !== password) return { ok: false, error: 'Mật khẩu không đúng' };

    API.users.setCurrent(user);
    try { API.cart.mergeGuestToUser(user.id); } catch (e) { console.warn(e); }
    return { ok: true, user };
  },

  register(data) {
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

    const user = API.users.create({
      name: data.name.trim(),
      phone: data.phone.trim(),
      password: data.password,
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

  /**
   * ⚡ FIX: Logout dọn SẠCH state:
   * - sessionStorage (history, greeted)
   * - sessionStorage (applied_promo, checkout_info)
   * - AIBrain.histories (in-memory)
   * - LocalBrain state (draft, ctx, emotion)
   * - UserMemory không xóa (giữ cho lần sau)
   */
  logout() {
    const user = API.users.getCurrent();
    API.users.setCurrent(null);

    if (user) {
      const sid = `${user.role}_${user.id}`;
      try {
        sessionStorage.removeItem('cappan_history_' + sid);
        sessionStorage.removeItem('cappan_greeted_' + sid);
        sessionStorage.removeItem('cappan_applied_promo');
        sessionStorage.removeItem('cappan_checkout_info');
        sessionStorage.removeItem('cappan_prefs');
        sessionStorage.removeItem('cappan_group_memory');
        sessionStorage.removeItem('cappan_pending_' + sid);
      } catch (e) {}

      try {
        if (typeof AIBrain !== 'undefined') {
          if (AIBrain.histories && AIBrain.histories[sid]) delete AIBrain.histories[sid];
          if (AIBrain._pending && AIBrain._pending[sid]) delete AIBrain._pending[sid];
        }
      } catch (e) {}

      try {
        if (typeof LocalBrain !== 'undefined') {
          if (typeof LocalBrain.reset === 'function') {
            LocalBrain.reset(); // ⚡ Dọn sạch toàn bộ (bao gồm lastEmotionSid, ctx, drafts)
          } else {
            LocalBrain.bookingDraft = null;
            LocalBrain.orderDraft = null;
            LocalBrain.ctx = null;
            LocalBrain.lastEmotion = null;
            LocalBrain.lastEmotionAt = 0;
            LocalBrain.lastEmotionSid = null;
          }
        }
      } catch (e) {}

      try { if (typeof Handover !== 'undefined') Handover.reset(); } catch (e) {}
      try { if (typeof EmotionalHandler !== 'undefined') EmotionalHandler.resetAll(); } catch (e) {}
    }
    return true;
  },

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