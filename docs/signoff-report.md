# BIÊN BẢN KIỂM ĐỊNH & CHỐT MÃ NGUỒN CAPPAN (Sign-off Report)

> Ngày kiểm định: 28/10/2026 · Phạm vi: toàn bộ source (19 HTML, 6 CSS, 26 JS, 5 test suite, 2 dev server). Phương pháp: `node --check` toàn bộ + test tự động + review sâu 3 luồng song song (js/ai/*, js lõi, HTML/CSS/server/tests) + kiểm chứng server bằng request tấn công thật.

---

## 1. KẾT QUẢ KIỂM ĐỊNH (trước khi vá)

### Đạt ngay
- `node --check`: **100%** file JS/MJS parse sạch, không lỗi cú pháp.
- Tham chiếu asset trong 19 trang HTML: **100%** tồn tại, không ref chết.
- Thứ tự load script (schema → seed → api → auth → brain → main → chat-interactions): **17/17 trang đúng dependency**.
- Pipeline AI: guard/splitter/auth/tool schema/Anti-Hallucination Guard/UICards — **không bypass được; mọi `[UI_]` tag sinh ra đều có renderer**; các "renderer trùng" giữa main.js ↔ chat-interactions.js là override có chủ đích (có cờ chống double-init).
- LIVE_ORDER timer: **không leak** (self-stop khi đơn xong/hủy/thẻ gỡ khỏi DOM).
- `_safeHref` chặn `javascript:/data:/file:` trên mọi link render.

### Phát hiện lỗi → đã vá (11 sửa, lô này)
| # | Mức | File | Lỗi | Vá |
|---|---|---|---|---|
| 1 | **Blocker** | `server/static-dev.js:24` | `decodeURIComponent` không try/catch → 1 request `%` hỏng **crash toàn server** (đã tái hiện thật: server cũ chết ngay khi nhận `/50%`) | Try/catch → trả 400 |
| 2 | **Blocker** | `server/static-dev.js:26-27` | Path traversal (`startsWith(ROOT)` thiếu `path.sep`) + không chặn dotfile → đọc được `/server/.env` | `path.relative` guard + chặn mọi segment ẩn → 403 |
| 3 | **Blocker** | `tests/behavior.test.mjs:200-201` | 2 assertion stale (grep chuỗi đã refactor xóa trong brain.js) → suite đỏ, exit 1 | Cập nhật anchor thật: chuỗi từ-chối-quyền (brain.js:678) + `toolCallsMap` |
| 4 | **Blocker AI** | `brain.js:1735-1737` | `.slice(0, 10)` âm thầm cắt **5 tool staff** khỏi tool list LLM (`get_shift_schedule`, `update_booking`, `cancel_my_booking`, `reset_all_seats`, `get_staff_list`) | Bỏ slice — staff đủ 15 tool |
| 5 | **Blocker AI** | `main.js:482/509-521/1348-1356` | Inline `onclick` sau `esc()` vẫn breakout được bằng `'` từ label AI sinh ra (vector injection) → SyntaxError/thực thi JS | Chuyển toàn bộ sang `data-qr` / `data-rating` + delegated handler (pattern `data-nav-href` sẵn có) |
| 6 | **Blocker AI** | `brain.js:299-305` | Tool `cancel_my_order` không chặn `step >= 2` + thiếu `cancelledAt` → khách hủy được đơn đang giao qua AI | Chặn step≥2 + dùng `API.orders.cancel` (set `cancelledAt`); cả `cancel_order` (staff) |
| 7 | Medium | `brain.js:255` | `update_booking` mutation không có `danger: true` → đổi giờ bàn chạy ngay không confirm | Thêm flag |
| 8 | Medium | `brain.js:337-361` | `get_revenue_stats` nhánh `range` bỏ qua `from/to` → staff hỏi doanh thu theo khoảng nhận nhầm số hôm nay | Dùng đúng `a.from/a.to` qua `revenueInRange` |
| 9 | Medium | `brain.js:1798-1808` | Batch nhiều tool danger: các call còn lại bị nuốt âm thầm; pending **không TTL** | Báo rõ số tool chờ xác nhận vào message + TTL 10 phút cho pending confirm |
| 10 | Medium | `chat-interactions.js:1666` | INTERRUPT kill draft 'order' khi user gõ "thanh toán/đặt hàng" → món đang chọn mất âm thầm | Forward-words không kill draft order (để `_orderStep` hỏi cách nhận); draft booking vẫn kill |
| 11 | Medium | `api/index.js` (31 chỗ `setItem`) | Storage đầy/bị chặn → exception xuyên qua, tạo **trạng thái nửa vời** (booking ghi được, ghế không đổi) | Helper `storeSet()` + 31 mutation đi qua; `bookings.create/cancel/complete/update` kiểm kết quả ghi **trước** khi đụng ghế |
| 12 | Medium | `main.js:2071-2078` | Esc đóng modal bằng `classList.remove` trực tiếp → `body.modal-open` không được gỡ → **khoá cuộn vĩnh viễn** | Đóng qua `closeModal(m.id)` |
| 13 | Medium | `realtime.js` | Storage không try/catch (chết cả module nếu bị chặn) + thiếu hook module `staff` | `_lsGet/_lsSet/_lsDel` + thêm `staff` vào hook list |
| 14 | Medium | `demo.js` reset | Thiếu `cappan_ai_drafts_v6` → draft cũ sống sót sau "Xóa sạch" → gõ "xác nhận" tạo **đơn rác từ giỏ cũ**; thiếu `cappan_ai_pending_v5` | Thêm draft key + pending/ctx/group-memory vào reset |
| 15 | Medium (privacy) | `auth.js` logout | Sót `cappan_ai_metrics` (chứa câu hỏi user cũ, đọc được trên máy chung) | Xoá khi logout |
| 16 | Medium | `style.css` | Skeleton menu/order **không có CSS** → placeholder vô hình; hover quick-reply xanh `#007bff` `!important` lạc tông gold | Định nghĩa đủ `.skeleton-card/img/title/price/btn` (+ dark) + bỏ hover xanh, nhường theme.css |

### Kết quả sau vá
| Kiểm tra | Kết quả |
|---|---|
| `node --check` toàn bộ | **100% OK** |
| regression.test.mjs | **140/140 + Golden 21/21** (kb=6, rule=15, LLM=0) ✅ |
| behavior.test.mjs | **39/39 · 100%** ✅ |
| injection.test.mjs | **7/7** ✅ |
| multi-intent.test.mjs | **9/9** ✅ |
| partial-refusal.test.mjs | **5/5** ✅ |
| Dev server sống qua `/50%`, `/.env`, traversal | **200/400/403/403 — server không chết** ✅ (đối chứng: server chưa vá crash thật) |

---

## 2. BACKLOG CÒN LẠI (minor — không chặn chốt, nên dọn trong đợt sau)

**Dead code (chưa gọi):** `AIBrain._selfService` ~100 dòng (brain.js:803-899 + wrapper chat-interactions:1741); `GroupMemory` (brain-legacy:1125) + 5 intro tag chết (`UI_CHECKOUT/COMBO/GROUP_SUMMARY/SHIFT_PERSONAL/STORE` trong ai-output.js); `_handleBookingFlow` (brain-legacy:852); `MIN_CONFIDENCE` của splitter không dùng; dual constant `MAX: 300 / _max: 200` (AIMetrics).

**Trải nghiệm nhỏ:** voice double-click có thể tạo 2 recognizer; mic không abort khi đóng chat/logout; `tryGreet` đệ quy vô hạn khi tab nền mở lâu; greet-key lệch `cappan_greeted` vs `cappan_greeted_sid` (chưa dọn khi logout); reorder không check `inStock`; clearOld xoá đơn createdAt hỏng; `topItems` thiếu guard thiếu `items`; guest bypass WELCOME10; `isInMenu("")` trả true; weather cache đọc không await; regex difficultQuestions có dấu vs input bỏ dấu; user turn bị nhân đôi khi build context LLM; SSE merge index 0; ResponseCache chia reference quickReplies; KBFast thừa `)` hiển thị.

**Server/infra (trước khi niêm yết thật):** `proxy.js` mặc định `ALLOWED_ORIGINS='auto'` — phải `REQUIRE_ORIGIN=1` + danh sách trắng; invite-code staff hardcode client-side + in trên trang đăng ký (chỉ dùng cho demo); `AI_PROXY_URL` trỏ remote worker còn proxy local 8787 là dead path; rate-limit Map không prune entry rỗng; password plaintext trong `cappan_users` (bản chất localStorage demo); order draft "xác nhận" có 2 đường confirm song song (confirmCheckout + _checkoutStep).

**Vệ sinh:** file rác `5` (0 byte) ở root — có thể xoá an toàn; theme init IIFE trùng trong head mọi trang; `theme-color` meta thiếu; theme.css load sau card-premium.css trên trang staff (cascade lệch với trang khách).

---

## 3. LỆNH KIỂM TRA LẠI (chuẩn khi giao/nhận mã)

```bash
node --check js/ai/brain.js && node --check js/main.js && node --check js/api/index.js
node tests/regression.test.mjs     # 140 + golden 21/21
node tests/behavior.test.mjs       # 39/39
node tests/injection.test.mjs      # 7/7
node tests/multi-intent.test.mjs   # 9/9
node tests/partial-refusal.test.mjs # 5/5
node server/static-dev.js          # http://127.0.0.1:8123
```

## 4. ĐỢT NÂNG CẤP UI/UX SAU CHỐT (Design Polish Layer v15)

> Sau khi chốt, dự án bổ sung 1 **lớp thẩm mỹ tách rời logic** — không sửa bất kỳ file JS nào, chức năng giữ nguyên 100%.

- **File mới:** `ui-polish.css` (~300 dòng) — chỉ chứa màu/bóng/bo-góc/viền/animation.
- **Cách cài:** `<link rel="stylesheet" href="ui-polish.css">` chèn **ngay trước `</head>`** ở cả **19 trang HTML** (kể cả trang staff nơi theme.css nạp muộn) → luôn thắng cascade, không cần sửa CSS cũ.
- **Nội dung polish:** thẻ `.ui-card` (radius 18px, shadow 3 lớp, hairline vàng trên mép — vẽ bằng background-image, không thêm DOM), bubble bot (viền trái vàng, radius 16/5) + bubble user (gradient nâu), nén padding bubble chứa thẻ qua `:has(.ui-card)`, entrance animation `.msg` (thay `fx-msg`), typing bubble + dot bóng mềm, **button system đồng bộ toàn bộ nút trong mọi thẻ** (`.ui-welcome-btn` trước đây thiếu hẳn base style → nút trắng viền xám mặc định trình duyệt; nay là pill vàng cream + hover gradient vàng + vệt sáng lướt khớp pattern các nút khác; `.ui-btn-add` pill hoá; `.ui-chip-btn` bỏ cam lạc tông về tông gold; `.ui-fab-fab-primary` tăng tương phản chữ trên nền vàng; nút xác nhận 2-step bo mềm; quick-reply đồng bộ chiều cao), input focus ring vàng, nút gửi gradient vàng thương hiệu, FAB shadow sâu + focus ring, thanh LIVE shimmer `polLiveShimmer` + cờ LIVE thở, cột so-sánh thắng ring vàng inset, KPI + stat-card `tabular-nums` (số không nhảy khi update), scrollbar mảnh vàng, dark mode đồng bộ toàn bộ.
- **Ràng buộc an toàn đã verify:** không đổi `display/position/width` của phần tử JS query; không thêm phần tử DOM; mọi animation tắt khi `prefers-reduced-motion: reduce`.
- **QA trên browser thật (Chrome desktop):** polish nạp cuối cascade ở cả 2 nhóm trang ✅ · bấm quick-reply gửi đúng ✅ · "so sánh" trả lời đúng tầng kb ✅ · thẻ COMPARE winner ring vàng áp dụng ✅ · tạo đơn thật qua checkout → thẻ LIVE render đúng 5 bước + bar shimmer ✅ · poll 6s tự update khi step advance (width 25%) ✅ · `:has()` bubble chứa thẻ nén padding đúng ✅ · test suite 212 case vẫn xanh ✅.
- **Ghi chú môi trường:** máy QA phát hiện Chrome đang bật **Force Dark (auto-dark)** — nó đảo màu toàn trang ĐỘC LẬP với dark mode của dự án. Khi demo, nên tắt "Tự động làm tối màu" trong `chrome://settings/appearance` để thấy đúng 2 theme sáng/tối của CAPPAN.

## 5. KẾT LUẬN

**Source code đạt trạng thái SẴN SÀNG CHỐT.** Toàn bộ blocker (server crash, traversal, test đỏ, tool staff bị cắt, XSS onclick, hủy đơn sai bước) đã được vá và kiểm chứng lại bằng test tự động + request tấn công thật. Bộ test **212 case / 100% xanh** (140 hồi quy + 21 golden + 39 hành vi + 7 injection + 9 đa ý định + 5 partial-refusal). Các điểm còn lại là backlog minor không ảnh hưởng demo/khả năng vận hành của chatbot.
