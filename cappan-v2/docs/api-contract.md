# CAPPAN v2 — HỢP ĐỒNG DATA/API · CONTRACT v1.0

> **Đây là tài liệu BINDING.** Mọi thay đổi chữ ký (tên hàm, tham số, giá trị trả về, cách báo lỗi)
> PHẢI cập nhật tài liệu này + mục Changelog §7 **trước** khi sửa code.
> Test trong `tests/` là dạng chạy được của hợp đồng (executable specification) — con tract đổi mà test không theo là sai hợp đồng.

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
| `FORBIDDEN`       | 403                   | Giao crossing-identity (đơn của người khác)          |
| `UNAUTHORIZED`    | 401                   | Cần đăng nhập (P2)                                   |
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

### 3.4 `api.seats` _(mutation ghế do bookings điều phối)_

| Method                                                                                                 |
| ------------------------------------------------------------------------------------------------------ |
| `getAll()` · `getByFloor(floorId)` · `getById(id)` · `getAvailable()` — P1/P2 read-only ✅             |
| `book(id)` · `release(id)` · `resetAll()` — **P2 ✅ thực thi v1.1** (sự thật nguồn: `bookings` govern) |

`syncFromBookings()` của legacy bị thay bằng nội bộ `bookings._sweepPast()` (quét quá hạn → completed + trả ghế).

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
| `cancel(id)`                                                        | –                                       | `Order`                                     | `NOT_FOUND` · `CONFLICT` (đang giao: step≥2) · `FORBIDDEN` (đơn của identity khác) | P1 · **vá bug legacy ai-cancel step≥2 (signoff #6)**                                                       |
| `updateStep(id, nextStep)`                                          | 0..4                                    | `Order`                                     | `NOT_FOUND` · `VALIDATION` (ngoài 0..4) · `CONFLICT` (lùi bước)                    | P1 · step 4 tự set completed                                                                               |
| `cancel_staff(...)`/bulk                                            | —                                       | —                                           | —                                                                                  | P2                                                                                                         |

### 3.7 `api.users` — **P2 ✅ thực thi v1.1**

`getAll/getById/getByPhone/getCurrent/create/update/seedDemo` đã thực thi.

- **Password/salt/hash KHÔNG BAO GIỜ xuất hiện** trong object trả về (`publicUser` lược lúc render).
- `update` chấp nhận whitelist `['name','address','email','birthday','phone']` — cố sửa `passwordHash/role/step…` → `VALIDATION`.
- `setCurrent` bị ĐÓNG (legacy) — session do `api.auth` quản lý (§3.10); `getCurrent` đọc theo identity.
- `role` luôn `'customer'` khi tạo công khai — legacy invite-code staff là lỗ hổng, đã đóng. Staff role được cấp qua seed/admin khi backend thật ra đời.

### 3.8 `api.promotions` / `api.bookings` / `api.staff` / `api.shifts` / `api.stats`

- `bookings.create/getAll/getById/getByUser/getActiveBySeat/complete/cancel/update` — **P2 ✅ thực thi v1.1**:
  kỹ thuật: `create` khóa ghế ngay (`seats.book`), conflict trùng seat+date+time → `CONFLICT`,
  giới hạn 3 đặt chỗ hiệu lực/user, quá hạn tự `_sweepPast` (completed + trả ghế).
- `promotions.getAll/getByCode/status/getActive/evaluate/create/remove` — **v1.2 ✅ thực thi**:
  - `status(p, today?)` → `'active' | 'upcoming' | 'expired' | 'off'` (`off` = `active:false`).
  - `evaluate(code, subtotal, shipping, userId)` → `{ ok:true, discount, promo }` hoặc `{ ok:false, error }` (PROMISE-style như legacy, KHÔNG throw — caller tự quyết). Luật copy legacy: minOrder · mã "đầu tiên" (terms chứa "đầu tiên" + user đã có đơn không-hủy) · `%` có cap `maxDiscount` · mã ship/giao hàng (FREESHIP) giảm tối đa = `shipping` · clamp `0..subtotal+shipping`.
  - `create(data)` / `remove(code)` — `VALIDATION` (mã/format sai), `CONFLICT` (trùng mã).
- `orders.create` nhận thêm `promoCode?` — **facade tự evaluate + trừ vào total khi tính lại giá** (order lưu `discount`, `promoCode`; total = subtotal + shipping − discount). Mã lỗi → `VALIDATION` với message user-facing của evaluate.
- `staff.getAll/getById` — **v1.2 ✅** (đọc seed `staff`, shape `{id,name,role,phone,avatar}`). `staff.addFromUser` — **vẫn NOT_IMPLEMENTED** (cần quyền admin, P3).
- `shifts.getAll/getSchedule/addStaffToShift/removeStaffFromShift` — **v1.2 ✅**:
  - `getSchedule()` → `{ [date]: { [shiftId]: staffId[] } }`.
  - `addStaffToShift(date, shiftId, staffId)` → schedule mới; `VALIDATION` (ngày/giờ ca lạ), `CONFLICT` (đã có ca khác cùng ngày — luật legacy P2-6, hoặc đã nằm trong ca này).
  - `removeStaffFromShift(date, shiftId, staffId)` → schedule mới (idempotent khi không có).
- `stats.today/thisWeek/thisMonth/ordersByStatus/topItems/bookingsByStatus/occupancyRate` — **v1.2 ✅**:
  - `today()/thisWeek()/thisMonth()` → `{ total, count, completedCount, pendingCount }` — doanh thu **chỉ đếm đơn step≥4** (giữ FIX của legacy); count gồm mọi đơn chưa hủy trong khoảng.
  - `ordersByStatus` → `{pending,preparing,shipping,completed,cancelled}`; `topItems(limit=5)` → `[{name,qty,revenue}]`; `bookingsByStatus`; `occupancyRate` → % ghế booked.
  - "Hôm nay/tuần/tháng" theo `now()` inject của facade (deterministic cho test).

Tất cả method chưa đến pha: throw `ApiError('NOT_IMPLEMENTED', '<ns>.<method> hẹn pha P2/P3 — xem docs/api-contract.md')`.

### 3.9 `api.utils`

| Method         | Trả về                                                       |
| -------------- | ------------------------------------------------------------ |
| `today()`      | `YYYY-MM-DD` giờ local                                       |
| `formatVND(n)` | `n.toLocaleString('vi-VN') + 'đ'`                            |
| `SHIPPING_FEE` | const `15000` (VND) — **đọc từ đây, không hard-code bên UI** |

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
Keys chuẩn: `meta:seeded`, `meta:contract`, `menu`, `categories`, `floors`, `seats`, `orders`, `current_order`, `cart:guest`, `cart:<uid>`, `bookings`, `users`, `session`, `promotions`, `staff`, `shifts`, `schedule`.

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
| 1.1     | 2026-10-29 | **P2 thực thi:** identity sync (lib/identity) + `api.auth` (login/current/logout, PBKDF2) + `users.*` (hash, whitelist update, đóng setCurrent) + `bookings.*` (khóa ghế, conflict, sweep quá hạn) + `seats.book/release/resetAll`. Mở trang: menu/cart/auth. Zéro mô-đun promotions/staff/shifts/stats vẫn NOT_IMPLEMENTED                                                                                                                                                  |
| 1.2     | 2026-10-29 | **P3 thực thi:** `promotions.*` (getAll/getByCode/status/getActive/evaluate/create/remove — luật legacy WELCOME10/FREESHIP/CAFE20) + `orders.create(promoCode)` tự trừ discount khi tính lại giá + `staff.*` (getAll/getById; addFromUser NOT_IMPLEMENTED chờ P3-admin) + `shifts.*` (schedule 7 ngày, CONFLICT 2 ca/ngày) + `stats.*` (today/thisWeek/thisMonth/ordersByStatus/topItems/bookingsByStatus/occupancyRate — doanh thu chỉ step≥4). Mở trang: cart(promo)/staff |
