/* ============================================================
   CAPPAN v2 — API FACADE (docs/api-contract.md §3)

   Lớp duy nhất mà page/UI được chạm. ASYNC tuyệt đối.
   Hữu hình hôm nay: storage (localStorage/memory).
   Mai hình sau: HTTP transport — CHỈ nội dung hàm bên trong thay,
   chữ ký + hợp đồng + tests giữ nguyên.

   Nguyên tắc sống còn của nền móng:
   • Tính lại giá từ catalog ở mọi mutation (§0.7) — chống client-spoof.
   • Không nuốt lỗi (§0.8) — mọi lỗi dội lên là ApiError có code.
   • Reader đơn lẻ trả null (§3.0), mutator throw NOT_FOUND.
   ============================================================ */
import { ApiError } from '../core/errors.js';
import { ORDER_EXPRESS, CANCEL_MAX_STEP, SHIPPING_FEE, ID_PREFIX } from '../data/schema.js';
import { hashPassword, verifyPassword } from '../core/hash.js';

const CONTRACT_VERSION = '1.2';
const KEYS = {
  seeded: 'meta:seeded',
  contract: 'meta:contract',
  menu: 'menu',
  categories: 'categories',
  floors: 'floors',
  seats: 'seats',
  orders: 'orders',
  currentOrder: 'current_order',
  users: 'users',
  bookings: 'bookings',
  session: 'session',
  promotions: 'promotions',
  staff: 'staff',
  shifts: 'shifts',
  schedule: 'schedule'
};

