# BÀI 2 — THUYẾT MINH AI CHATBOT CAPPAN (Technical Specification — trọng tâm AI/Chatbot)

> Dành cho Giảng viên / Giám thị: trọng tâm là **động cơ AI & Chatbot**; web/app chỉ là môi trường vận hành. Đối chiếu trực tiếp mã nguồn `js/ai/*`: `brain.js` v5.0, `ai-input.js`, `ai-output.js`, `injection-guard.js`, `intent-authorization.js`, `multi-intent-splitter.js`, `chat-interactions.js`, `brain-legacy.js`, `emotional-handler.js`, `handover.js`, `proactive.js`, `user-memory.js`, `item-lookup.js`.

---

## PHẦN 1: TỔNG QUAN ĐỘNG CƠ AI & TẦM NHÌN THIẾT KẾ (Executive Summary)

**CAPPAN là chatbot gì?** Trợ lý hội thoại F&B cho quán cà phê, khác biệt ở một luận điểm: **chatbot không phải kênh trả lời hỏi — chatbot là nhân viên thứ hai của quán.** Bot không dừng ở FAQ: khách đặt bàn, gọi món, thanh toán, theo dõi đơn, chấm sao — nhân viên advance đơn, tra Customer 360, xem KPI — **toàn bộ ngay trong khung hội thoại**, qua các thẻ UI tương tác bot tự phát sinh.

**Ba nguyên tắc thiết kế chatbot:**
1. **Không một từ nào được đi tắt** — mọi input đi qua pipeline 8 tầng nghiêm ngặt, kể cả voice.
2. **AI quyết định, code thẩm quyền** — model chọn thẻ + dữ liệu qua contract chặt; vẽ UI và chạm DOM là hàm code cố định.
3. **Chi phí theo tầng, không theo câu** — câu tĩnh/luật giải local 0 token; LLM chỉ xử lý phần sót lại.

**Luồng xử lý canonical:**

```
Input → AIInput(normalize) → InjectionGuard → MultiIntentSplitter
      → IntentAuthorization → DraftEngine → KBFast → LocalBrain/Legacy
      → LLM(tool-calling, stream) → Anti-Hallucination Guard
      → ResponseCache + history/draft/metrics persistence
```

**Lý do kiến trúc này (không phải hình thức):**
- **An toàn:** quyền được kiểm ở tầng pipeline (Auth), không ở tầng model — model không thể bị "thuyết phục" vượt quyền.
- **Chi phí & sẵn sàng:** golden set 21 case — kb=6, rule=15, **LLM=0** → phần lớn trải nghiệm offline, tức thì, 0 token.
- **Chính xác:** dữ liệu business chỉ chạy qua tool thật + Anti-Hallucination Guard — model không tự tung hứng.
- **Kiểm thử được:** logic Vanilla thuần load trong VM Node → ~200 test case tự động, 100% xanh.

---

## PHẦN 2: BẢN ĐỒ NĂNG LỰC CHATBOT (AI Capability Matrix)

| Nhóm người dùng | Năng lực chatbot | Cơ chế phía sau & Giá trị |
| :--- | :--- | :--- |
| **Khách hàng** | Hỏi menu, gọi món bằng câu tự nhiên | Intent + quantity extraction ('cho 2 trà đào') → thẻ ORDER_PICK chip số lượng, Nhận ngay/Đặt giờ |
| | So sánh món | Handler `compare` + item-lookup → thẻ COMPARE: giá, tag, độ chênh, badge "Rẻ hơn" |
| | Gợi ý theo sở thích/sức khỏe/thời tiết | LocalBrain tín hiệu (cafein/ngọt/béo/đắng/chua/thanh/maxPrice/fresh) + weather cache → món kèm `reason` |
| | Thanh toán & tạo đơn thật trong chat | Draft lance chốt → ORDER_CHECKOUT → tool tạo đơn |
| | Tracking đơn live | Thẻ LIVE_ORDER poll 6s, 5 bước + Google Maps nhúng, tự hủy khi xong |
| | Đặt bàn flow nhiều bước | DraftEngine TTL 30' — guests → giờ → bàn → confirm; validate slot; 2-step cancel |
| | Hủy đơn/bàn, đặt lại, chấm sao, sửa địa chỉ | Tool danger 2-step confirm; RATING card; USER_STATS điểm |
| | Promo cá nhân hóa | UserMemory (👍👎) + lịch sử đơn + thời tiết + sức khỏe → PROMO card có căn cứ |
| | Voice input | Web Speech API vi-VN → đi cùng pipeline như text |
| **Nhân viên** | KPI doanh thu trong chat | `doanh thu hôm nay` → thẻ KPI ngày/tuần/tháng + phân bố trạng thái |
| | Advance đơn ngay trong thẻ | Tool-calling thật → đơn chuyển bước, thẻ tự vẽ lại |
| | Customer 360 | `tra cứu khách <SĐT>` → thẻ CUSTOMER, **SĐT che `****` ngay tầng tool**, tổng chi, no-show |
| | Ca làm việc, hết hàng, công thức, danh sách staff | Thẻ SHIFT / OOS / RECIPE / STAFF |
| | Tra cứu lịch sử khách (staff-only) | `search_customer_history` — bị IntentAuthorization chặn với customer |
| **Hệ thống AI chung** | Đa ý định trong 1 câu | MultiIntentSplitter tách → xử lý tuần tự → gộp kết quả |
| | Tái cuộc hội thoại | Context ≤10 turn gần nhất (sessionStorage); cảm xúc TTL 2'; draft TTL 30' |
| | Giám sát chất lượng bot | AIMetrics: source (kb/rule/llm/cache/guard) + TTFT + model + feedback — xem ở staff-ai |

