# CAPPAN — BỘ TÀI LIỆU BẢO VỆ DỰ ÁN (3 bài: Defense Playbook · Technical Spec · Deep-Dive)

> **Bản đầy đủ 3 bài (tương ứng 3 prompt) — trọng tâm AI/Chatbot:**
> - `docs/01-defense-playbook.md` — Kịch bản 20 phút: 5' thuyết trình + 5' demo chat WOW + 10' Q&A (câu hỏi xoay quanh AI engine)
> - `docs/02-technical-specification.md` — Thuyết minh động cơ AI & chatbot 6 phần (dành cho Giảng viên)
> - `docs/03-deep-dive-architecture.md` — Deep-dive AI engine: pipeline 8 tầng, tool-calling, Generative UI + sơ đồ Mermaid + walkthrough
>
> File này là **bản rút gọn tra cứu nhanh trong buổi bảo vệ**. Dữ liệu được đối chiếu trực tiếp với mã nguồn (js/ai/*, js/main.js, js/api/index.js, tests/*).
> Lưu ý phòng thủ: cache là **exact-normalized + TTL 10 phút** (ResponseCache, brain.js) — **không phải Jaccard**.

---

## BÀI 1 — KỊCH BẢN BẢO VỆ 20 PHÚT

### Phần 1 — Thuyết trình 5 phút (minute-by-minute)

- **Phút 1 (Đặt vấn đề):** quán mất nhân sự trực chat/điện thoại; 3 điểm đau: trả lời lặp lại (giờ, giá, chỗ), đặt bàn rối, theo dõi đơn thủ công. Chốt: *"CAPPAN biến khung chat thành toàn bộ hệ thống vận hành của quán."* (Chatbot = mini dashboard: không hiện sẵn, hỏi là có.)
- **Phút 2 (Giải pháp & kiến trúc):** Frontend thuần HTML/CSS/Vanilla JS, zero-backend → đọc tức thì, demo mọi máy; toàn bộ CRUD đi qua 1 điểm tắc duy nhất `js/api/index.js` (`API.*`) → nâng backend sau chỉ thay 1 adaptor. Vẽ pipeline: `Input → Guard → Splitter → Auth → KB → LocalBrain → LLM`.
- **Phút 3 (Động cơ AI):** InjectionGuard; IntentAuthorization lọc tool theo role; KBFast trả lời tĩnh chi phí 0; LocalBrain nhận diện ý định + sở thích; LLM streaming qua proxy nhiều slot (Groq/Gemini/OpenAI) + cooldown 429; Generative UI ~35 loại thẻ; **Anti-Hallucination Guard** chặn LLM bịa đơn.
- **Phút 4 (Giá trị 2 phía):** Khách — menu, đặt bàn, thanh toán, tracker, hủy, đánh giá, sửa địa chỉ trong chat. Staff — KPI, ca làm, Customer 360, advance đơn trong chat.
- **Phút 5 (Tổng kết):** Zero-Clutter · Infinite Capabilities · Conversational is the Highlight; 5 bộ test tự động ~200 case xanh. Kết: *"Các quán bán cà phê. CAPPAN bán cả sự tự túc của quán."*

### Phần 2 — Demo "WOW" 5 phút

**Khách hàng (3'):** đã login U001, chat trong trạng thái chào.
1. `menu có gì` → thẻ CATALOG 24 món + nút "+ Thêm" (0:00–0:30)
2. `cho 2 trà đào cam sả` → thẻ ORDER_PICK: chip số lượng, ⚡ Nhận ngay / 🕒 Đặt giờ, ✗ Bỏ (0:30–1:00)
3. `nhan ngay` → `thanh toán` → thẻ ORDER_CHECKOUT → ✓ Xác nhận & Giao ngay (1:00–1:45)
4. → đơn THẬT + thẻ LIVE_ORDER 5 bước, tự poll 6s (1:45–2:00)
5. `đặt bàn 4 người tối nay 19h` → BOOKING_CONFIRM (A5, chip đổi bàn) → ✓ Xác nhận → BOOKING_DONE mã BK + confetti (2:00–2:40)
6. `so sánh trà đào và trà sen` → thẻ COMPARE giá/tag/độ chênh (2:40–2:50)
7. 🎤 voice "giờ mở cửa" — Web Speech API vi-VN (2:50–3:00)

**Nhân viên (2'):** đăng nhập staff.
1. `doanh thu hôm nay` → thẻ KPI(3:00–3:20)
2. `đơn đang xử lý` → thẻ ORDER active (3:20–3:35)
3. `tiến trình đơn OD…` → đơn thật chuyển bước, thẻ tự vẽ lại (3:35–3:50)
4. `tra cứu khách 0900000001` → Customer 360 (SĐT che, tổng chi, no-show) (3:50–4:10)
5. `lịch ca hôm nay` → SHIFT card (4:10–4:25)
6. 🌙 Dark Mode (sync tab qua BroadcastChannel) (4:25–4:40)
7. Tab khách mở sẵn → đơn vừa advance hiện **không cần refresh** (4:40–5:00)

> Chống sự cố: nếu mạng/LLM trục trặc, `menu có gì` chạy tầng local — demo không chết.

### Phần 3 — Q&A Playbook 10 phút

**Giảng viên:**
1. **Không backend? mất dữ liệu?** → PoC trải nghiệm; biên giới dữ liệu đóng gói 1 lớp `API.*`, thay internals bằng fetch = 1 file adaptor, không sédit 30 trang.
2. **AI thật hay if-else?** → Hybrid deterministic-first: 90% nghiệp vụ tầng rule/tool xác định; LLM stream + tool-calling schema; mọi hành vi dữ liệu BẮT BUỘC qua tool thật; Anti-Hallucination Guard chặn tuyên bố giả.
3. **Cache (câu bẫy Jaccard)?** → Exact-normalized key (role + normalized text, TTL 10 phút); cố ý không fuzzy để tránh false-hit; latency ≈ 0 cho câu lặp.
4. **Bảo mật?** → 3 lớp: InjectionGuard (2+ pattern block); IntentAuthorization + role-scoped tool list; escapeHtml/_safeHref whitelist + danger tool 2-step confirm.
5. **LLM sập?** → cooldown 60s đổi slot; hết slot → fallback lịch sự + hotline + không nói dối khách; KBFast/LocalBrain không phụ thuộc mạng.
6. **Test?** → 5 suite VM Node: regression 140 + golden 21, behavior 39, injection 7, multi-intent 9, partial-refusal 5.

**Bạn học:**
7. **Trùng chỗ đặt bàn?** → seat.status flips; `bookings.create` trả null → "chỗ vừa bị mất"; validate slot (quá khứ/3h sáng/14 ngày); giới hạn 3 booking hoạt động; no-show counter.
8. **Cá nhân hóa khuyến mãi?** → UserMemory (feedback 👍👎), tần suất đơn, tag overlap, thời tiết cache, trạng thái sức khỏe → mỗi món gợi kèm `reason` audit được.
9. **Dark Mode tương phản?** → chỉ đổi CSS token, cặp màu ≥ WCAG AA, sync đa tab qua storage event.
10. **Chat "làm UI" không?** → không: AI trả JSON contract chặt, renderer là hàm cố định, escape toàn bộ, event delegation — "AI quyết định, code thẩm quyền".

---

## BÀI 2 — THUYẾT MINH KỸ THUẨT (dành cho Giảng viên)

### P1 — Tổng quan & tầm nhìn
CAPPAN = web quản trị & phục vụ quán cà phê, giao diện trung tâm là **trợ lý hội thoại trả thẻ UI tương tác** (Generative UI). Ba nguyên lý: Zero-Clutter, Infinite Capabilities, Conversational is the Highlight. Frontend thuần vì: chi phí hạ tầng ≈ 0, demo tức thì, và **lớp dữ liệu duy nhất** `API.*` làm nâng cấp backend thành việc thay adaptor.

### P2 — Feature Matrix
| Nhóm | Tính năng | Giá trị |
|---|---|---|
| Khách | CATALOG/MENU + nút "+ Thêm" | gọi món không rời chat |
| | Booking flow (số người→giờ→bàn→xác nhận) | chốt bàn <30s toàn chip |
| | ORDER_PICK→giỏ→CHECKOUT→ tạo đơn | thanh toán trong chat |
| | LIVE_ORDER tracker poll 6s | theo dõi shipper ngay trong bubble |
| | COMPARE/giá/khoẻ/lịch sử/thời tiết | gợi ý có lý giải |
| | lịch sử/hủy (confirm 2 bước)/đặt lại/chấm sao/sửa địa chỉ | "mọi thứ tương tác trên chat" |
| | PROMO copy, WELCOME chips, voice, confetti | chat là điểm nhấn UX |
| Staff | KPI card | dashboard thu nhỏ |
| | quản lý đơn + advance | thẻ vẽ lại tức thì |
| | Customer 360 (che SĐT) | hỗ trợ 1 lượt hỏi |
| | SHIFT/nhân viên/kho chip | vận hành không cần trang quản trị |
| | staff panel riêng + AI metrics | giám sát chất lượng chat |

### P3 — AI Engine
Pipeline canonical: `Input → AIInput(normalize+guard) → InjectionGuard → MultiIntentSplitter → IntentAuthorization → DraftEngine → KBFast → LocalBrain/Legacy → LLM(tool-calling, stream)` + ResponseCache + history/draft persistence.
Generative UI: `[UI_TEN]{json}[/UI_TEN]` → `UICards.parse` → `renderers[t]` → thẻ + `_store` cho modal "Xem"; khôi phục lịch sử giữ đủ thẻ.
Nâng cao: stream throttle 30ms + typing phases; voice Web Speech API; Anti-Hallucination Guard; tool schema + danger 2-step.
Proactive: chào chờ tương tác + gợi ý thời tiết; cảm xúc TTL 2'.

### P4 — RBAC & State
- Role-based: handler riêng customer/staff; tool list lọc theo role; auth phone+password + invite-code staff; logout dọn sạch toàn bộ state AI.
- Persistence: nghiệp vụ + history + drafts + metrics + prefs (bảng chi tiết ở Bài 3 · SECTION 3); Realtime Sync 2 tầng BroadcastChannel → storage event.

### P5 — Key differentiators
Smart scroll chống cướp cuộn + pill "tin mới"; confetti; sound toast; skeleton; dark mode token-based; chips động theo loại trả lời; feedback 👍👎 ghi source/TTFT/model; expand modal thẻ.

### P6 — Architect's conclusion
CAPPAN chứng minh: **AI tốt nhất không phải AI tự do — mà là AI được trao đúng quyền, đúng tool, trả thẻ theo chuẩn**. Đạt đồng thời: deterministic đúng chỗ cần dữ liệu, generative đúng chỗ cần trải nghiệm, safe-by-design ở ranh quyền dữ liệu. Mở rộng: REST adapter thay `API.*`, DB, multi-branch — AI/UI không cần viết lại.

---

## BÀI 3 — DEEP-DIVE KỸ THUẬT & AI ENGINE

### SECTION 1 — Architecture
SPA-ish multi-page, Vanilla JS namespace contract (`API`, `AIBrain`, `LocalBrain`, `UICards`, `Auth`, `AIMetrics`); middleware wrap qua decorator pattern thuần; `cappan:sync` nối tab. Ưu: tức thì, test bằng VM Node. Nhược: quy mô đồng thời + rủi ro localStorage — đã cô lập vào điểm tắc `API.*`.

### SECTION 2 — Deep-dive AI
1. Input: chuẩn hóa + guard.
2. Security: InjectionGuard (2+ block, 1 log); IntentAuthorization theo role.
3. Tiers: DraftEngine (bền TTL 30', INTERRUPT hủy khi đổi chủ đề, checkout/cancel là lance chốt xác nhận); KBFast tĩnh; LocalBrain sở thích (cafein/ngot/beo/dang/chua/thanh/temperature/maxPrice/popular/fresh...) + handler nghiệp vụ; LLM proxy multi-slot (X-Access-Token, SSE parse, 3 vòng tool-call, cooldown).
4. Generative UI: JSON contract -> renderer thật; LIVE_ORDER `data-live-order` poll 6s tự hủy khi xong.
5. Fine: typing throttle/phases; metrics source (kb/rule/llm/cache/guard) + TTFT; Anti-Hallucination Guard cuối lượt LLM.

### SECTION 3 — State & Storage
| Dữ liệu | Nơi | TTL/Chính sách |
|---|---|---|
| users/menu/orders/bookings/seats/shifts | localStorage `cappan_*` | seed lần đầu + CRUD thật |
| history chat (role_sid) | localStorage | sạch khi logout; giữ [UI_] tag để khôi phục |
| drafts | localStorage | TTL 30' |
| AI context | sessionStorage `cappan_ai_ctx_v5` | ≤10 turn |
| cache | memory Map | TTL 10'; skip khi draft |
| metrics | localStorage `cappan_ai_metrics` | 300 event |
| prefs | localStorage | sync storage event |

Realtime: BroadcastChannel('cappan_sync') → fallback storage event.

### SECTION 4 — Data Flow (Mermaid)

```mermaid
flowchart TD
    U[User gõ text / chip / 🎤] --> I[sendChat]
    I --> N[AIInput normalize]
    N --> G{InjectionGuard}
    G -- block --> R0[Từ chối lịch sự]
    G -- pass --> SP{MultiIntentSplitter}
    SP -- multi --> MI[Phéc từng ý, gộp]
    SP -- 1 --> AU{IntentAuth theo role}
    AU -- tu choi --> R1[Không có quyền]
    AU -- pass --> D{DraftEngine}
    D -- active --> DS[Step flow: giờ/bàn/checkout]
    D -- ko --> KB{KBFast}
    KB -- hit --> OUT[Text + chips]
    KB -- miss --> LB{LocalBrain}
    LB -- hit --> OUT2[Rule + recommendData]
    LB -- miss --> LLM[LLM proxy multi-slot, SSE, tool schema]
    LLM -- tool --> TX[AIToolExecutor | danger → confirm]
    TX --> LLM
    LLM -- fake claim --> AHG[Anti-Hallucination Guard]
    LLM -- final --> OUT3[Stream + feedback]
    OUT & OUT2 & OUT3 & DS & R0 & R1 --> V[message + cards + quickReplies]
    V --> R[AIOutput.isValidResponse]
    R --> P[UICards.parse + renderers]
    P --> CH[chatBody + chips + confetti]
    CH --> H[(history)]
    DS -.-> DR[(drafts TTL 30')]
    N & KB & LB & LLM --> M[(AIMetrics)]
    CH --> API[API.* choke point]
    API --> LS[(localStorage)]
    API --> BC[BroadcastChannel cappan_sync]
```

**Walkthrough "so sánh trà đào và trà sen":**
norm = `so sanh tra dao va tra sen` → guard/splitter/auth bỏ qua → KB miss → handler `compare` bật regex → tìm M101 (45k) & M103 (48k) → đọc `LB_TAGS` (light caféin, chua/béo/thanh) → payload:
`[UI_COMPARE]{"a":{"name":"Trà Đào Cam Sả","price":45000,"tags":"chua · giải nhiệt"},"b":{"name":"Trà Sen Vàng","price":48000,"tags":"thanh nhẹ"},"cheaper":"Trà Đào Cam Sả","diff":3000}[/UI_COMPARE]`
→ `renderers.COMPARE` vẽ thẻ 2 cột kèm "Chênh 3.000đ", lưu `_store` cho khi làm muốn phóng to, push history để khôi phục thẻ sau refresh.

---

## CÂU LỆNH CHẠY ĐỂ KIỂM TRA TRƯỚC BẢO VỆ

```bash
node tests/regression.test.mjs     # 140 + golden 21
node tests/behavior.test.mjs       # 39
node tests/injection.test.mjs      # 7
node tests/multi-intent.test.mjs   # 9
node tests/partial-refusal.test.mjs
node server/static-dev.js          # http://127.0.0.1:8123 — trang demo để chạy kịch bản 20 phút
```
