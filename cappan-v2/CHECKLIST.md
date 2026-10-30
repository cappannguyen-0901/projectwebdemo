# CHECKLIST.md — tiêu chuẩn nghiệm thu từng trang v2

Một trang "đạt" khi đủ 6 mục. Chạy `npm test` + `npm run lint` trước khi commit riêng từng trang.

- [ ] **ENTRY**: code nằm ở `src/entry-<page>.js`, HTML chỉ giữ skeleton + `<script type="module">`
- [ ] **ASYNC-ONLY**: mọi dữ liệu qua `await api.*`; KHÔNG `API.` sync legacy; KHÔNG chạm `localStorage`/`document` ngoài render
- [ ] **3 TRẠNG THÁI**: loading (initial), rỗng (empty-state giải thích được), lỗi (`ApiError` → hiện message, app không nổ trắng)
- [ ] **MUTATION AN TOÀN**: mọi action hủy/đặt/cập nhật xử lý lỗi ra toast/inline; sau mutation có re-render
- [ ] **IDENTITY**: trang phân biệt khách chưa đăng nhập với tài khoản; đặt chỗ yêu cầu đăng nhập; thao tác sai quyền bị chặn ở facade (`FORBIDDEN` hoặc `UNAUTHORIZED`) và có thông báo phù hợp
- [ ] **GLOBAL XANH**: `npm test` + `npm run lint` + `npm run build` pass

| Trang                       | Ngày kiểm  | Kết quả                                                                                                                                  |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| index (smoke)               | 2026-10-29 | ✅ 31→52 test, build                                                                                                                     |
| menu                        | 2026-10-29 | ✅ browser: login → thêm món → badge persist qua reload; tab 2 thấy cùng giỏ; qua CSS split (base+menu)                                  |
| cart                        | 2026-10-29 | ✅ browser: tổng 100.000đ đúng (45k+40k+15k); đặt đơn OK                                                                                 |
| auth                        | 2026-10-29 | ✅ browser: login demo 2 chiều, session `{userId}`                                                                                       |
| booking                     | 2026-10-29 | ✅ browser: đặt A1 19:00 hôm nay ghế khóa; quá sức chứa C5→8 người hiện câu chữ hợp đồng; cancel/complete trả ghế                        |
| order                       | 2026-10-29 | ✅ browser: M006 size L + topping → 169k đúng                                                                                            |
| profile                     | 2026-10-29 | ✅ browser: guard login, update whitelist, hủy đơn/đặt chỗ                                                                               |
| cart (promo, contract v1.2) | 2026-10-29 | ✅ browser: WELCOME10 chặn "đơn hàng đầu tiên" đúng luật · CAFE20 minOrder chặn 100k · đạt min → −20k, order.total=155.000 (facade tính) |
| staff (hub/KPI/shifts)      | 2026-10-29 | ✅ browser: login 0900000002 · KPI từ stats · advance đơn → "Đang pha" · toggle hết món · xếp ca Hôm nay ca sáng (S001)                  |
| chat (AI, bước D)           | 2026-10-29 | ✅ browser: wifi/gợi ý món qua rules (<1s) · injection chặn · khách hỏi doanh thu bị guard chặn · staff được qua LLM/fallback            |

## Nghiệm thu lộ trình v1.4

| Việc | Điều kiện nghiệm thu | Kết quả |
| --- | --- | --- |
| 1. Vá khách | Khách không tạo, trả cọc, hủy, check-in hoặc hoàn tất đặt chỗ; sơ đồ vẫn xem được; mã “đầu tiên” báo cần đăng nhập; giao diện ẩn form đặt bàn | ✅ Test facade và luồng giao diện đã cập nhật |
| 2. Chính sách quyền | Bảng quyền thuần theo hành động, vai trò và quan hệ sở hữu; facade dựng actor có kênh; test ma trận sinh từ chính bảng quyền | ✅ Ma trận đầy đủ trong `tests/policy.test.mjs` |
| 3. Sự kiện và nhật ký | Sự kiện sau khi lưu; lỗi listener/ghi nhật ký không chặn thao tác; từ chối được ghi; nhật ký giữ tối đa 500 dòng; staff/owner đọc được | ✅ Có kiểm thử sự kiện, quyền đọc, lỗi lưu và giới hạn |
| 4. Sổ năng lực đọc | Đủ bảy năng lực đọc; không dùng DOM; từng vai trò được kiểm tra; đầu vào sai trả `VALIDATION`; khách không đọc dữ liệu người khác | ✅ Có kiểm thử năng lực × vai trò và lọc dữ liệu; chưa nối vào chat |
| 5. Tài liệu và bản 1.4 | README có bản đồ pha; hợp đồng và quyết định đồng bộ; có dòng nghiệm thu cho từng việc; ba cổng xanh; tag `v2-1.4` | ✅ Tài liệu đồng bộ, ba cổng xanh; commit `b330522`, tag `v2-1.4` |

## Nghiệm thu Bước 4 — hợp đồng v1.5

| Việc | Điều kiện nghiệm thu | Kết quả |
| --- | --- | --- |
| 1. Ngày giờ tiếng Việt | Hiểu ngày tương đối, thứ trong tuần, ngày trong tháng và giờ có chỉ rõ buổi; trường hợp thiếu hoặc mơ hồ được hỏi lại; kiểm tra qua mốc ngày | ✅ Có kiểm tra với thời gian giả định trong `tests/datetime-vi.test.mjs` |
| 2. Bản nháp | Đặt bàn và đơn giao món hỏi đúng trường thiếu; sửa giờ, thêm món; tự hết hạn sau mười phút không hoạt động | ✅ Có kiểm tra trong `tests/draft.test.mjs` |
| 3. Xem trước hủy đặt chỗ | Không ghi dữ liệu; tiền hoàn và giai đoạn khớp quy tắc hủy trước nửa đêm, từ nửa đêm và khi trễ | ✅ Có kiểm tra trong `tests/booking-preview-cancel.test.mjs` |
| 4. Năng lực ghi | Đủ bốn thao tác; đầu vào qua lược đồ; thẻ chưa ghi dữ liệu; mã xác nhận gắn người dùng và dấu băm, hết hạn, dùng một lần; giới hạn năm lượt; nhật ký ghi đúng kênh | ✅ Có kiểm tra trong `tests/capabilities-write.test.mjs` |
| 5. Nối năng lực vào chat | Xử lý xác nhận trước luật; nhận ý định cục bộ trước mô hình; mô hình chỉ chọn năng lực hợp lệ; có thẻ xác nhận và thẻ đặt chỗ trễ; không mở thanh toán cọc trong chat | ✅ Đã nối qua `src/entry-chat.js`; proxy và tên mô hình lấy từ `src/config.js` |
| 6. Tài liệu và bản 1.5 | Hợp đồng, quyết định, README và checklist đồng bộ; ba cổng xanh; commit riêng; tag `v2-1.5` | ✅ Đã đồng bộ; cổng cuối xanh với 94 bài kiểm tra; gắn thẻ `v2-1.5` sau commit tài liệu |

## Kết luận đóng băng (Bước F — 2026-10-29)

- **v2 ĐẠT toàn bộ 6 tiêu chuẩn trên mọi trang** → đóng tag `v2-1.0-freeze`, v2 là bản chính; demo cũ chỉ tham chiếu.
- Cảnh báo bảo mật DEMO-GRADE vẫn treo ở README + DECISIONS cho tới khi backend thật ra đời.
- Nghiệm thu cuối: `npm test` 52/52 · lint 0 lỗi · `npm run build` 9 trang · smoke trình duyệt chéo tab + CSS split 2 sheet/trang.
