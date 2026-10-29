/* ============================================================
   CAPPAN v2 — HỢP ĐỒNG LỖI DUY NHẤT (docs/api-contract.md §2)
   Mọi tầng dưới (storage/api) dội lỗi lên UI qua 2 lớp này.
   UI bắt lỗi bằng `instanceof ApiError` + `e.code`.
   ============================================================ */

export const ERROR_CODES = [
  'VALIDATION', // 400 — input sai shape / thiếu field bắt buộc
  'NOT_FOUND', // 404 — mutator nhận id không tồn tại (getter trả null, không throw)
  'CONFLICT', // 409 — state hiện tại cấm thao tác (VD: hủy đơn đang giao)
  'FORBIDDEN', // 403 — giao thao tác trên tài nguyên của identity khác
  'UNAUTHORIZED', // 401 — cần đăng nhập (P2)
  'NOT_IMPLEMENTED', // 501 — chữ ký đã chốt, chưa đến pha build
  'STORAGE', // 500 — driver (quota, JSON hỏng…)
  'UNEXPECTED' // 500 — còn lại
];

const CODE_SET = new Set(ERROR_CODES);

export class ApiError extends Error {
  constructor(code, message, extra = undefined) {
    if (!CODE_SET.has(code)) throw new Error(`ApiError code không hợp lệ: ${code}`);
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.extra = extra;
  }
}

export class StorageError extends Error {
  constructor(message, cause = undefined) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}
