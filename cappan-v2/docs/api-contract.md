# CAPPAN v2 — HỢP ĐỒNG DATA/API · CONTRACT v1.4

> **Đây là tài liệu BINDING.** Mọi thay đổi chữ ký (tên hàm, tham số, giá trị trả về, cách báo lỗi)
> PHẢI cập nhật tài liệu này + mục Changelog §7 **trước** khi sửa code.
> Test trong `tests/` là dạng chạy được của hợp đồng — hợp đồng đổi mà test không theo là sai hợp đồng.

---

## §0. NGUYÊN TẮC NỀN MÓNG (non-negotiable)

1. **Async tuyệt đối.** Mọi phương thức API trả về `Promise`. Tầng mặt dưới (localStorage, HTTP, DB)
   là chi tiết implementation — chữ ký bên dưới PHẢI giữ nguyên khi swap sang backend.
2. **Contract-first.** Viết chữ ký vào §3 trước, rồi code — kể cả khi method ở giai đoạn
   chưa implement (`throws NOT_IMPLEMENTED`). (Page chưa đến pha vẫn gọi được để chuẩn bị: nhận
   `NOT_IMPLEMENTED` rõ ràng thay vì lỗi bí ẩn.)
3. **Chống vendor lock-in.** Chỉ duy nhất `src/api/*.js` chạm backend/storage.
   Page script / UI layer KHÔNG được import `src/core/storage.js` hay chạm trực tiếp localStorage.
4. **Giá tiền:** số nguyên ≥ 0, đơn vị Đồng (VND). Không bao giờ lưu/dispatch giá dạng chuỗi.
5. **Thời gian:** ngày `YYYY-MM-DD` (giờ local), timestamp ISO-8601 (tái tạo bằng `new Date().toISOString()`).
6. **ID format:** `od-<base36(epoch)>-<4 rand>` cho order, `bk-…` booking, `M###` seed (khóa vĩnh viễn), seat `A1..D8`, floor `F1..F4`.
   ID sinh 1 lần, không tái dùng — chúng là khóa tham chiếu chéo order ↔ user ↔ menu.
7. **Chống client-spoof giá:** mọi mutation (cart.add, orders.create...) TÍNH LẠI GIÁ từ catalog,
   KHÔNG tin giá client gửi lên. Nguyên tắc này giữ nguyên khi backend ra đời (server-side pricing).
8. **Không nuốt lỗi.** Không có hành vi `try { localStorage.set(...) } catch {}` rỗng như legacy
   (`js/api/index.js:13-21` — bug mất dữ liệu âm thầm). Lỗi phải dội lên là `ApiError`/`StorageError` có code.

## §1. KIỂU DỮ LIỆU CHUNG (typedef)

```ts
type Uid   = string;                        // identity hiện tại: userId hoặc 'guest'
type VND   = number;                        // đồng, nguyên
type Iso   = string;                        // ISO 8601

MenuItem   { id, name, categoryId, price: VND, img, description?, badge?,
             inStock: boolean, sizes: [{name, extraPrice: VND}]=[], toppings: [{name, price: VND}]=[] }
Category   { id, name, order }
Floor      { id, name, purpose, description, img }
Seat       { id, floorId, zone, capacity, status: 'available'|'booked', img, description }
CartItem   { itemId, name, price: VND, img, size: string, sizeExtra: VND,
             toppings: [{name, price: VND}], qty: 1..99 }        // ← v2 thêm sizeExtra & priced ít rác hơn legacy
Order      { id, userId: Uid|null, customerName,
             items: CartItem[], subtotal: VND, shipping: VND, total: VND,
             address, phone, note?, status, step: 0..4,
             createdAt: Iso, updatedAt: Iso, cancelledAt?: Iso, completedAt?: Iso }
```

`step` mapping (giữ nghịch chi tiết live timeline legacy):
`0 Chờ xử lý → 1 Đang pha → 2 Shipper lấy → 3 Đang giao → 4 Hoàn tất`
`status` mapping: `{0:'pending',1:'preparing',2:'delivering',3:'delivering',4:'completed'}`; ngoài ra `'cancelled'`.

## §2. MÔ HÌNH LỖI (duy nhất)