export function createApi({
  storage,
  seed = {},
  identity = () => null, // () => userId | null — cắm auth thật vào đây ở P2
  now = () => new Date()
} = {}) {
  if (!storage) throw new Error('createApi: thiếu storage');

  const uid = () => identity() || 'guest';
  const iso = () => now().toISOString();
  const today = () => {
    const d = now();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // local YYYY-MM-DD (§0.5)
  };

  /* ---------- helpers ---------- */
  const list = async (key, seedValue = []) => storage.get(key, seedValue) || [];

  /* Chống chạy song song (bug #6): nhiều reader mở cùng Promise.all → cùng 1 lần ensureSeeded
     trượt nhịp có thể nhân đôi dữ liệu demo. Memo promise: mọi caller chờ chung 1 lần chạy;
     nếu lần chạy lỗi thì xóa memo để lần sau chạy lại. */
  const once = (fn) => {
    let p = null;
    return (...args) => {
      if (!p) p = Promise.resolve(fn(...args)).catch((e) => {
        p = null;
        throw e;
      });
      return p;
    };
  };

  /* Chính sách sở hữu/khai thác (bug #1 — vá cục bộ; bước 3 sẽ tập trung hóa thành bảng vai trò×hành động cho CHAT-OS):
     • owner: row.userId === identity() → được hủy/chỉnh.
     • staff (users[identity].role === 'staff'): được thao tác HỘ khách — trước đây staff hủy
       đơn/booking của khách bị FORBIDDEN dù trang staff gọi chính xác.
     • guest (chưa đăng nhập): chỉ được chạm vào row KHÔNG có chủ (userId=null, tạo khi guest) —
       trước đây guest "lọt" qua guard `o.userId && identity()` và hủy được đơn của người đã login. */
  const isStaff = async () => {
    const id = identity();
    if (!id) return false;
    return (await list(KEYS.users)).find((u) => u.id === id)?.role === 'staff';
  };
  const canTouch = async (row) => !row.userId || row.userId === identity() || (await isStaff());

  let seedDemoRun = null; /* memo promise chạy seedDemo — dùng trong users.seedDemo (bug #6) */

  const notImplemented = (ns, method) => async () => {
    throw new ApiError(
      'NOT_IMPLEMENTED',
      `${ns}.${method} — hẹn pha P2/P3, xem docs/api-contract.md`
    );
  };

  const ensureSeeded = once(async () => {
    /* v1.2: seed bổ sung namespace MỚI ngay cả khi store đã seed từ v1.1
       (storage cũ không có promotions/staff/shifts → bồi đủ, không xóa dữ liệu người dùng) */
    if (!(await storage.get(KEYS.promotions))) {
      await storage.set(KEYS.promotions, seed.promotions || []);
    }
    if (!(await storage.get(KEYS.staff))) {
      await storage.set(KEYS.staff, seed.staff || []);
    }
    if (!(await storage.get(KEYS.shifts))) {
      await storage.set(KEYS.shifts, seed.shifts || []);
    }
    if (
      (await storage.get(KEYS.schedule)) === null ||
      (await storage.get(KEYS.schedule)) === undefined
    ) {
      await storage.set(KEYS.schedule, {});
    }
    /* v1.2 demo migration: tài khoản seed "Nhân viên Demo" (0900000002) create từ v1.1 mang role
       customer — nâng lên staff để demo hub. User tự đăng ký KHÔNG bao giờ bị đụng tới. */
    const userRows = (await storage.get(KEYS.users)) || [];
    const demoStaff = userRows.find((u) => u.phone === '0900000002' && u.role !== 'staff');
    if (demoStaff) {
      demoStaff.role = 'staff';
      await storage.set(KEYS.users, userRows);
    }
    if (await storage.get(KEYS.seeded)) return;
    await storage.set(KEYS.menu, seed.menu || []);
    await storage.set(KEYS.categories, seed.categories || []);
    await storage.set(KEYS.floors, seed.floors || []);
    await storage.set(KEYS.seats, seed.seats || []);
    await storage.set(KEYS.orders, []);
    await storage.set(KEYS.seeded, { at: iso(), contract: CONTRACT_VERSION });
  });

  const newId = (prefix) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  /* Tính giá 1 dòng từ CATALOG (§0.7 — không tin giá client) */
  function priceLine(item, input) {
    /* món KHÔNG khai báo sizes (trà đậm đặc…) → bỏ qua validate size, nhãn chỉ để khóa dòng ghép;
       món CÓ sizes → size gửi lên phải nằm trong danh sách, dù client gửi hay 'remembered' */
    const hasSizes = (item.sizes || []).length > 0;
    const sizeName = input.size || (item.sizes?.[0]?.name ?? 'M');
    const size = sizeName ? (item.sizes || []).find((s) => s.name === sizeName) : undefined;
    if (hasSizes && !size) {
      throw new ApiError('VALIDATION', `Size "${input.size}" không tồn tại cho món ${item.id}`, {
        itemId: item.id,
        size: input.size
      });
    }

    const availableToppings = new Map((item.toppings || []).map((t) => [t.name, t]));
    const toppings = (input.toppings || []).map((tName) => {
      const t = availableToppings.get(tName);
      if (!t)
        throw new ApiError('VALIDATION', `Topping "${tName}" không tồn tại cho món ${item.id}`, {
          itemId: item.id,
          topping: tName
        });
      return { name: t.name, price: t.price };
    });

    const qty = Math.floor(Number(input.qty === undefined ? 1 : input.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new ApiError('VALIDATION', `Qty không hợp lệ: ${input.qty}`, {
        itemId: item.id,
        qty: input.qty
      });
    }

    const sizeExtra = size?.extraPrice || 0;
    const unitPrice = item.price + sizeExtra + toppings.reduce((s, t) => s + t.price, 0);
    return {
      itemId: item.id,
      name: item.name,
      price: unitPrice, // giá đơn vị ĐÃ gồm size+topping (đơn giản hơn legacy ~price+sizeExtra rải rác)
      img: item.img || '',
      size: sizeName,
      sizeExtra,
      toppings,
      qty
    };
  }

  /* ---------- menu ---------- */
  const menu = {
    async getAll() {
      await ensureSeeded();
      const rows = await list(KEYS.menu);
      const catOrder = new Map((await list(KEYS.categories)).map((c) => [c.id, c.order]));
      return rows.sort(
        (a, b) => (catOrder.get(a.categoryId) ?? 99) - (catOrder.get(b.categoryId) ?? 99)
      );
    },
    async getById(id) {
      return (await list(KEYS.menu)).find((m) => m.id === id) || null;
    },
    async getByCategory(categoryId) {
      if (!(await list(KEYS.categories)).some((c) => c.id === categoryId)) {
        throw new ApiError('NOT_FOUND', `Nhóm "${categoryId}" không tồn tại`);
      }
      return (await menu.getAll()).filter((m) => m.categoryId === categoryId);
    },
    async getAvailable() {
      return (await menu.getAll()).filter((m) => m.inStock);
    },
    async getOutOfStock() {
      return (await menu.getAll()).filter((m) => !m.inStock);
    },
    async markInStock(id) {
      return menu._setStock(id, true);
    },
    async markOutOfStock(id) {
      return menu._setStock(id, false);
    },
    async _setStock(id, inStock) {
      await ensureSeeded();
      const rows = await list(KEYS.menu);
      const m = rows.find((r) => r.id === id);
      if (!m) throw new ApiError('NOT_FOUND', `Món "${id}" không tồn tại`);
      m.inStock = inStock;
      await storage.set(KEYS.menu, rows);
      return m;
    }
  };

  const categories = {
    async getAll() {
      await ensureSeeded();
      return (await list(KEYS.categories)).sort((a, b) => a.order - b.order);
    }
  };
  const floors = {
    async getAll() {
      await ensureSeeded();
      return list(KEYS.floors);
    },
    async getById(id) {
      return (await floors.getAll()).find((f) => f.id === id) || null;
    }
  };

  const seats = {
    async getAll() {
      await ensureSeeded();
      return list(KEYS.seats);
    },
    async getById(id) {
      return (await seats.getAll()).find((s) => s.id === id) || null;
    },
    async getByFloor(floorId) {
      if (!(await floors.getById(floorId)))
        throw new ApiError('NOT_FOUND', `Tầng "${floorId}" không tồn tại`);
      return (await seats.getAll()).filter((s) => s.floorId === floorId);
    },
    async getAvailable() {
      return (await seats.getAll()).filter((s) => s.status === 'available');
    },
    /* mutation ghế — P2 ✅ (§3.4): quản lý state bởi bookings {@link bookings} */
    async _setStatus(id, status) {
      await ensureSeeded();
      const rows = await list(KEYS.seats);
      const s = rows.find((r) => r.id === id);
      if (!s) throw new ApiError('NOT_FOUND', `Ghế "${id}" không tồn tại`);
      s.status = status;
      await storage.set(KEYS.seats, rows);
      return s;
    },
    async book(id) {
      return seats._setStatus(id, 'booked');
    },
    async release(id) {
      return seats._setStatus(id, 'available');
    },
    async resetAll() {
      await ensureSeeded();
      const rows = await list(KEYS.seats);
      rows.forEach((s) => (s.status = 'available'));
      await storage.set(KEYS.seats, rows);
      return rows;
    }
  };

  /* ---------- cart (theo identity: cart:<uid> | cart:guest) ---------- */
  const cartKey = () => `cart:${uid()}`;
  const cart = {
    async get() {
      await ensureSeeded();
      return list(cartKey());
    },
    async add(input) {
      await ensureSeeded();
      const item = await menu.getById(input?.itemId);
      if (!item)
        throw new ApiError('VALIDATION', `Món "${input?.itemId}" không tồn tại`, {
          itemId: input?.itemId
        });
      const line = priceLine(item, input || {});

      const rows = await cart.get();
      const same = (l) =>
        l.itemId === line.itemId &&
        l.size === line.size &&
        JSON.stringify(l.toppings.map((t) => t.name)) ===
          JSON.stringify(line.toppings.map((t) => t.name));
      const dup = rows.find(same);
      if (dup) dup.qty += line.qty;
      else rows.push(line);
      await storage.set(cartKey(), rows);
      return rows;
    },
    async set(items) {
      await ensureSeeded();
      if (!Array.isArray(items)) throw new ApiError('VALIDATION', 'set(items): items phải là mảng');
      const rows = [];
      for (const it of items) {
        const item = await menu.getById(it?.itemId);
        if (!item) throw new ApiError('VALIDATION', `Món "${it?.itemId}" không tồn tại`);
        rows.push(priceLine(item, it)); // set cũng chuẩn hóa giá — giữ bất biến "giỏ luôn là giá catalog"
      }
      await storage.set(cartKey(), rows);
      return rows;
    },
    async remove(itemId, size) {
      const rows = (await cart.get()).filter(
        (l) => !(l.itemId === itemId && (size === undefined || l.size === size))
      );
      await storage.set(cartKey(), rows);
      return rows;
    },
    async clear() {
      await storage.set(cartKey(), []);
      return [];
    },
    async subtotal() {
      return (await cart.get()).reduce((s, l) => s + l.price * l.qty, 0);
    },
    async mergeGuestToUser(userId) {
      const guestRows = await list('cart:guest');
      if (!guestRows.length) return list(`cart:${userId}`);
      const merged = [...(await list(`cart:${userId}`))];
      for (const g of guestRows) {
        const dup = merged.find(
          (l) =>
            l.itemId === g.itemId &&
            l.size === g.size &&
            JSON.stringify(l.toppings.map((t) => t.name)) ===
              JSON.stringify(g.toppings.map((t) => t.name))
        );
        if (dup) dup.qty += g.qty;
        else merged.push({ ...g });
      }
      await storage.set(`cart:${userId}`, merged);
      await storage.set('cart:guest', []);
      return merged;
    }
  };

  /* ---------- orders ---------- */
  const orders = {
    async create(data) {
      await ensureSeeded();
      const input = data || {};
      if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new ApiError('VALIDATION', 'Đơn phải có ít nhất 1 món', { field: 'items' });
      }
      const issues = {};
      if (!input.address || !String(input.address).trim()) issues.address = 'Bắt buộc';
      if (!input.phone || !/^[0-9+\s.-]{8,15}$/.test(String(input.phone)))
        issues.phone = 'SĐT không hợp lệ (VD 0901234567)';
      if (Object.keys(issues).length)
        throw new ApiError('VALIDATION', 'Đơn thiếu thông tin giao hàng', issues);

      const items = [];
      for (const it of input.items) {
        const item = await menu.getById(it?.itemId);
        if (!item) throw new ApiError('VALIDATION', `Món "${it?.itemId}" không tồn tại`);
        items.push(priceLine(item, it));
      }
      const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
      /* v1.2: promoCode do FACADE evaluate — discount không bao giờ đến từ client */
      let discount = 0;
      let promoCode = '';
      if (input.promoCode) {
        const ev = await promotions.evaluate(input.promoCode, subtotal, SHIPPING_FEE, identity());
        if (!ev.ok) throw new ApiError('VALIDATION', ev.error, { field: 'promoCode' });
        discount = ev.discount;
        promoCode = ev.promo.code;
      }
      const total = subtotal + SHIPPING_FEE - discount;

      const order = {
        id: newId(ID_PREFIX.order),
        userId: identity(),
        customerName: input.customerName || 'Khách',
        items,
        subtotal,
        shipping: SHIPPING_FEE,
        discount,
        promoCode,
        total,
        address: String(input.address).trim(),
        phone: String(input.phone).trim(),
        note: input.note ? String(input.note).trim() : '',
        status: 'pending',
        step: 0,
        createdAt: iso(),
        updatedAt: iso()
      };
      const rows = await list(KEYS.orders);
      rows.push(order);
      await storage.set(KEYS.orders, rows);
      return order;
    },

    async getById(id) {
      return (await list(KEYS.orders)).find((o) => o.id === id) || null;
    },
    async getByUser(userId) {
      return (await list(KEYS.orders))
        .filter((o) => o.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async getAll() {
      return list(KEYS.orders);
    },
    async getActive() {
      return (await orders.getAll()).filter(
        (o) => o.status !== 'completed' && o.status !== 'cancelled'
      );
    },
    async getCurrent() {
      return (await storage.get(KEYS.currentOrder)) || null;
    },
    async setCurrent(order) {
      if (order === null) return storage.set(KEYS.currentOrder, null);
      const id = typeof order === 'string' ? order : order?.id;
      const full = await orders.getById(id);
      if (!full) throw new ApiError('NOT_FOUND', `Đơn "${id}" không tồn tại`);
      return storage.set(KEYS.currentOrder, full);
    },

    async cancel(id) {
      const o = await orders._must(id);
      if (!(await canTouch(o))) {
        throw new ApiError('FORBIDDEN', 'Đơn này của người dùng khác'); // §3.6 — staff được hủy hộ; guest (chưa login) chỉ hủy được đơn guest (userId=null)
      }
      if (o.status === 'cancelled') throw new ApiError('CONFLICT', `Đơn ${id} đã hủy trước đó`);
      if (o.step > CANCEL_MAX_STEP) {
        // BUG legacy (docs/signoff-report.md #6): khách hủy được đơn đang giao. Cấm step > CANCEL_MAX_STEP (=1).
        throw new ApiError(
          'CONFLICT',
          `Đơn ${id} bước "${ORDER_EXPRESS.steps[o.step]}" — không hủy được, gọi hotline để can thiệp`
        );
      }
      o.status = 'cancelled';
      o.step = -1;
      o.cancelledAt = iso();
      o.updatedAt = iso();
      return orders._saveRow(o);
    },

    async updateStep(id, nextStep) {
      const o = await orders._must(id);
      const step = Number(nextStep);
      if (!Number.isInteger(step) || step < 0 || step > 4 || (o.step >= 0 && step < o.step)) {
        throw new ApiError('VALIDATION', `Step phải nguyên 0..4 và KHÔNG lùi (hiện ${o.step})`, {
          current: o.step,
          next: step
        });
      }
      if (o.status === 'cancelled') throw new ApiError('CONFLICT', `Đơn ${id} đã hủy`);
      o.step = step;
      o.status = ORDER_EXPRESS.statusByStep[step];
      if (step === 4) o.completedAt = iso();
      o.updatedAt = iso();
      if (o.status === 'completed') orders._completeBookings(o.id).catch(() => {}); // no-op P1
      return orders._saveRow(o);
    },

    /* nội bộ: bắt buộc có + chưa hoàn tất */
    async _must(id) {
      const o = (await list(KEYS.orders)).find((r) => r.id === id);
      if (!o) throw new ApiError('NOT_FOUND', `Đơn "${id}" không tồn tại`);
      return o;
    },
    async _saveRow(row) {
      const rows = await list(KEYS.orders);
      const i = rows.findIndex((r) => r.id === row.id);
      if (i < 0) throw new ApiError('NOT_FOUND', `Đơn "${row.id}" không tồn tại`);
      rows[i] = row;
      await storage.set(KEYS.orders, rows);
      if ((await storage.get(KEYS.currentOrder))?.id === row.id)
        await storage.set(KEYS.currentOrder, row);
      return row;
    },
    async _completeBookings() {
      return null;
    } /* hook P2 */
  };

  /* ---------- bookings (P2 — §3.8, thực thi v1.1) ---------- */
  const BK_LIMIT = { maxActive: 3 }; // giữ luật legacy: tối đa 3 đặt chỗ hiệu lực mỗi user
  const bookings = {
    /* quét quá hạn: confirmed đã qua hôm nay → completed + trả ghế */
    async _sweepPast() {
      await ensureSeeded();
      const t = today();
      const rows = await list(KEYS.bookings);
      let changed = false;
      const freed = new Set();
      for (const b of rows) {
        if (b.status === 'confirmed' && b.date < t) {
          b.status = 'completed';
          b.completedAt = iso();
          freed.add(b.seatId);
          changed = true;
        }
      }
      if (changed) {
        await storage.set(KEYS.bookings, rows);
        const seatRows = await list(KEYS.seats);
        for (const s of seatRows)
          if (freed.has(s.id) && s.status === 'booked') s.status = 'available';
        await storage.set(KEYS.seats, seatRows);
      }
    },
    async create(data) {
      await bookings._sweepPast();
      const input = data || {};
      const seat = await seats.getById(input.seatId);
      if (!seat) throw new ApiError('NOT_FOUND', `Ghế "${input.seatId}" không tồn tại`);
      const guests = Math.floor(Number(input.guests === undefined ? 2 : input.guests)); // legacy mặc định 2 khách
      if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
        throw new ApiError('VALIDATION', 'Số khách phải nguyên 1..20', {
          field: 'guests',
          guests: input.guests
        });
      }
      if (guests > seat.capacity) {
        throw new ApiError('VALIDATION', `Bàn ${seat.id} chỉ chứa tối đa ${seat.capacity} khách`, {
          field: 'guests',
          capacity: seat.capacity
        });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) {
        throw new ApiError('VALIDATION', 'Ngày phải dạng YYYY-MM-DD', { field: 'date' });
      }
      if (input.date < today())
        throw new ApiError('VALIDATION', 'Không đặt chỗ cho ngày quá khứ', { field: 'date' });
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(input.time || ''))) {
        throw new ApiError('VALIDATION', 'Giờ phải dạng HH:MM', { field: 'time' });
      }
      const clash = (await bookings.getAll()).some(
        (b) =>
          b.seatId === input.seatId &&
          b.date === input.date &&
          b.time === input.time &&
          b.status === 'confirmed'
      );
      if (clash)
        throw new ApiError(
          'CONFLICT',
          `Bàn ${seat.id} khung giờ ${input.time} ngày ${input.date} đã có người đặt`
        );
      const uidv = identity();
      if (uidv) {
        const mine = (await bookings.getByUser(uidv)).filter((b) => b.status === 'confirmed');
        if (mine.length >= BK_LIMIT.maxActive)
          throw new ApiError(
            'CONFLICT',
            `Tối đa ${BK_LIMIT.maxActive} đặt chỗ đang hiệu lực mỗi người`
          );
      }
      const bk = {
        id: newId(ID_PREFIX.booking),
        userId: uidv,
        seatId: seat.id,
        floorId: seat.floorId,
        date: input.date,
        time: input.time,
        guests,
        note: input.note ? String(input.note).trim() : '',
        status: 'confirmed',
        createdAt: iso()
      };
      const rows = await list(KEYS.bookings);
      rows.push(bk);
      await storage.set(KEYS.bookings, rows);
      await seats.book(seat.id);
      return bk;
    },
    async getAll() {
      await bookings._sweepPast();
      return (await list(KEYS.bookings)).sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      );
    },
    async getById(id) {
      return (await bookings.getAll()).find((b) => b.id === id) || null;
    },
    async getByUser(userId) {
      return (await bookings.getAll()).filter((b) => b.userId === userId);
    },
    async getActiveBySeat(seatId) {
      const t = today();
      return (
        (await bookings.getAll()).find(
          (b) => b.seatId === seatId && b.status === 'confirmed' && b.date >= t
        ) || null
      );
    },
    async _must(id) {
      const b = await bookings.getById(id);
      if (!b) throw new ApiError('NOT_FOUND', `Đặt chỗ "${id}" không tồn tại`);
      return b;
    },
    async _saveRow(row) {
      const rows = await list(KEYS.bookings);
      const i = rows.findIndex((r) => r.id === row.id);
      if (i < 0) throw new ApiError('NOT_FOUND', `Đặt chỗ "${row.id}" không tồn tại`);
      rows[i] = row;
      await storage.set(KEYS.bookings, rows);
      return row;
    },
    async complete(id) {
      const b = await bookings._must(id);
      if (b.status !== 'confirmed')
        throw new ApiError('CONFLICT', `Đặt chỗ ${id} không ở trạng thái confirmed`);
      b.status = 'completed';
      b.completedAt = iso();
      await bookings._saveRow(b);
      await seats.release(b.seatId);
      return b;
    },
    async cancel(id) {
      const b = await bookings._must(id);
      if (!(await canTouch(b))) {
        throw new ApiError('FORBIDDEN', 'Đặt chỗ này của người dùng khác'); // staff được hủy hộ; guest chỉ hủy được booking guest
      }
      if (b.status !== 'confirmed')
        throw new ApiError('CONFLICT', `Đặt chỗ ${id} không còn hiệu lực`);
      b.status = 'cancelled';
      b.cancelledAt = iso();
      await bookings._saveRow(b);
      await seats.release(b.seatId);
      return b;
    },
    async update(id, patch) {
      const b = await bookings._must(id);
      if (b.status !== 'confirmed')
        throw new ApiError('CONFLICT', `Đặt chỗ ${id} không còn hiệu lực`);
      if (!(await canTouch(b)))
        throw new ApiError('FORBIDDEN', 'Đặt chỗ này của người dùng khác'); // staff được sửa hộ; guest chỉ với booking guest
      const input = patch || {};
      if (input.time !== undefined) {
        if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(input.time))) {
          throw new ApiError('VALIDATION', 'Giờ phải dạng HH:MM', { field: 'time' });
        }
        const clash = (await bookings.getAll()).some(
          (x) =>
            x.seatId === b.seatId &&
            x.date === b.date &&
            x.time === input.time &&
            x.status === 'confirmed' &&
            x.id !== b.id
        );
        if (clash)
          throw new ApiError('CONFLICT', `Bàn ${b.seatId} khung giờ ${input.time} đã có người đặt`);
        b.time = input.time;
      }
      if (input.guests !== undefined) {
        const seat = await seats.getById(b.seatId);
        const g = Math.floor(Number(input.guests));
        if (!Number.isInteger(g) || g < 1 || g > 20)
          throw new ApiError('VALIDATION', 'Số khách 1..20', { field: 'guests' });
        if (g > seat.capacity)
          throw new ApiError(
            'VALIDATION',
            `Bàn ${b.seatId} chỉ chứa tối đa ${seat.capacity} khách`,
            { field: 'guests' }
          );
        b.guests = g;
      }
      if (input.note !== undefined) b.note = String(input.note).trim();
      return bookings._saveRow(b);
    }
  };

  /* ---------- users + auth (P2 — §3.7/§3.10, thực thi v1.1) ----------
     Mật khẩu: PBKDF2-SHA256 (src/core/hash.js) — hết thời plaintext legacy.
     Session chỉ lưu {userId} — không còn full object chứa mật khẩu như legacy.
     Register công khai CHỈ tạo 'customer' — invite-code staff của legacy là
     lỗ hổng (docs/signoff-report.md), vai trò staff không cấp qua form này. */
  const publicUser = (u) => {
    if (!u) return null;
    const { passwordHash, salt, ...pub } = u;
    return pub;
  };
  const users = {
    async getAll() {
      await ensureSeeded();
      return (await list(KEYS.users)).map(publicUser);
    },
    async getById(id) {
      return publicUser((await list(KEYS.users)).find((u) => u.id === id) || null);
    },
    async getByPhone(phone) {
      const p = String(phone || '').trim();
      return publicUser((await list(KEYS.users)).find((u) => u.phone === p) || null);
    },
    async create(data) {
      await ensureSeeded();
      const input = data || {};
      const issues = {};
      if (!input.name || !String(input.name).trim()) issues.name = 'Bắt buộc';
      if (!/^[0-9+\s.-]{8,15}$/.test(String(input.phone || '')))
        issues.phone = 'SĐT không hợp lệ (VD 0901234567)';
      if (typeof input.password !== 'string' || input.password.length < 6)
        issues.password = 'Tối thiểu 6 ký tự';
      if (Object.keys(issues).length)
        throw new ApiError('VALIDATION', 'Dữ liệu đăng ký không hợp lệ', issues);
      if (await users.getByPhone(input.phone))
        throw new ApiError('CONFLICT', `SĐT ${input.phone} đã có tài khoản`);
      const { salt, hash } = await hashPassword(input.password);
      const user = {
        id: newId('U'),
        name: String(input.name).trim(),
        phone: String(input.phone).trim(),
        role: 'customer',
        email: input.email ? String(input.email).trim() : '',
        address: input.address ? String(input.address).trim() : '',
        birthday: '',
        joinedAt: iso(),
        noShowCount: 0,
        salt,
        passwordHash: hash
      };
      const rows = await list(KEYS.users);
      rows.push(user);
      await storage.set(KEYS.users, rows);
      return publicUser(user);
    },
    async update(id, patch) {
      const rows = await list(KEYS.users);
      const u = rows.find((r) => r.id === id);
      if (!u) throw new ApiError('NOT_FOUND', `Người dùng "${id}" không tồn tại`);
      const ALLOWED = ['name', 'address', 'email', 'birthday', 'phone'];
      for (const k of Object.keys(patch || {})) {
        if (!ALLOWED.includes(k))
          throw new ApiError('VALIDATION', `Không được sửa "${k}" qua users.update`, { field: k });
        if (k === 'phone') {
          const dup = await users.getByPhone(patch[k]);
          if (dup && dup.id !== id)
            throw new ApiError('CONFLICT', `SĐT ${patch[k]} đã có tài khoản`);
        }
        u[k] = patch[k];
      }
      await storage.set(KEYS.users, rows);
      return publicUser(u);
    },
    async getCurrent() {
      const id = identity();
      return id ? users.getById(id) : null;
    },
    /* legacy API.users.setCurrent ngừng hỗ trợ — session do api.auth quản lý (§3.10) */
    setCurrent: notImplemented('users', 'setCurrent'),
    /* bug #6: chống chạy song song — 2 trang cùng gọi seedDemo lọt cả hai ở lần chạy đầu
       (cùng thấy rows rỗng → nhân đôi user demo). Memo promise trong 1 lần chạy; khi xong
       xóa memo, lần gọi sau đếm lại và trả 0 — giữ đúng nghĩa trả về "đã tạo thêm mấy". */
    async seedDemo() {
      let run = seedDemoRun;
      if (run) {
        await run;
        return 0; // người thắng cuộc đã tạo đủ — lượt này không tạo gì thêm
      }
      run = (async () => {
        await ensureSeeded(); // nằm TRÊN lần chạy chung: seed + body không tách nhịp
        const rows = await list(KEYS.users);
        if (rows.length) return 0;
        await users.create({ name: 'Khách Demo', phone: '0900000001', password: 'cappan123' });
        const staffUser = await users.create({
          name: 'Nhân viên Demo',
          phone: '0900000002',
          password: 'cappan123'
        });
        /* demo-grade: role staff cấp qua seed (+ghi DECISIONS.md) — production cấp qua backend admin */
        const all = await list(KEYS.users);
        const row = all.find((u) => u.id === staffUser.id);
        row.role = 'staff';
        await storage.set(KEYS.users, all);
        return 2;
      })();
      seedDemoRun = run;
      try {
        return await run;
      } finally {
        seedDemoRun = null;
      }
    }
  };

  const auth = {
    async current() {
      const s = await storage.get(KEYS.session);
      return s?.userId ? users.getById(s.userId) : null;
    },
    async login(phone, password) {
      const p = String(phone || '').trim();
      const u = (await list(KEYS.users)).find((x) => x.phone === p);
      const ok = u ? await verifyPassword(password, { salt: u.salt, hash: u.passwordHash }) : false;
      if (!u || !ok) throw new ApiError('UNAUTHORIZED', 'SĐT hoặc mật khẩu không đúng');
      await storage.set(KEYS.session, { userId: u.id, at: iso() });
      await cart.mergeGuestToUser(u.id); // giỏ guest nhập vào giỏ user (như legacy)
      return publicUser(u);
    },
    async logout() {
      await storage.set(KEYS.session, null);
      return true;
    }
  };

  /* ---------- promotions (P3 — v1.2, luật copy legacy js/api/index.js) ---------- */
  const promotions = {
    async getAll() {
      await ensureSeeded();
      return list(KEYS.promotions);
    },
    async getByCode(code) {
      const c = String(code || '')
        .toUpperCase()
        .trim();
      return (await promotions.getAll()).find((p) => p.code === c) || null;
    },
    /* 'active' | 'upcoming' | 'expired' | 'off' */
    async status(p, todayValue) {
      const d = todayValue || today();
      if (!p.active) return 'off';
      if (p.startDate && d < p.startDate) return 'upcoming';
      if (p.endDate && d > p.endDate) return 'expired';
      return 'active';
    },
    async getActive(todayValue) {
      const all = await promotions.getAll();
      const out = [];
      for (const p of all) if ((await promotions.status(p, todayValue)) === 'active') out.push(p);
      return out;
    },
    /* Kiểm tra & tính giảm giá cho 1 mã. Trả { ok, discount, promo } hoặc { ok:false, error }
       — PROMISE-style như legacy (không throw), caller (UI hoặc orders.create) tự quyết. */
    async evaluate(code, subtotalInput, shippingInput, userId) {
      const subtotal = Number(subtotalInput) || 0;
      const shipping = Number(shippingInput) || 0;
      const p = await promotions.getByCode(code);
      if (!p) return { ok: false, error: 'Mã khuyến mãi không tồn tại' };
      const st = await promotions.status(p);
      if (st !== 'active') {
        return {
          ok: false,
          error:
            st === 'upcoming'
              ? 'Mã chưa đến thời gian áp dụng'
              : st === 'expired'
                ? 'Mã đã hết hạn'
                : 'Mã đang tạm tắt'
        };
      }
      if (p.minOrder && subtotal < p.minOrder) {
        return {
          ok: false,
          error: 'Đơn tối thiểu ' + p.minOrder.toLocaleString('vi-VN') + 'đ mới dùng được mã này'
        };
      }
      if (/đầu tiên/i.test(p.terms || '')) {
        /* bug #7: guest (userId null) cũng bị giới hạn — trước đây mệnh đề `&& userId`
           cho phép khách vãng lai dùng WELCOME10 vô hạn. Lịch sử guest = mọi đơn
           userId=null trong store (demo: store là của 1 trình duyệt). */
        const uidv = userId || null;
        const history = (await list(KEYS.orders)).filter(
          (o) => o.status !== 'cancelled' && (uidv ? o.userId === uidv : !o.userId)
        );
        if (history.length) return { ok: false, error: 'Mã chỉ dành cho đơn hàng đầu tiên' };
      }
      const d = String(p.discount || '');
      let discount = 0;
      if (d.includes('%')) {
        discount = Math.round(subtotal * ((parseFloat(d) || 0) / 100));
        if (p.maxDiscount) discount = Math.min(discount, p.maxDiscount);
      } else {
        discount = parseInt(d.replace(/\D/g, ''), 10) || 0;
      }
      if (/ship|giao hàng/i.test((p.name || '') + ' ' + (p.description || '')))
        discount = Math.min(discount || shipping, shipping);
      discount = Math.max(0, Math.min(discount, subtotal + shipping));
      return { ok: true, discount, promo: p };
    },
    /* create/remove — admin-level, hợp đồng v1.2 (UI quản promo thuộc P3-admin, chưa mở trang) */
    async create(data) {
      await ensureSeeded();
      const input = data || {};
      const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      const p = {
        code: String(input.code || '')
          .toUpperCase()
          .replace(/\s+/g, ''),
        name: String(input.name || '').trim(),
        description: String(input.description || '').trim(),
        discount: String(input.discount || '').trim(),
        minOrder: num(input.minOrder),
        active: input.active !== false,
        startDate: input.startDate || '',
        endDate: input.endDate || '',
        terms: String(input.terms || '').trim()
      };
      const max = num(input.maxDiscount);
      if (max) p.maxDiscount = max;
      if (!p.code || !/^[A-Z0-9_-]{3,20}$/.test(p.code)) {
        throw new ApiError('VALIDATION', 'Mã chỉ gồm chữ/số/gạch (3–20 ký tự)', { field: 'code' });
      }
      if (!p.name)
        throw new ApiError('VALIDATION', 'Vui lòng nhập tên chương trình', { field: 'name' });
      if (!p.discount)
        throw new ApiError('VALIDATION', 'Vui lòng nhập mức giảm (VD: 10% hoặc 20.000đ)', {
          field: 'discount'
        });
      if (p.startDate && p.endDate && p.endDate < p.startDate) {
        throw new ApiError('VALIDATION', 'Ngày kết thúc phải sau ngày bắt đầu', {
          field: 'endDate'
        });
      }
      const rows = await list(KEYS.promotions);
      if (rows.some((x) => x.code === p.code))
        throw new ApiError('CONFLICT', `Mã ${p.code} đã tồn tại`);
      rows.push(p);
      await storage.set(KEYS.promotions, rows);
      return p;
    },
    async remove(code) {
      const p = await promotions.getByCode(code);
      if (!p) throw new ApiError('NOT_FOUND', `Mã "${code}" không tồn tại`);
      const rows = (await list(KEYS.promotions)).filter((x) => x.code !== p.code);
      await storage.set(KEYS.promotions, rows);
      return true;
    }
  };

  /* ---------- staff (P3 — v1.2; addFromUser Chờ P3-admin vì cần quyền) ---------- */
  const staff = {
    async getAll() {
      await ensureSeeded();
      return list(KEYS.staff);
    },
    async getById(id) {
      return (await staff.getAll()).find((s) => s.id === id) || null;
    },
    addFromUser: notImplemented('staff', 'addFromUser') /* cần quyền admin — P3 */
  };

  /* ---------- shifts (P3 — v1.2): lịch date → shiftId → staffId[] ---------- */
  const shifts = {
    async getAll() {
      await ensureSeeded();
      return list(KEYS.shifts);
    },
    async getById(id) {
      return (await shifts.getAll()).find((s) => s.id === id) || null;
    },
    async getSchedule() {
      await ensureSeeded();
      return (await storage.get(KEYS.schedule)) || {};
    },
    async _saveSchedule(s) {
      await storage.set(KEYS.schedule, s);
      return s;
    },
    async addStaffToShift(date, shiftId, staffId) {
      await ensureSeeded();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
        throw new ApiError('VALIDATION', 'Ngày phải dạng YYYY-MM-DD', { field: 'date' });
      }
      if (!(await shifts.getById(shiftId)))
        throw new ApiError('NOT_FOUND', `Ca "${shiftId}" không tồn tại`);
      if (!(await staff.getById(staffId)))
        throw new ApiError('NOT_FOUND', `Nhân viên "${staffId}" không tồn tại`);
      const s = await shifts.getSchedule();
      s[date] = s[date] || {};
      /* luật legacy P2-6: 1 nhân viên tối đa 1 ca/ngày */
      const busy = Object.keys(s[date]).find(
        (sid) => sid !== shiftId && s[date][sid].includes(staffId)
      );
      if (busy) throw new ApiError('CONFLICT', `${staffId} đã có ca ${busy} ngày ${date}`);
      s[date][shiftId] = s[date][shiftId] || [];
      if (s[date][shiftId].includes(staffId))
        throw new ApiError('CONFLICT', `${staffId} đã nằm trong ca ${shiftId} ngày ${date}`);
      s[date][shiftId].push(staffId);
      return shifts._saveSchedule(s);
    },
    async removeStaffFromShift(date, shiftId, staffId) {
      const s = await shifts.getSchedule();
      if (s[date]?.[shiftId]) s[date][shiftId] = s[date][shiftId].filter((x) => x !== staffId);
      return shifts._saveSchedule(s);
    }
  };

  /* ---------- stats (P3 — v1.2): doanh thu CHỈ tính đơn step≥4 (giữ FIX legacy) ---------- */
  const stats = {
    async _revenueInRange(fromTs, toTs) {
      const inRange = (t) => t >= fromTs && t <= toTs;
      const rows = await list(KEYS.orders);
      /* tạo (không hủy) trong khoảng → count + pending */
      const created = rows.filter(
        (o) => o.status !== 'cancelled' && inRange(new Date(o.createdAt).getTime())
      );
      /* bug #8: doanh thu/hoàn tất tính theo NGÀY HOÀN TẤT (completedAt), không phải createdAt —
         đơn đặt 23:59 tối qua, hoàn tất 00:05 sáng nay phải vào doanh thu HÔM NAY (doanh thu = tiền thu được hôm đó) */
      const completed = rows.filter(
        (o) => o.step >= 4 && o.completedAt && inRange(new Date(o.completedAt).getTime())
      );
      return {
        total: completed.reduce((s, o) => s + o.total, 0),
        count: created.length,
        completedCount: completed.length,
        pendingCount: created.filter((o) => o.step < 4).length
      };
    },
    _dayStart(d) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    },
    async today() {
      const n = now();
      return stats._revenueInRange(stats._dayStart(n), n.getTime());
    },
    async thisWeek() {
      const n = now();
      const day = n.getDay();
      const monday = new Date(n);
      monday.setDate(n.getDate() - day + (day === 0 ? -6 : 1));
      return stats._revenueInRange(stats._dayStart(monday), n.getTime());
    },
    async thisMonth() {
      const n = now();
      const first = new Date(n.getFullYear(), n.getMonth(), 1);
      return stats._revenueInRange(stats._dayStart(first), n.getTime());
    },
    async ordersByStatus() {
      const rows = (await list(KEYS.orders)).filter((o) => o.status !== 'cancelled');
      return {
        pending: rows.filter((o) => o.step === 0).length,
        preparing: rows.filter((o) => o.step === 1).length,
        shipping: rows.filter((o) => o.step === 2 || o.step === 3).length,
        completed: rows.filter((o) => o.step >= 4).length,
        cancelled: (await list(KEYS.orders)).filter((o) => o.status === 'cancelled').length
      };
    },
    async topItems(limit = 5) {
      const map = new Map();
      for (const o of await list(KEYS.orders)) {
        if (o.status === 'cancelled') continue;
        for (const it of o.items) {
          const cur = map.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
          cur.qty += it.qty;
          cur.revenue += it.price * it.qty;
          map.set(it.name, cur);
        }
      }
      return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
    },
    async bookingsByStatus() {
      const rows = await bookings.getAll();
      return {
        confirmed: rows.filter((b) => b.status === 'confirmed').length,
        completed: rows.filter((b) => b.status === 'completed').length,
        cancelled: rows.filter((b) => b.status === 'cancelled').length
      };
    },
    async occupancyRate() {
      const rows = await seats.getAll();
      const booked = rows.filter((s) => s.status === 'booked').length;
      return rows.length ? Math.round((booked / rows.length) * 100) : 0;
    }
  };

  const aPI = {
    meta: { contract: CONTRACT_VERSION },
    menu,
    categories,
    floors,
    seats,
    cart,
    orders,
    users,
    auth,
    promotions,
    bookings,
    staff,
    shifts,
    stats,
    utils: { today, formatVND: (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`, SHIPPING_FEE },
    /* §4 — snapshot: "dump chuẩn" prep-backend */
    async exportAll() {
      await ensureSeeded();
      const snap = await storage.exportAll();
      return { ...snap, contract: CONTRACT_VERSION };
    },
    async importAll(snapshot, opts) {
      const count = await storage.importAll(snapshot, opts);
      await storage.set(KEYS.contract, CONTRACT_VERSION);
      return count;
    }
  };
  return aPI;
}
