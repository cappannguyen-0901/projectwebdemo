# DECISIONS.md — quyết định kiến trúc v2 (chỉ ghi quyết đã ĐẶT, kèm lý do + ngày)

| Ngày | Quyết | Lý do |
|---|---|---|
| 2026-10-29 |_contract-first_: sửa chữ ký API phải sửa `docs/api-contract.md` trước, code theo, test là dạng chạy được của hợp đồng | Tránh "code ms.true hòa doc" — legacy chết vì schema.js là file không ai đọc |
| 2026-10-29 | Tầng `pages → api → storage` 3 lớp; pages KHÔNG chạm storage | Anti-lock-in: swap backend chỉ đổi fulfil bên dưới chữ ký |
| 2026-10-29 | Mọi mutation tính lại giá từ catalog (§0.7) — không tin giá client | Chống spoof; khi backend ra đời dùng nguyên tắc này server-side |
| 2026-10-29 | Mật khẩu PBKDF2-SHA256 (client), session = `{userId}` | Thay plaintext + full-object session của legacy. Backend thật: argon2id server-side |
| 2026-10-29 | Đóng invite-code staff qua register (legacy là lỗ hổng còn in trên trang) | `role` không cấp qua form công khai |
| 2026-10-29 | Bỏ debug `syncFromBookings` → nội bộ `bookings._sweepPast` | 1 nguồn sự thật trạng thái ghế; quét quá hạn tự trả ghế |
| 2026-10-29 | Vá bug legacy cancel-order ở step≥2 (signoff #6) — `CANCEL_MAX_STEP=1` | Khách hủy được đơn đang giao trước đây |
| 2026-10-29 | CANCEL bug legacy: AI-cancel từng tồn tại vì authorization ở client — v2 giữ authorization client (demo) | Xem cảnh báo bên dưới |
| 2026-10-29 | Contract v1.2: `orders.create(promoCode)` — discount do facade evaluate khi tính lại giá; UI chỉ preview | Mã khuyến mãi = doanh nghiệp, client không được tự trừ tiền |
| 2026-10-29 | `ensureSeeded` tự bồi namespace v1.2 (promotions/staff/shifts/schedule) + demo migration role staff cho SĐT 0900000002, KHÔNG đụng user tự đăng ký | Storage v1.1 không bị phá khi demo cũ còn dữ liệu |
| 2026-10-29 | Đoanh thu stats CHỈ đếm step≥4 (giữ FIX legacy) | Tổng chờ/đang giao đừng được tính là tiền thu được |
| 2026-10-29 | `staff.addFromUser` vẫn NOT_IMPLEMENTED (P3-admin) — role không cấp tự do | Mirror quy tắc đóng invite-code legacy |
| 2026-10-29 | Bước D: AI tách `src/ai/rules.js` + `guards.js` THUẦN (không DOM, menu inject qua ctx) — rule 1 shape `{id, priority, test, reply}`; chat UI riêng với pipeline guard→rule→LLM→fallback cục bộ khi proxy lỗi | Legacy brain.js 900+ dòng trộn logic/DOM/không thể test — v2 10 test thuần |
| 2026-10-29 | LLM gọi qua proxy `cappan-proxy...` TUỲ CHỌN: fail/timeout 12s → fallback cục bộ, app không chết | "Không cứng phụ thuộc" vendor — đúng mục tiêu chống lock-in |
| 2026-10-29 | Bước E: CSS tách `base.css` + per-page (mỗi trang nạp đúng phần nó cần, xác nhận qua CSSOM: staff chỉ có base+staff) | Cắt dead-CSS, trước pages.css gánh toàn bộ |
| 2026-10-29 | `window.*` gỡ bỏ cho navigation (`location.assign`); CHỈ giữ `window.localStorage` trong core/storage.js — nó là driver browser định nghĩa sẵn, không phải biến toàn cục v2 | "Xóa mọi window.*" = không có state/compat layer toàn cục; navigation là API trình duyệt chứ không phải state |

## ⚠️ CẢNH BÁO BẢO MẬT (hiện trạng P2 — chưa production-safe)

> **Auth, phân quyền, kiểm tra giá và chỗ ngồi hiện chỉ ở client, chưa bảo mật. KHÔNG cho khách thật dùng.**

- Dữ liệu nằm ở localStorage của chính trình duyệt — ai mở DevTools sửa được hết (role, session, số dư, đơn).
- "Password hash" chạy trong browser = mọi buổi苟 đổi mã chỉ ảnh hưởng demo; backend thật phải argon2id + session server-side.
- Giá tính lại từ catalog cũng chỉ có nghĩa khi catalog sống trên server.
- Chỉ từng dùng demo/nội bộ. Ký hậu "cho khách thật" khi backend (PostgreSQL + API) đã sống và kiểm tra server-side.

## Mốc
- `v2-p2-done` — P1 + P2 (identity/auth/users/bookings/seats mutation, trang menu/cart/auth) xanh 31 test.