```ts
class ApiError extends Error {
  code:
    | 'VALIDATION'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'FORBIDDEN'
    | 'UNAUTHORIZED'
    | 'NOT_IMPLEMENTED'
    | 'STORAGE'
    | 'UNEXPECTED';
  extra?: object; // chi tiết validate (field → lý do)
}
class StorageError extends Error {
  /* chi tiết trong src/core/errors.js */
} // quota/serializer/driver
```

| code              | HTTP (khi có backend) | Khi nào dùng                                         |
| ----------------- | --------------------- | ---------------------------------------------------- |
| `VALIDATION`      | 400                   | Input sai shape / thiếu field bắt buộc               |
| `NOT_FOUND`       | 404                   | Entity mutation không tồn tại (xem quy tắc đọc §3.0) |
| `CONFLICT`        | 409                   | State hiện tại cấm thao tác (VD hủy đơn đang giao)   |
| `FORBIDDEN`       | 403                   | Đã đăng nhập nhưng vai trò hoặc quyền sở hữu không cho phép thao tác |
| `UNAUTHORIZED`    | 401                   | Thao tác bắt buộc đăng nhập nhưng actor là guest |
| `NOT_IMPLEMENTED` | 501                   | Chữ ký đã chốt theo §3 nhưng chưa đến pha build      |
| `STORAGE`         | 500                   | Driver lỗi (quota, JSON hỏng...)                     |
| `UNEXPECTED`      | 500                   | Mọi thứ còn lại                                      |

**Quy tắc đọc (§3.0 — áp toàn cục):**

- Getter đơn lẻ (`getById`, `getCurrent`, `getByKey`) → ** trả `null`** khi không tìm thấy (không throw).
  Lý do: khớp hành vi legacy, tránh caller phải wrap try cho đọc thường.
- Mutator / method nhận id để SỬA → throw `NOT_FOUND` khi id không tồn tại.
- Getter danh sách → luôn trả mảng (rỗng thay vì null).

## §3. CHỮ KÝ PHƯƠNG THỨC

Giai đoạn: **P1 = implement ngay bước này**, **P2 = chốt chữ ký, code đến sau** (hiện `NOT_IMPLEMENTED`).

### 3.11 Quyền, sự kiện và nhật ký (v1.4)

- Actor chuẩn: `{ userId: string|null, role: 'guest'|'customer'|'staff'|'owner', channel: 'web'|'chat'|'voice' }`. `createApi({ channel = 'web' })` đặt kênh mặc định; method có thể nhận `{ channel }` khi cần đổi kênh cho một lời gọi. Vai trò lấy từ người dùng hiện tại trong kho dữ liệu.
- `src/domain/policy.js` xuất `POLICY` và `authorize(actor, action, resource)` → `{ allowed:boolean, reason:string }`. `resource.ownerId` dùng để xác định `own|other|none`; bảng bên dưới là nguồn quyền duy nhất. Dấu ✓ là cho phép.

| Hành động | guest | customer | staff | owner |
| --- | --- | --- | --- | --- |
| `seat.map` (`none`) | ✓ | ✓ | ✓ | ✓ |
| `menu.search`, `menu.recommend`, `booking.availability` (`none`) | ✓ | ✓ | ✓ | ✓ |
| `booking.mine`, `order.mine`, `profile.me` (`own`) | — | ✓ own | ✓ own | ✓ own |
| `order.status` (`own/any`) | — | ✓ own | ✓ any | ✓ any |
| `order.create` (`none`) | ✓ | ✓ | ✓ | ✓ |
| `order.cancel` (`own/any`) | ✓ none | ✓ own | ✓ any | ✓ any |
| `booking.create` (`none`) | — | ✓ | ✓ | ✓ |
| `booking.payDeposit` (`own/any`) | — | ✓ own | ✓ any | ✓ any |
| `booking.cancel` (`own/any`) | — | ✓ own | ✓ any | ✓ any |
| `booking.checkIn`, `booking.complete` (`any`) | — | — | ✓ | ✓ |
| `order.step` (`any`) | — | — | ✓ | ✓ |
| `booking.lateCards` (`own/any`) | — | ✓ own | ✓ any | ✓ any |
| `stats.read`, `audit.read` (`none`) | — | — | ✓ | ✓ |

