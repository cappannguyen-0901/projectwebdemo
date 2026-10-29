# CAPPAN v2 — Nền móng Strangler (Vite MPA + Async API Adapter)

> ⚠️ **HIỆN TRẠNG: demo-grade. Auth, phân quyền, kiểm tra giá và chỗ ngồi hiện chỉ ở client, chưa bảo mật. KHÔNG cho khách thật dùng.**
> Chi tiết: `DECISIONS.md`. Mốc: tag `v2-p2-done`.

Bản "đập đi xây lại" chạy song song với demo cũ (`D:\Projectwebdemo` giữ nguyên làm mốc; sau CHECKLIST đạt hết, v2 là bản chính & kế cũ chỉ để tham chiếu).
Nguyên tắc nền móng nằm ở **`docs/api-contract.md`** — tài liệu binding, sửa chữ ký phải sửa doc trước code.

## Cây thư mục
```
cappan-v2/
├─ docs/api-contract.md     ← HỢP ĐỒNG §0–§7 (đọc đầu tiên)
├─ index.html               Vite MPA tự quét mọi *.html ở gốc (vite.config.mjs)
├─ src/
│  ├─ entry-*.js            entry mỗi trang — mỏng, chỉ nối page → api
│  ├─ core/errors.js        ApiError/StorageError — mô hình lỗi duy nhất
│  ├─ core/storage.js       Storage async + driver (browser/memory) + exportAll/importAll
│  ├─ api/index.js          API FACADE — thứ duy nhất pages được chạm
│  ├─ data/schema.js        enum/hằng số validate THẬT (khác legacy: file chết)
│  └─ data/seed.js          seed ES module (menu/floors/seats…)
└─ tests/                   node --test (zero-dep) = executable specification
```

## Quy tắc vàng (tóm tắt hợp đồng)
1. **Async tuyệt đối** — khi có backend, pages không đổi; chỉ hệ thống driver bên dưới đổi.
2. **Pages KHÔNG chạm storage** — mọi dữ liệu đi qua `src/api/index.js` (v edits không nữa).
3. **Giá tính lại từ catalog** ở mọi mutation — không tin giá client (chống spoof, sẵn sàng cho server-side pricing).
4. **Không nuốt lỗi** — QuotaExceededError dội lên là `StorageError`, không mất dữ liệu âm thầm như legacy.
5. Reader trả `null`, mutator throw `ApiError{code}` — 8 codes: VALIDATION/NOT_FOUND/CONFLICT/FORBIDDEN/UNAUTHORIZED/NOT_IMPLEMENTED/STORAGE/UNEXPECTED.

## Lệnh
```bash
npm run dev        # Vite dev server (MPA)
npm run build      # build toàn bộ trang, tự quét
npm test           # node:test — 19 case đúng hợp đồng
npm run lint       # eslint (flat config)
npm run format     # prettier
```

## Bản đồ pha (chi tiết trong hợp đồng §3)
- **P1 (xong):** menu/categories/floors/seats(read) + cart + orders + utils + exportAll/importAll (snapshot prep-backend).
- **P2 (xong v1.1):** identity sync (`lib/identity`) + `api.auth` (login/current/logout, PBKDF2-SHA256) +
  `users.*` (hash, không rò secret) + `bookings.*` (khóa ghế, conflict, sweep quá hạn) + `seats.book/release/resetAll`.
  Trang đã migrate: **menu.html · cart.html · auth.html** (tòa Async, không chạm storage).
- **P2 còn lại:** promotions + staff/shifts/stats (vẫn NOT_IMPLEMENTED) + trang profile.
- **P3:** catalog CRUD cho staff (menu.create/update/remove) + trang staff dashboard.
- **Sau P2:** dựng backend thật (Node + Postgres chuẩn mở, không SDK độc quyền) — hợp đồng §3 chính là bản thiết kế REST; `exportAll()` chính là script dump dữ liệu một lần.