---

## PHẦN 3: BÓC TÁCH ĐỘNG CƠ AI & GENERATIVE UI (AI Engine Architecture)

### 3.1 Chuẩn hóa đầu vào (`ai-input.js`)
Mọi input (text/chip/voice) qua `AIInput.normalize()`: lowercase, bỏ dấu tiếng Việt, dò tín hiệu chào/cảm ơn/hủy/địa chỉ. `norm` là **đơn vị tiền tệ chung** của pipeline — kể cả key cache.

### 3.2 Lớp an toàn (2 file, cấm bypass)
- **InjectionGuard:** đếm pattern injection; **≥2 → block** (từ chối lịch sự), 1 → log-only. Tránh chặn oan.
- **IntentAuthorization:** whitelist role từng ý định/tool; khách gọi tool staff → từ chối lịch sự trước khi chạm dữ liệu.

### 3.3 MultiIntentSplitter
Tách câu ghép thành ý định độc lập, xử lý tuần tự, **gộp 1 lượt trả lời nhiều thẻ**. 9 test case dedicated.

### 3.4 Phân tầng xử lý (tier cascade)

| Tầng | Điều kiện | Chi phí | Output |
|---|---|---|---|
| **DraftEngine** | Đang giữa luồng | 0 | Step flow; TTL 30'; INTERRUPT đổi chủ đề → hủy; checkout/cancel là lance chốt |
| **KBFast (Fast Path)** | Câu tĩnh (giờ, wifi, hotline, đỗ xe, chào/cảm ơn) | 0, <100ms | Text + chips; VD wifi: `CAPPAN_Free / cappannguyen` từ `kbGet` |
| **LocalBrain** | Ý định sở thích/nghiệp vụ | 0 | Rule + recommendData + UI tag |
| **LLM** | Hội thoại mở | Token | Stream multi-slot, tool schema ≤3 vòng, temp 0.4, timeout 15s |

**LLM multi-slot:** Groq (`gpt-oss-20b/120b`) + Gemini (`3.8/3.6-flash`) qua Cloudflare Worker proxy (`X-Access-Token`, SSE). 429 → **cooldown 60s** theo slot/provider, `pick()` chọn slot khỏe. Hết slot → fallback lịch sự + hotline, **không nói dối khách**.

### 3.5 Generative UI Contract
- Bot trả `[UI_TEN]{json}[/UI_TEN]` — **không trả HTML**.
- `UICards.parse` → `renderers[t]` = **hàm JS cố định** → thẻ DOM; nội dung `escapeHtml`, link `_safeHref` whitelist; tương tác event delegation; thẻ lưu `_store` cho modal phóng to.
- **~35 loại thẻ**: CATALOG/MENU, ORDER_PICK, ORDER_CHECKOUT, LIVE_ORDER, BOOKING_PLAN/CONFIRM/DONE/CANCEL, COMPARE, PROMO, KPI, SHIFT, CUSTOMER, RECIPE, OOS, RATING, USER_STATS, CART_SUCCESS, MY_INFO, NEED_LOGIN, ORDER, STAFF...
- **LIVE_ORDER:** `data-live-order="ID"` → `main.js` poll 6s → `_paintLive` vẽ lại timeline 5 bước + thanh tiến trình + iframe Maps theo `SHIPPER_DATA.coords[step]` + cờ "● LIVE"; **tự hủy timer** khi step≥4/hủy/thẻ gỡ khỏi DOM.
- **Anti-Hallucination Guard:** cuối lượt LLM — tuyên bố mutation ↔ tool-call thật; lệch → thay câu trung thực. Tool danger (hủy đơn/bàn) bắt 2-step confirm.