`owner` được mọi hành động của `staff`; không seed tài khoản owner. Channel mặc định là `web`; `api.forChannel(channel)` tạo facade dùng chung storage/identity với channel khác.
- Đặt chỗ bắt buộc đăng nhập: guest gọi `create/payDeposit/cancel/checkIn/complete` nhận `UNAUTHORIZED`; guest vẫn đọc `seats.getMap()` và đặt nước. Mã khuyến mãi có điều kiện “đầu tiên” khi guest dùng trả `{ ok:false, error:'Cần đăng nhập để dùng mã này' }`.
- `src/domain/events.js`: `api.events.on(name, listener)` → hàm bỏ đăng ký; callback nhận `{ actor, targetId, ...data }`. Các sự kiện `order.created`, `order.cancelled`, `order.step_changed`, `booking.created`, `booking.deposit_paid`, `booking.late`, `booking.auto_cancelled`, `booking.cancelled`, `booking.seated`, `booking.completed`, `auth.login`, `auth.logout` chỉ phát sau khi lưu thành công. Listener đồng bộ hoặc bất đồng bộ ném lỗi đều được ghi log và không làm hỏng thao tác.
- Nhật ký lưu ở key `audit`, mỗi dòng `{ at, actor:{userId,role,channel}, action, targetId, ok, code? }`; giữ 500 dòng mới nhất theo thứ tự thời gian. Ghi cả từ chối `FORBIDDEN`/`UNAUTHORIZED` với `ok:false` và `code`. Lỗi đọc/ghi nhật ký không chặn thao tác. `api.audit.getRecent(limit=50)` chỉ staff/owner được đọc; giới hạn 1..500 và trả mới nhất trước.

### 3.12 Sổ năng lực chỉ đọc (v1.4)

`src/ai/capabilities.js` là mô-đun thuần, không DOM. Mỗi mục có `{ name, description, input, roles, risk:'read', handler(api,args,actor) }`. `run(name,args,actor)` kiểm tra policy, kiểm tra input trước handler và trả `{ type, data }`; lỗi dùng `ApiError` với `FORBIDDEN`, `UNAUTHORIZED`, `VALIDATION` hoặc `NOT_FOUND`. Mọi kết quả được lọc theo quyền trước khi trả.

| Năng lực | Đầu vào đã kiểm tra | Vai trò | Kết quả |
| --- | --- | --- | --- |
| `menu.search` | `{ query:string }`, 1–80 ký tự | Tất cả | `{ type:'menu.items', data:{ items } }` |
| `menu.recommend` | `{ preference?:string }`, tối đa 80 ký tự | Tất cả | `{ type:'menu.items', data:{ items } }` |
| `booking.availability` | `{ date:YYYY-MM-DD }` | Tất cả | `{ type:'booking.seats', data:{ seats } }` |
| `booking.mine` | `{}` | customer/staff/owner | `{ type:'booking.list', data:{ bookings } }` của actor |
| `order.mine` | `{}` | customer/staff/owner | `{ type:'order.list', data:{ orders } }` của actor |
| `order.status` | `{ id:string }` | customer/staff/owner | `{ type:'order.status', data:{ order } }` nếu sở hữu hoặc actor là staff/owner |
| `profile.me` | `{}` | customer/staff/owner | `{ type:'profile.me', data:{ profile } }` của actor |

Guest chỉ được dùng năng lực công khai về menu và sơ đồ. Năng lực cá nhân yêu cầu đăng nhập; khách không nhận dữ liệu thuộc người khác. V1.4 chưa nối capability vào giao diện chat và chưa có năng lực ghi.

### 3.1 `api.menu`

| Method                                               | Tham số | Trả về                                  | Lỗi                         | Pha                 |
| ---------------------------------------------------- | ------- | --------------------------------------- | --------------------------- | ------------------- |
| `getAll()`                                           | –       | `MenuItem[]` (sort theo Category.order) | —                           | P1                  |
| `getById(id)`                                        | id      | `MenuItem \| null`                      | —                           | P1                  |
| `getByCategory(categoryId)`                          | id      | `MenuItem[]`                            | `NOT_FOUND` nếu category lạ | P1                  |
| `getAvailable()`                                     | –       | `MenuItem[]` inStock                    | —                           | P1                  |
| `getOutOfStock()`                                    | –       | `MenuItem[]`                            | —                           | P1                  |
| `markInStock(id)` / `markOutOfStock(id)`             | id      | `MenuItem` (bản ghi sau update)         | `NOT_FOUND`                 | P1                  |
| `create(patch)` / `update(id, patch)` / `remove(id)` | —       | —                                       | —                           | P3 staff, phase sau |

