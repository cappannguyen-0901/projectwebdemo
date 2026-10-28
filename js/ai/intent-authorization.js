/* ============================================================
   INTENT AUTHORIZATION — Check role có quyền truy cập sub-intent
   Chỉ map STAFF-ONLY tools → nếu null → auto allow
   (customer-allowed tools không cần check, giảm false positive)
============================================================ */

const IntentAuthorization = {

  /**
   * Map subText → tool staff-only tương ứng (nếu có thể suy ra).
   * @returns {string|null} — null = không cần check quyền
   */
  _inferRequiredTool(subText) {
    const n = (typeof normVN === 'function') ? normVN(subText) : String(subText || '').toLowerCase();

    /* ─── STAFF-ONLY: Sensitive data reads ─── */
    if (/\b(doanh thu|doanh so|kpi|thong ke|loi nhuan|gia von|bao cao)\b/.test(n)) {
      return 'get_revenue_stats';
    }
    if (/\b(danh sach nhan vien|nhan vien quan|staff list|co ai lam)\b/.test(n)) {
      return 'get_staff_list';
    }
    if (/\b(lich ca|ca lam viec|phan ca|xep ca|ca sang|ca chieu|ca toi|ca cua (toi|minh))\b/.test(n)) {
      return 'get_shift_schedule';
    }
    if (/\b(cong thuc|nguyen lieu|pha che|recipe|cach pha|cach lam mon)\b/.test(n)) {
      return 'get_recipe';
    }
    if (/\b(tra cuu khach|thong tin khach|lich su khach|tim khach|ho so khach)\b/.test(n)) {
      return 'search_customer_history';
    }

    /* ─── STAFF-ONLY: Write tools ─── */
    if (/\b(danh dau (het|con) hang|mark (out|in) stock)\b/.test(n)) {
      return 'mark_out_of_stock';
    }
    if (/\b(reset (tat ca|toan bo) (cho|ban))\b/.test(n)) {
      return 'reset_all_seats';
    }
    if (/\b(reset (cho|ban))\b/.test(n)) {
      return 'reset_seats_by_floor';
    }
    if (/\b(huy don|huy order)\b/.test(n) && !/\b(cua (toi|minh))\b/.test(n)) {
      return 'cancel_order';
    }
    if (/\b(hoan thanh don|xong don)\b/.test(n)) {
      return 'complete_order';
    }
    /* ⚡ v6.1 — "hủy booking/đặt chỗ" chỉ là STAFF-ONLY khi rõ ràng là hủy hộ KHÁCH.
       Khách hủy chính mình (của tôi / mã BK… / "bàn tôi đang ở") → tự phục vụ, allow. */
    if (/\b(huy booking|huy dat (cho|ban)|huy ban)\b/.test(n)
      && /\b(khach|khach hang|don|so don)\b/.test(n)
      && !/\b(cua (toi|minh))\b/.test(n)
      && !/\bbk[a-z0-9]+\b/.test(n)
      && !/\btoi (dang|da|muon|huy|khong)\b/.test(n)) {
      return 'cancel_booking';
    }

    /* Không match staff-only → auto allow */
    return null;
  },

  /**
   * @param {string} subText — sub-intent cần check
   * @param {string} role — 'customer' | 'staff'
   * @returns {{ allowed: boolean, reason: string, requiredTool: string|null }}
   */
  check(subText, role) {
    const requiredTool = this._inferRequiredTool(subText);

    /* Không cần check → allow */
    if (!requiredTool) {
      return { allowed: true, reason: 'no_restriction', requiredTool: null };
    }

    /* Staff → luôn allow (staff có tất cả tools trong AI_TOOLS.staff) */
    if (role === 'staff') {
      return { allowed: true, reason: 'staff_full_access', requiredTool };
    }

    /* Customer → check tool có trong AI_TOOLS.customer không */
// ⚡ FIX #14: AI_TOOLS là MẢNG { name, roles, desc }, không phải object lồng
if (typeof AI_TOOLS === 'undefined' || !Array.isArray(AI_TOOLS)) {
  console.warn('[IntentAuthorization] AI_TOOLS chưa load — fail-safe block');
  return {
    allowed: false,
    reason: 'Dạ em chưa sẵn sàng xử lý phần này ạ. Anh/chị vui lòng thử lại sau.',
    requiredTool
  };
}

const tool = AI_TOOLS.find(t => t.name === requiredTool);
if (!tool) {
  // Tool không có trong danh sách → không cần chặn
  return { allowed: true, reason: 'unknown_tool', requiredTool };
}
if (Array.isArray(tool.roles) && tool.roles.includes(role)) {
  return { allowed: true, reason: 'role_has_tool', requiredTool };
}

    /* Block với message tự nhiên */
    return {
      allowed: false,
      reason: `Dạ em không có quyền cung cấp thông tin này ạ (${this._humanize(requiredTool)}). Anh/chị vui lòng liên hệ nhân viên.`,
      requiredTool
    };
  },

  _humanize(toolName) {
    const map = {
      get_revenue_stats: 'doanh thu / thống kê nội bộ',
      get_staff_list: 'danh sách nhân viên',
      get_shift_schedule: 'lịch ca làm việc',
      get_recipe: 'công thức pha chế',
      search_customer_history: 'thông tin khách hàng khác',
      mark_out_of_stock: 'thao tác đánh dấu hết hàng',
      mark_in_stock: 'thao tác đánh dấu còn hàng',
      reset_all_seats: 'thao tác reset toàn bộ chỗ',
      reset_seats_by_floor: 'thao tác reset chỗ',
      cancel_order: 'thao tác hủy đơn (không phải đơn của bạn)',
      complete_order: 'thao tác hoàn thành đơn',
      cancel_booking: 'thao tác hủy booking (không phải booking của bạn)'
    };
    return map[toolName] || toolName;
  }
};

window.IntentAuthorization = IntentAuthorization;