### 3.6 Trải nghiệm AI tinh tế
- **Typing stream:** `_throttleChunk` ~30ms/lần — mượt, ngắt nghỉ theo cụm câu, không nhấp nháy token.
- **ResponseCache:** exact-normalized `role + '|' + norm`, **TTL 10 phút**, skip khi draft active; hit vẫn ghi history. **Cố ý không fuzzy** — false-hit với mutation nguy hiểm hơn miss.
- **Voice Input:** Web Speech API vi-VN (`main.js`) → cùng pipeline như text.
- **Proactive & cảm xúc:** chào chủ động khi chờ tương tác, gợi ý theo thời tiết (cache); ngữ cảnh cảm xúc TTL 2 phút (`emotional-handler.js`).
- **Handover:** khi bot không giải quyết được → chuyển hướng có kiểm sang con người thay vì vòng lặp vô nghĩa.
- **UserMemory:** nhớ sở thích qua feedback; **item-lookup:** tra món nhanh cho các handler.
- **AIMetrics:** source + TTFT + model + feedback 👍👎 (300 event) → staff-ai giám sát được chất lượng bot.

---

## PHẦN 4: PHÂN QUYỀN Ý ĐỊNH & QUẢN LÝ TRẠNG THÁI HỘI THOẠI (RBAC & Conversation State)

**Phân quyền trong chatbot (khác biệt so với web RBAC thông thường — quyền áp cho *ý định*, không cho *trang*):**
- **Đầu vào phiên:** login SĐT + mật khẩu; staff qua **invite-code**; role gắn theo session.
- **Trong pipeline:** IntentAuthorization + tool list lọc theo role (`customer`/`staff`) — **quyền là thuộc tính của luồng xử lý**, không thể bị model "quyết định lại".
- **Trong dữ liệu:** tool trả dữ liệu nhạy cảm tự che (SĐT → `0900****01`) khi build payload.
- **Khi rời phiên:** logout dọn sạch history, draft, context, cache.

**Trạng thái hội thoại (Conversation State):**

| State | Kho | TTL / Chính sách |
|---|---|---|
| Lịch sử chat (per `role_sid`) | `localStorage` | Sạch khi logout; lưu nguyên `[UI_]` tag → khôi phục đủ thẻ sau refresh |
| Draft flow (đặt bàn/checkout) | `localStorage` | TTL 30 phút; INTERRUPT → hủy |
| AI context (turn gần) | `sessionStorage` `cappan_ai_ctx_v5` | ≤10 turn, slice 200 ký tự/turn |
| Response cache | memory Map | TTL 10 phút |
| Cooldown LLM slots | `sessionStorage` `cappan_ai_cool` | 60s/429 |
| Metrics + feedback | `localStorage` `cappan_ai_metrics` | 300 event gần nhất |

Điểm mấu chốt: **bot "nhớ" bằng state ở storage chứ không bằng context của model** — rẻ, bền, test được.

---

## PHẦN 5: ĐẶC ĐIỂM AI NỔI BẬT & ĐIỂM NHẤN TRẢI NGHIỆM HỘI THOẠI (Key Differentiators)

- **Generative UI + Anti-Hallucination:** bot trả thẻ tương tác thật nhưng không bao giờ tự tay chèn HTML — safe-by-design.
- **Typing stream 30ms + typing phases:** bot gõ như người thật, không giật.
- **Smart Scroll:** bot trả lời dài khi user đang cuộn → **không cướp cuộn**, hiện pill "Tin mới". Tôn trọng người đọc trước, tự động sau.
- **Chips động theo ngữ cảnh:** quick-reply đổi theo loại trả lời (chọn giờ, advance, xác nhận hủy...).
- **Confetti + sound + skeleton:** pháo giấy khi chốt bàn; skeleton thay màn trắng khi chờ; toast có âm.
- **Voice input vi-VN:** hội thoại không cần tay.
- **Proactive + cảm xúc TTL 2':** bot chủ động, không thụ động chờ hỏi.
- **Dark mode token-based WCAG AA** — nền cho trải nghiệm chat mọi điều kiện ánh sáng.

---

## PHẦN 6: TỔNG KẾT ĐÁNH GIÁ CỦA CHUYÊN GIA (Architect's Conclusion)

CAPPAN chứng minh luận điểm: **AI tốt nhất không phải AI tự do — mà là AI được trao đúng quyền, đúng tool, trả thẻ theo chuẩn.** Ba điều đạt đồng thời:

1. **Deterministic đúng chỗ cần dữ liệu** — nghiệp vụ qua tool thật + guard chống nói dối; cache bóc câu lặp, từ chối fuzzy gây false-hit.
2. **Generative đúng chỗ cần trải nghiệm** — LLM streaming, ~35 thẻ động, typing chân thực, proactive, voice.
3. **Safe-by-design ở ranh quyền dữ liệu** — 3 lớp bảo mật, quyền thuộc pipeline, AI không chạm DOM.

Tiềm năng mở rộng không cần viết lại: thêm tool vào schema = thêm năng lực; thêm handler local = giảm chi phí LLM; đổi provider = đổi slot. Con số tự bảo vệ: **~200 test case xanh, golden set 0 case cần LLM** — chatbot này làm việc được kể cả khi mạng chết. *Chatbot không phải kênh chăm sóc khách — nó là nhân viên thứ hai của quán.*