### 3.2 `api.categories`

| `getAll()` → `Category[]` (sort `order`) | P1 |

### 3.3 `api.floors`

| `getAll()` → `Floor[]` · `getById(id)` → `Floor \| null` | P1 |

### 3.4 `api.seats` _( trạng thái ghế TÍNH từ danh sách booking tại `now` — v1.3 ✅)_

| Method                                                            | Tham số           | Trả về                                  | Lỗi        |
| ----------------------------------------------------------------- | ----------------- | --------------------------------------- | ---------- |
| `getAll()` · `getByFloor(floorId)` · `getById(id)`                 | –                 | `Seat[]` / `Seat \| null` (chỉ thuộc tính vật lý) | `NOT_FOUND` (getByFloor tầng lạ) |
| `getMap(date?, floorId?)`                                         | `YYYY-MM-DD`, tầng | `Seat[]` mỗi ghế kèm `status: 'available'\|'reserved'\|'booked'`, `bookingId`, `phase`; `reserved` = đã có người đặt cho ngày D nhưng CHƯA tới 00:00 — từ 00:00 → `booked`; tự sweep trước khi tính | |

| BỎ (v1.3)                                    | Lý do                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `book(id)` / `release(id)` / `resetAll()` / `getAvailable()` | Trạng thái ghế không còn là cờ lưu cứng — hóa đơn giữ bàn sống trong `bookings`, `getMap` suy ra mỗi lần đọc |

`syncFromBookings()` của legacy đã bị thay bằng nội bộ `bookings._sweep()` (v1.3: quét expired/no_show/day-closed, không đụng cờ ghế).

### 3.5 `api.cart` _(giỏ theo identity: `cart:<uid>` hoặc `cart:guest`)_

| Method                                  | Tham số      | Trả về                             | Lỗi                                                    | Pha                          |
| --------------------------------------- | ------------ | ---------------------------------- | ------------------------------------------------------ | ---------------------------- |
| `get()`                                 | –            | `CartItem[]`                       | —                                                      | P1                           |
| `add({itemId, size?, toppings?, qty?})` | xem §1       | `CartItem[]` mới                   | `VALIDATION` (itemId lạ, size lạ, topping lạ, qty sai) | P1 · **giá tính từ catalog** |
| `set(items)`                            | `CartItem[]` | `CartItem[]`                       | `VALIDATION`                                           | P1                           |
| `remove(itemId, size?)`                 | –            | `CartItem[]`                       | — (idempotent)                                         | P1                           |
| `clear()`                               | –            | `[]`                               | —                                                      | P1                           |
| `mergeGuestToUser(userId)`              | userId       | `CartItem[]` user cart mới         | —                                                      | P1                           |
| `subtotal()`                            | –            | `VND` (giá đã tính sẵn trong item) | —                                                      | P1                           |

Ghép item: cùng `itemId + size + JSON(toppings)` → tăng `qty`.

### 3.6 `api.orders`

