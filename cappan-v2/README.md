# CAPPAN v2 — Nền tảng chính thức (Vite MPA + Async API Adapter)

> ✅ **HIỆN TRẠNG: v2 là BẢN CHÍNH (đã hoàn tất bước 3 và khởi động bước 4).** Demo cũ (`js/...`, gốc) CHỈ CÒN giữ làm tham chiếu — không phát triển thêm trên nó.
>
> ⚠️ **Vẫn demo-grade: auth, phân quyền, kiểm tra giá và chỗ ngồi hiện chỉ ở client, chưa bảo mật. KHÔNG cho khách thật dùng.** Chi tiết: `DECISIONS.md`.
>
> Bước cuối chuẩn bị thật sự serve khách: dựng backend (Node + Postgres chuẩn mở) — hợp đồng `docs/api-contract.md` chính là bản thiết kế REST; facade đổi 1 lớp bên dưới, pages KHÔNG đổi.

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
2. **Pages KHÔNG chạm storage** — mọi dữ liệu đi qua `src/api/index.js`.
3. **Giá tính lại từ catalog** ở mọi mutation — không tin giá client (chống spoof, sẵn sàng cho server-side pricing).
4. **Không nuốt lỗi** — QuotaExceededError dội lên là `StorageError`, không mất dữ liệu âm thầm như legacy.
5. Reader trả `null`, mutator throw `ApiError{code}` — 8 codes: VALIDATION/NOT_FOUND/CONFLICT/FORBIDDEN/UNAUTHORIZED/NOT_IMPLEMENTED/STORAGE/UNEXPECTED.

## Lệnh

```bash
npm run dev        # Vite dev server (MPA)
npm run build      # build toàn bộ trang, tự quét
  npm test           # node:test — đặc tả hợp đồng có thể chạy, không thêm thư viện kiểm thử
npm run lint       # eslint (flat config)
npm run format     # prettier
```

## Bản đồ pha (chi tiết trong hợp đồng §3)

- **P1:** menu/categories/floors/seats(read) + cart + orders + utils + exportAll/importAll (snapshot prep-backend) ✅
- **P2 (contract v1.1):** identity + `api.auth` (PBKDF2-SHA256) + `users.*` + `bookings.*` (khóa ghế, conflict, sweep) + `seats.book/release/resetAll` ✅
- **P3 (contract v1.2):** `promotions.*` (đánh giá mã giữ nguyên chất luật legacy WELCOME10/FREESHIP/CAFE20) + `orders.create(promoCode)` tự trừ discount khi tính lại giá + `staff.*` + `shifts.*` (schedule, CONFLICT 2 ca/ngày) + `stats.*` (doanh thu chỉ step≥4) ✅
- **Bước D:** AI thuần `src/ai/rules.js` + `guards.js` (10 test) + `chat.html` riêng, fallback cục bộ khi proxy lỗi ✅
- **Bước E:** CSS tách base + per-page (2 sheet/trang), không còn `window.*` biến toàn cục ✅
- **Bước 1 (đã xong):** vá các lỗi nặng, kiểm tra khách, đặt chỗ và mã ưu đãi đầu tiên; đồng bộ doanh thu theo ngày hoàn tất ✅
- **Bước 2 (đã xong):** luật đặt chỗ v1.3, đặt bàn có cọc, giữ chỗ theo ngày, thẻ trễ và tự giải phóng bàn ✅
- **Bước 3 (đã xong):** bảng quyền tập trung cho khách, khách hàng, nhân viên và chủ quán; sự kiện nghiệp vụ và nhật ký kiểm toán ✅
- **Bước 4 (đang khởi động):** sổ bảy năng lực chỉ đọc, kiểm tra vai trò và đầu vào, lọc dữ liệu theo chủ sở hữu. Chưa nối vào chat và chưa có năng lực ghi.
- **Bước 5:** nối năng lực vào chat, bổ sung thao tác ghi có xác nhận, thống kê và bảng điều khiển chủ quán.
- **Bước 6:** backend Node + PostgreSQL, xác thực phía máy chủ, tác vụ nền và thanh toán thật; `exportAll()` làm nguồn chuyển dữ liệu.

## Trang đã migrate (tất cả qua CHECKLIST.md ✅)

index · auth · menu · cart (+mã khuyến mãi) · order (size/topping/qty) · booking (đặt bàn) · profile · staff (hub: KPI/đơn/đặt chỗ/hết món/lịch ca) · chat (AI)

## Trạng thái quyền và trợ lý

- Khách chưa đăng nhập xem được sơ đồ chỗ và đặt nước; các thao tác đặt chỗ yêu cầu đăng nhập.
- Mã có điều kiện đơn đầu tiên yêu cầu tài khoản. Nhân viên và chủ quán thao tác hộ theo cùng chính sách; chỉ hai vai trò này xem thống kê tổng và nhật ký.
- Vai trò chủ quán đã có trong bảng quyền nhưng chưa có tài khoản được tạo.
- Sổ năng lực chỉ đọc chưa được gọi từ `chat.html`; đây là nền cho bước tiếp theo, chưa phải trợ lý có thể thao tác dữ liệu.
