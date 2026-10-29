/* ============================================================
   CAPPAN v2 — SCHEMA (ES module, docs/api-contract.md §1)
   Khác legacy schema.js (file chết không ai đọc): các ENUM ở đây
   được api/index.js dùng để validate thật sự.
   ============================================================ */

export const ORDER_EXPRESS = {
  statusByStep: { 0: 'pending', 1: 'preparing', 2: 'delivering', 3: 'delivering', 4: 'completed' },
  steps: ['Chờ xử lý', 'Đang pha', 'Shipper lấy', 'Đang giao', 'Hoàn tất']
};

export const CANCEL_MAX_STEP = 1; // step ≥ 2 (cướp shipper lấy hàng) là không hủy được — vá bug legacy signoff #6

export const SHIPPING_FEE = 15000;

export const ID_PREFIX = { order: 'od', booking: 'bk' };

/* validate-only metadata: dùng khi mutate, không dùng khi render */
export const SEAT_ZONES = ['window', 'center', 'quiet', 'group'];
export const FLOOR_PURPOSES = ['lobby', 'study', 'group', 'outdoor'];