| Method                                                              | Tham số                                 | Trả về                                      | Lỗi                                                                                | Pha                                                                                                        |
| ------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `create({items, address, phone, note?, customerName?, promoCode?})` | items=`[{itemId,size?,toppings?,qty?}]` | `Order` (`discount`, `promoCode` khi có mã) | `VALIDATION` (items rỗng, món lạ, thiếu địa chỉ/SĐT, mã khuyến mãi lỗi)            | P1 · **tính giá + tổng lại từ catalog, KHÔNG tin client** · v1.2: áp `promoCode` qua `promotions.evaluate` |
| `getById(id)` · `getCurrent()` · `setCurrent(order\|id\|null)`      | –                                       | `Order \| null`                             | —                                                                                  | P1                                                                                                         |
| `getByUser(userId)`                                                 | –                                       | `Order[]` (mới nhất cuối)                   | —                                                                                  | P1                                                                                                         |
| `getAll()`                                                          | –                                       | `Order[]`                                   | —                                                                                  | P1 (staff-filter P2)                                                                                       |
| `getActive()`                                                       | –                                       | `Order[]` status ∉ {completed, cancelled}   | —                                                                                  | P1                                                                                                         |
| `cancel(id)`                                                        | –                                       | `Order`                                     | `NOT_FOUND` · `CONFLICT` (đang giao: step≥2) · `FORBIDDEN` (đơn của người khác — **staff được hủy hộ**; guest chỉ hủy được đơn guest) | P1 · **vá bug legacy ai-cancel step≥2 (signoff #6)** · v1.2.1 chốt chính sách hủy |
| `updateStep(id, nextStep)`                                          | 0..4                                    | `Order`                                     | `NOT_FOUND` · `VALIDATION` (ngoài 0..4) · `CONFLICT` (lùi bước)                    | P1 · step 4 tự set completed                                                                               |
| `cancel_staff(...)`/bulk                                            | —                                       | —                                           | —                                                                                  | P2                                                                                                         |

### 3.7 `api.users` — **P2 ✅ thực thi v1.1**

`getAll/getById/getByPhone/getCurrent/create/update/seedDemo` đã thực thi.

- **Password/salt/hash KHÔNG BAO GIỜ xuất hiện** trong object trả về (`publicUser` lược lúc render).
- `update` chấp nhận whitelist `['name','address','email','birthday','phone']` — cố sửa `passwordHash/role/step…` → `VALIDATION`.
- `setCurrent` bị ĐÓNG (legacy) — session do `api.auth` quản lý (§3.10); `getCurrent` đọc theo identity.
- `role` luôn `'customer'` khi tạo công khai — legacy invite-code staff là lỗ hổng, đã đóng. Staff role được cấp qua seed/admin khi backend thật ra đời.

### 3.8 `api.promotions` / `api.bookings` / `api.staff` / `api.shifts` / `api.stats`

- `bookings.*` — **v1.3 ✅ LUẬT ĐẶT CHỖ MỚI** (hợp đồng kèm `docs/booking-policy-v1.3.md` · code thuần ở `src/domain/booking-rules.js`):
  - **Bản chất:** đặt chỗ = giữ chỗ. Mỗi bàn tối đa **1 booking hiệu lực MỖI NGÀY** (khóa cả ngày, không có
    thời lượng). `time` chỉ là giờ khách DỰ KIẾN đến (mốc +15'/+30'), KHÔNG dùng chống trùng.
  - **Máy trạng thái:** `pending_deposit --payDeposit→ confirmed --checkIn→ seated --complete→ completed`
    · `pending_deposit` quá 15' không trả cọc → `expired` (nhả bàn) · `confirmed` quá giờ đặt +30' chưa check-in
    → `no_show` (nhả bàn, `noShowCount++`, mất cọc) · `seated` qua ngày (quét) → `completed` ·
    `pending_deposit/confirmed/late --cancel→ cancelled`. `upcoming`/`late` là **pha tính từ `now`** (`bookings.phase`), không lưu.
  - **Cọc:** `ceil(capacity/2)` ly × `RULES.DEPOSIT_PER_DRINK` (35000 VND/ly, giá trị tạm — câu hỏi mở cố định hay theo menu);
    lưu VND tại thời điểm đặt. Phải trả cọc mới giữ được bàn; chờ tối đa 15' (`depositExpiresAt`) → `expired`.
  - **Hoàn cọc:** hủy trước 00:00 ngày D = 100%; từ 00:00 ngày D = `LATE_REFUND_RATE` (0%); hủy ở thẻ trễ / no-show = mất cọc. Trả booking kèm `refundAmount`.
  - **Trễ:** giờ đặt +15' → thẻ "đã trễ" (`bookings.getLateCards(userId?)` → `{type:'booking-late', data}` — UI tự vẽ; hủy ở thẻ mất cọc); +30' chưa check-in → tự hủy `no_show`, `noShowCount++` trên user.
  - **Seated:** giữ bàn KHÔNG giới hạn; chỉ khách hoặc nhân viên nhả (`complete`/`cancel` — seated → cancel bị `CONFLICT`).
  - **Giới hạn:** giờ mở `07:00–22:30` (`R.RULES.OPEN/CLOSE`) · đặt trước tối đa 30 ngày (`MAX_ADVANCE_DAYS`) · tối đa 3 booking hiệu lực/user (`MAX_ACTIVE_PER_USER`).
  - **Chữ ký (quyền theo §v1.3):**
    - `bookings.create({seatId,date,time,guests,note?})` → booking `pending_deposit` + `depositAmount` + `depositExpiresAt`. Guest trả `UNAUTHORIZED`; customer tạo cho mình. Lỗi khác: `VALIDATION`, `CONFLICT`.
    - `bookings.payDeposit(id)` — customer là chủ hoặc staff/owner thao tác hộ; guest `UNAUTHORIZED`; `pending_deposit` → `confirmed`. **DEMO: giả lập.**
    - `bookings.checkIn(id)` — staff/owner; customer và guest lần lượt nhận `FORBIDDEN`/`UNAUTHORIZED`.
    - `bookings.complete(id)` — staff/owner; customer và guest lần lượt nhận `FORBIDDEN`/`UNAUTHORIZED`.
    - `bookings.cancel(id)` — customer là chủ hoặc staff/owner thao tác hộ; guest `UNAUTHORIZED`; `seated` → `CONFLICT`; hủy ở phase `late`/`no_show` mất cọc.
    - `bookings.phase(b)` → `upcoming|late|...` tại `now()` (deterministic cho test).
    - `bookings.getLateCards(userId?)` → thẻ trễ đang hiệu lực (giữa +15' và +30').
    - `getAll/getById/getByUser` vẫn trả list — `_sweep()` chạy trước, đoán trạng thái chốt từ rooms đã quét.
  - **Booking shape bổ sung:** `depositAmount`, `depositPaid`, `depositPaidAt?`, `depositExpiresAt`, `refundAmount?`, `closedReason?`, `cancelledBy?`.
  - **Sự kiện (chờ lớp event trang sau):** `booking.created | deposit_paid | late | auto_cancelled | cancelled | seated | completed`.
  - **BỎ so v1.2:** `bookings.update` (đổi giờ/note — luật 1 booking/ngày làm dời giờ vô nghĩa; muốn khác giờ thì hủy đặt lại) · `getActiveBySeat` (suy ra từ `getMap`) · `seats.book/release/resetAll`.
- `promotions.getAll/getByCode/status/getActive/evaluate/create/remove` — **v1.2 ✅ thực thi**:
  - `status(p, today?)` → `'active' | 'upcoming' | 'expired' | 'off'` (`off` = `active:false`).
  - `evaluate(code, subtotal, shipping, userId)` → `{ ok:true, discount, promo }` hoặc `{ ok:false, error }` (không throw). Mã có điều kiện “đầu tiên” mà `userId` rỗng trả `{ok:false,error:'Cần đăng nhập để dùng mã này'}`; đã login thì đếm đơn không hủy của đúng user. Mã không yêu cầu tài khoản vẫn dùng được khi guest.
  - `create(data)` / `remove(code)` — `VALIDATION` (mã/format sai), `CONFLICT` (trùng mã).
- `orders.create` nhận thêm `promoCode?` — **facade tự evaluate + trừ vào total khi tính lại giá** (order lưu `discount`, `promoCode`; total = subtotal + shipping − discount). Mã lỗi → `VALIDATION` với message user-facing của evaluate.
- `staff.getAll/getById` — **v1.2 ✅** (đọc seed `staff`, shape `{id,name,role,phone,avatar}`). `staff.addFromUser` — **vẫn NOT_IMPLEMENTED** (cần quyền admin, P3).
- `shifts.getAll/getSchedule/addStaffToShift/removeStaffFromShift` — **v1.2 ✅**:
  - `getSchedule()` → `{ [date]: { [shiftId]: staffId[] } }`.
  - `addStaffToShift(date, shiftId, staffId)` → schedule mới; `VALIDATION` (ngày/giờ ca lạ), `CONFLICT` (đã có ca khác cùng ngày — luật legacy P2-6, hoặc đã nằm trong ca này).
  - `removeStaffFromShift(date, shiftId, staffId)` → schedule mới (idempotent khi không có).
- `stats.today/thisWeek/thisMonth/ordersByStatus/topItems/bookingsByStatus/occupancyRate` — **v1.2 ✅**:
  - `today()/thisWeek()/thisMonth()` → `{ total, count, completedCount, pendingCount }` — doanh thu **chỉ đếm đơn step≥4** (giữ FIX của legacy). **v1.2.1: doanh thu + completedCount tính theo `completedAt` (ngày HOÀN TẤT)** — trước đây theo `createdAt`, đơn đặt tối qua hoàn tất sáng nay bị bỏ sót khỏi "hôm nay". `count`/`pendingCount` vẫn theo ngày tạo.
  - `ordersByStatus` → `{pending,preparing,shipping,completed,cancelled}`; `topItems(limit=5)` → `[{name,qty,revenue}]`.
  - **v1.3:** `bookingsByStatus` → `{ pendingDeposit, confirmed, seated, completed, cancelled, expired, noShow }` (đếm theo `status` lưu — sweep chạy trước); `occupancyRate` → % ghế `booked` của `seats.getMap()` hôm nay (trạng thái tính từ bookings, không còn cờ lưu cứng).
  - "Hôm nay/tuần/tháng" theo `now()` inject của facade (deterministic cho test).

Tất cả method chưa đến pha: throw `ApiError('NOT_IMPLEMENTED', '<ns>.<method> hẹn pha P2/P3 — xem docs/api-contract.md')`.

### 3.9 `api.utils`

| Method             | Trả về                                                       |
| ------------------ | ------------------------------------------------------------ |
| `today()`          | `YYYY-MM-DD` giờ local                                       |
| `formatVND(n)`     | `n.toLocaleString('vi-VN') + 'đ'`                            |
| `SHIPPING_FEE`     | const `15000` (VND) — **đọc từ đây, không hard-code bên UI**  |
| `depositAmount(capacity)` — **v1.3** | VND cọc = `ceil(capacity/2)` ly × `DEPOSIT_PER_DRINK`, từ luật thuần (`R.depositAmount`) — UI (web/chat) đọc từ đây, không tự nhân giá |
| `DEPOSIT_PER_DRINK` — **v1.3** | const `35000` (VND/ly, giá trị tạm — câu hỏi mở: cố định hay theo menu). Cùng nguồn `R.RULES` |

> — `utils.depositAmount` là đường UI DUY NHẤT biết giá cọc; đổi giá cọc chỉ sửa `RULES.DEPOSIT_PER_DRINK` trong `src/domain/booking-rules.js`.

### 3.10 `api.auth` — **P2 ✅ thực thi v1.1**

| Method                   | Tham số | Trả về                                                                   | Lỗi            |
| ------------------------ | ------- | ------------------------------------------------------------------------ | -------------- |
| `login(phone, password)` |         | `user` (đã lược secret) · tạo session + **merge giỏ guest vào giỏ user** | `UNAUTHORIZED` |
| `current()`              | –       | `user \| null` (theo session)                                            | —              |
| `logout()`               | –       | `true`                                                                   | —              |

Session = `{ userId, at }` trong Storage — **không chứa user object / mật khẩu** (khác legacy session full-object).
Hash: PBKDF2-SHA256 150k iters (`src/core/hash.js`, WebCrypto zero-dep). Khi backend ra đời
chuyển argon2id server-side; chữ ký không đổi. Identity động ở mức browser hiện là
_demo-grade_ — người này có thể tự sửa session trong console; kế Biz thật bắt buộc đi qua backend phía server-side.

## §4. SNAPSHOT `exportAll()` / `importAll()` — HỢP ĐỒNG FORMAT LƯU TRỮ

```json
{
  "format": "cappan-snapshot",
  "version": 1,
  "exportedAt": "2026-10-29T...",
  "data": { "<key-internal>": <value> }
}
```

- `api.exportAll()` → snapshot ở trên (chính là "chuẩn xuất dữ liệu" prep-backend: JSON dump này map 1-1 sang bảng Postgres sau này).
- `api.importAll(snapshot, { replace = true })` → validate shape; sai shape throw `StorageError`; trả về số key đã import.
- `replace=false` = merge: key có sẵn được giữ nguyên, key chỉ có trong snapshot mới được set.

## §5. STORAGE KEY NAMESPACE

Toàn v2 dùng prefix `cappan:v2:` — tách biệt hoàn toàn bản legacy `cappan_*` (không đụng nhau khi demo cũ còn chạy song song).
Keys chuẩn: `meta:seeded`, `meta:contract`, `menu`, `categories`, `floors`, `seats`, `orders`, `current_order`, `cart:guest`, `cart:<uid>`, `bookings`, `users`, `session`, `promotions`, `staff`, `shifts`, `schedule`, `audit`.

## §6. CÂY THƯ MỤC V2 (chống lock-in)

```
cappan-v2/
├─ docs/api-contract.md        ← BẠN ĐANG ĐỌC — sự thật khảo sát chữ ký
├─ index.html                  (mỗi trang HTML 1 mục rollup input, vite tự quét)
├─ vite.config.mjs
├─ src/
│  ├─ entry-*.js               ← entry per-page (mỏng: nối page→api)
│  ├─ core/ errors.js storage.js
│  ├─ api/  index.js           ← facade async duy nhất pages được chạm
│  ├─ data/ schema.js seed.js
│  └─ styles/
└─ tests/ storage.test.mjs api.test.mjs
```

## §7. CHANGELOG HỢP ĐỒNG

| version | Ngày       | Thay đổi                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-10-29 | Khởi tạo: menu/categories/floors/seats(read) + cart + orders + utils + export/import = P1; users/promotions/bookings/staff/shifts/stats = P2, chữ ký bám legacy                                                                                                                                                                                                                                                                                                              |
| 1.1     | 2026-10-29 | **P2 thực thi:** identity sync (lib/identity) + `api.auth` (login/current/logout, PBKDF2) + `users.*` (hash, whitelist update, đóng setCurrent) + `bookings.*` (khóa ghế, conflict, sweep quá hạn) + `seats.book/release/resetAll`. Mở trang: menu/cart/auth. 4 mô-đun promotions/staff/shifts/stats vẫn NOT_IMPLEMENTED                                                                                                                                                  |
| 1.2     | 2026-10-29 | **P3 thực thi:** `promotions.*` (getAll/getByCode/status/getActive/evaluate/create/remove — luật legacy WELCOME10/FREESHIP/CAFE20) + `orders.create(promoCode)` tự trừ discount khi tính lại giá + `staff.*` (getAll/getById; addFromUser NOT_IMPLEMENTED chờ P3-admin) + `shifts.*` (schedule 7 ngày, CONFLICT 2 ca/ngày) + `stats.*` (today/thisWeek/thisMonth/ordersByStatus/topItems/bookingsByStatus/occupancyRate — doanh thu chỉ step≥4). Mở trang: cart(promo)/staff |
| 1.2.1   | 2026-10-29 | **Vá 8 bug (vòng mới trước khi lên v1.3):** chính sách hủy tập trung (`staff` hủy hộ khách — orders/bookings; guest chỉ với dữ liệu guest; trước đây staff bị `FORBIDDEN`, guest lọt guard) · `ensureSeeded`/`seedDemo` chống chạy song song (memo promise) · WELCOME10 "đầu tiên" áp cả guest (đếm đơn `userId=null`) · `stats` doanh thu/hoàn tất theo `completedAt` |
| 1.3     | 2026-10-29 | **Luật đặt chỗ v1.3:** đặt chỗ = giữ chỗ — 1 bàn 1 booking/ngày (khóa cả ngày); `pending_deposit` (cọc `ceil(capacity/2)` ly × 35k, chờ 15') → `confirmed` → `seated` → `completed`; mốc 00:00 ngày D = ranh giới hoàn cọc (100% → 0%) + `reserved`→`booked` trên sơ đồ; +15' thẻ trễ, +30' tự hủy `no_show` + `noShowCount++`; giờ mở 07:00–22:30, đặt trước ≤30 ngày, ≤3 booking hiệu lực/user; luật thuần `src/domain/booking-rules.js`; **bỏ `bookings.update`/`getActiveBySeat`/`seats.book|release|resetAll`, thêm `payDeposit/checkIn/phase/getLateCards/seats.getMap(date)`** |
| 1.3.1   | 2026-10-29 | **Quy tắc khách:** đặt chỗ yêu cầu đăng nhập; khách vẫn xem sơ đồ và đặt nước; mã khuyến mãi có điều kiện đơn đầu tiên yêu cầu tài khoản; giao diện không hiển thị mẫu đặt bàn cho khách chưa đăng nhập. |
| 1.4     | 2026-10-29 | **Bước 3 + nền Bước 4:** guest không được đặt chỗ; mã “đầu tiên” yêu cầu đăng nhập; policy tập trung cho `guest/customer/staff/owner` theo hành động+sở hữu; owner có quyền staff và thống kê tổng; actor có channel; event phát sau ghi; audit tối đa 500 dòng và lỗi audit/listener không chặn nghiệp vụ; sổ capability chỉ đọc gồm bảy mục, kiểm tra quyền/input và lọc dữ liệu. |
