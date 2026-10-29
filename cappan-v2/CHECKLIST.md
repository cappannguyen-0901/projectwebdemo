# CHECKLIST.md — tiêu chuẩn nghiệm thu từng trang v2

Một trang "đạt" khi đủ 6 mục. Chạy `npm test` + `npm run lint` trước khi commit riêng từng trang.

- [ ] **ENTRY**: code nằm ở `src/entry-<page>.js`, HTML chỉ giữ skeleton + `<script type="module">`
- [ ] **ASYNC-ONLY**: mọi dữ liệu qua `await api.*`; KHÔNG `API.` sync legacy; KHÔNG chạm `localStorage`/`document` ngoài render
- [ ] **3 TRẠNG THÁI**: loading (initial), rỗng (empty-state giải thích được), lỗi (`ApiError` → hiện message, app không nổ trắng)
- [ ] **MUTATION AN TOÀN**: mọi action hủy/đặt/cập nhật xử lý lỗi ra toast/inline; sau mutation có re-render
- [ ] **IDENTITY**: trang phân biệt guest vs đăng nhập; action của người khác bị chặn ở facade (FORBIDDEN) và có mặt hiển thị tương ứng
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

## Kết luận đóng băng (Bước F — 2026-10-29)

- **v2 ĐẠT toàn bộ 6 tiêu chuẩn trên mọi trang** → đóng tag `v2-1.0-freeze`, v2 là bản chính; demo cũ chỉ tham chiếu.
- Cảnh báo bảo mật DEMO-GRADE vẫn treo ở README + DECISIONS cho tới khi backend thật ra đời.
- Nghiệm thu cuối: `npm test` 52/52 · lint 0 lỗi · `npm run build` 9 trang · smoke trình duyệt chéo tab + CSS split 2 sheet/trang.
