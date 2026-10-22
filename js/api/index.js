/* ============================================================
   API GIẢ — MÔ PHỎNG BACKEND (ĐÃ FIX LỖI LOGIC)
============================================================ */

/* Bản chụp khuyến mãi mặc định — chỉ dùng để nạp lần đầu */
const _PROMO_SEED = (typeof SEED_PROMOTIONS !== 'undefined' ? SEED_PROMOTIONS : []).map(p => ({ ...p }));
/* Bản chụp menu gốc */
const _MENU_BASE = (typeof SEED_MENU_ITEMS !== 'undefined' ? SEED_MENU_ITEMS : []).map(m => ({ ...m }));

const API = {

  /* ---------- USERS ---------- */
  users: {
    getAll() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]'); }
      catch { return []; }
    },
    getById(id) { return this.getAll().find(u => u.id === id) || null; },
    getByPhone(p) { return this.getAll().find(u => u.phone === p) || null; },
    getCurrent() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || 'null'); }
      catch { return null; }
    },
    setCurrent(u) {
      if (u) localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_KEYS.currentUser);
    },
    create(data) {
      const list = this.getAll();
      const user = {
        id: 'U' + String(list.length + 1).padStart(3, '0'),
        name: data.name,
        phone: data.phone,
        password: data.password,
        role: data.role || 'customer',
        email: data.email || '',
        address: data.address || '',
        birthday: data.birthday || '',
        joinedAt: new Date().toISOString(),
        noShowCount: 0
      };
      list.push(user);
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(list));
      return user;
    },
    update(id, patch) {
      const list = this.getAll();
      const i = list.findIndex(u => u.id === id);
      if (i === -1) return null;
      list[i] = { ...list[i], ...patch };
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(list));
      const cur = this.getCurrent();
      if (cur && cur.id === id) this.setCurrent(list[i]);
      return list[i];
    },
    seedDemo() {
      if (this.getAll().length > 0) return;
      const demo = [
        { id:'U001', name:'Khách Demo', phone:'0900000001', password:'123', role:'customer', joinedAt:new Date().toISOString(), noShowCount:0 },
        { id:'U002', name:'Nhân viên Demo', phone:'0900000002', password:'123', role:'staff', joinedAt:new Date().toISOString(), noShowCount:0 }
      ];
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(demo));
    }
  },

  /* ---------- CATEGORIES ---------- */
  categories: {
    getAll() { return [...SEED_CATEGORIES].sort((a,b) => a.order - b.order); },
    getById(id) { return SEED_CATEGORIES.find(c => c.id === id) || null; }
  },

    /* ---------- MENU ---------- */
  menu: {
    // ⚡ FIX 4.3: cache in-memory với epoch counter
    _cache: null,
    _epoch: 0,
    _epochAtBuild: -1,

    _invalidate() {
      this._cache = null;
      this._epochAtBuild = -1;
    },

    _getStateMap() {
      try { return JSON.parse(localStorage.getItem('cappan_menu_state') || '{}'); }
      catch { return {}; }
    },
    _setStateMap(map) { localStorage.setItem('cappan_menu_state', JSON.stringify(map)); },

    _read(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
      } catch { return fallback; }
    },
    _custom()    { const v = this._read('cappan_menu_custom', []);    return Array.isArray(v) ? v : []; },
    _removed()   { const v = this._read('cappan_menu_removed', []);   return Array.isArray(v) ? v : []; },
    _overrides() { const v = this._read('cappan_menu_overrides', {}); return (v && typeof v === 'object') ? v : {}; },

    _syncSeed() {
      if (typeof SEED_MENU_ITEMS === 'undefined') return;
      const all = this.getAll();
      SEED_MENU_ITEMS.length = 0;
      all.forEach(m => SEED_MENU_ITEMS.push(m));
    },

    /* ⚡ Cache hit nếu epoch chưa đổi kể từ lần build trước */
    getAll() {
      if (this._cache && this._epochAtBuild === this._epoch) {
        return this._cache;
      }

      const stateMap = this._getStateMap();
      const removed = this._removed();
      const overrides = this._overrides();
      const custom = this._custom();

      const result = [..._MENU_BASE, ...custom]
        .filter(m => !removed.includes(m.id))
        .map(m => {
          const merged = { ...m, ...(overrides[m.id] || {}) };
          merged.inStock = stateMap[m.id] !== undefined ? stateMap[m.id] : merged.inStock;
          return merged;
        });

      this._cache = result;
      this._epochAtBuild = this._epoch;
      return result;
    },

    getById(id) { return this.getAll().find(m => m.id === id) || null; },
    getByCategory(catId) { return this.getAll().filter(m => m.categoryId === catId); },
    getAvailable() { return this.getAll().filter(m => m.inStock); },
    getOutOfStock() { return this.getAll().filter(m => !m.inStock); },

    search(kw) {
      const k = String(kw || '').toLowerCase().trim();
      if (!k) return this.getAll();
      return this.getAll().filter(m => m.name.toLowerCase().includes(k));
    },

    markOutOfStock(id) {
      const map = this._getStateMap();
      map[id] = false;
      this._setStateMap(map);
      this._epoch++;                    // ⚡ bump epoch
      this._invalidate();                // ⚡ xoá cache
      return this.getById(id);
    },

    markInStock(id) {
      const map = this._getStateMap();
      map[id] = true;
      this._setStateMap(map);
      this._epoch++;
      this._invalidate();
      return this.getById(id);
    },

    add(item) {
      const newItem = {
        id: 'M' + Date.now().toString().slice(-6),
        name: item.name,
        categoryId: item.categoryId,
        price: item.price,
        img: item.img || 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=600',
        description: item.description || '',
        badge: item.badge || '',
        inStock: true,
        sizes: item.sizes || [],
        toppings: item.toppings || []
      };
      const custom = this._custom();
      custom.push(newItem);
      localStorage.setItem('cappan_menu_custom', JSON.stringify(custom));
      this._epoch++;
      this._invalidate();
      this._syncSeed();
      return newItem;
    },

    update(id, patch) {
      const exists = this.getById(id);
      if (!exists) return null;
      const safe = { ...patch };
      delete safe.id;
      const custom = this._custom();
      const ci = custom.findIndex(m => m.id === id);
      if (ci >= 0) {
        custom[ci] = { ...custom[ci], ...safe };
        localStorage.setItem('cappan_menu_custom', JSON.stringify(custom));
      } else {
        const ov = this._overrides();
        ov[id] = { ...(ov[id] || {}), ...safe };
        localStorage.setItem('cappan_menu_overrides', JSON.stringify(ov));
      }
      this._epoch++;
      this._invalidate();
      this._syncSeed();
      return this.getById(id);
    },

    remove(id) {
      if (!this.getById(id)) return false;
      const custom = this._custom();
      const ci = custom.findIndex(m => m.id === id);
      if (ci >= 0) {
        custom.splice(ci, 1);
        localStorage.setItem('cappan_menu_custom', JSON.stringify(custom));
      } else {
        const removed = this._removed();
        if (!removed.includes(id)) removed.push(id);
        localStorage.setItem('cappan_menu_removed', JSON.stringify(removed));
      }
      const map = this._getStateMap();
      delete map[id];
      this._setStateMap(map);
      const ov = this._overrides();
      delete ov[id];
      localStorage.setItem('cappan_menu_overrides', JSON.stringify(ov));
      this._epoch++;
      this._invalidate();
      this._syncSeed();
      return true;
    }
  },

  /* ---------- PROMOTIONS (quản lý trên giao diện staff) ---------- */
  promotions: {
    KEY: 'cappan_promotions',

    _save(list) {
      localStorage.setItem(this.KEY, JSON.stringify(list));
      this._sync(list);
    },

    /* Giữ SEED_PROMOTIONS khớp dữ liệu thật (cho trang nào còn đọc trực tiếp) */
    _sync(list) {
      if (typeof SEED_PROMOTIONS === 'undefined') return;
      const src = list || this.getAll();
      SEED_PROMOTIONS.length = 0;
      src.forEach(p => SEED_PROMOTIONS.push(p));
    },

    getAll() {
      try {
        const raw = localStorage.getItem(this.KEY);
        if (raw === null) {                      // lần đầu: nạp mã mặc định
          const seed = _PROMO_SEED.map(p => ({ ...p }));
          localStorage.setItem(this.KEY, JSON.stringify(seed));
          return seed;
        }
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    },

    getByCode(code) {
      const c = String(code || '').toUpperCase().trim();
      return this.getAll().find(p => p.code === c) || null;
    },

    /* 'active' | 'upcoming' | 'expired' | 'off' */
    status(p, today) {
      const d = today || API.utils.today();
      if (!p.active) return 'off';
      if (p.startDate && d < p.startDate) return 'upcoming';
      if (p.endDate && d > p.endDate) return 'expired';
      return 'active';
    },

    getActive(today)   { return this.getAll().filter(p => this.status(p, today) === 'active'); },

    /* Kiểm tra & tính giảm giá cho 1 mã. Trả { ok, discount, promo } hoặc { ok:false, error } */
    evaluate(code, subtotal, shipping, userId) {
      const p = this.getByCode(code);
      if (!p) return { ok: false, error: 'Mã khuyến mãi không tồn tại' };
      const st = this.status(p);
      if (st !== 'active') {
        return { ok: false, error: st === 'upcoming' ? 'Mã chưa đến thời gian áp dụng' : st === 'expired' ? 'Mã đã hết hạn' : 'Mã đang tạm tắt' };
      }
      if (p.minOrder && subtotal < p.minOrder) {
        return { ok: false, error: 'Đơn tối thiểu ' + API.utils.formatVND(p.minOrder) + ' mới dùng được mã này' };
      }
      if (/đầu tiên/i.test(p.terms || '') && userId &&
          API.orders.getByUser(userId).some(o => o.status !== 'cancelled')) {
        return { ok: false, error: 'Mã chỉ dành cho đơn hàng đầu tiên' };
      }
      const d = String(p.discount || '');
      let discount = 0;
      if (d.includes('%')) {
        discount = Math.round(subtotal * (parseFloat(d) || 0) / 100);
        if (p.maxDiscount) discount = Math.min(discount, p.maxDiscount);
      } else {
        discount = parseInt(d.replace(/\D/g, ''), 10) || 0;
      }
      if (/ship|giao hàng/i.test((p.name || '') + ' ' + (p.description || ''))) discount = Math.min(discount || shipping, shipping);
      discount = Math.max(0, Math.min(discount, subtotal + shipping));
      return { ok: true, discount, promo: p };
    },
    getUpcoming(today) { return this.getAll().filter(p => this.status(p, today) === 'upcoming'); },

    _normalize(data) {
      const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
      const out = {
        code: String(data.code || '').toUpperCase().replace(/\s+/g, ''),
        name: String(data.name || '').trim(),
        description: String(data.description || '').trim(),
        discount: String(data.discount || '').trim(),
        minOrder: num(data.minOrder),
        active: data.active !== false,
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        terms: String(data.terms || '').trim()
      };
      const max = num(data.maxDiscount);
      if (max) out.maxDiscount = max;
      return out;
    },

    _validate(p) {
      if (!p.code) return 'Vui lòng nhập mã khuyến mãi';
      if (!/^[A-Z0-9_-]{3,20}$/.test(p.code)) return 'Mã chỉ gồm chữ/số/gạch (3–20 ký tự)';
      if (!p.name) return 'Vui lòng nhập tên chương trình';
      if (!p.discount) return 'Vui lòng nhập mức giảm (VD: 10% hoặc 20.000đ)';
      if (p.startDate && p.endDate && p.endDate < p.startDate) return 'Ngày kết thúc phải sau ngày bắt đầu';
      return null;
    },

    add(data) {
      const p = this._normalize(data);
      const err = this._validate(p);
      if (err) return { ok: false, error: err };
      const list = this.getAll();
      if (list.some(x => x.code === p.code)) return { ok: false, error: `Mã ${p.code} đã tồn tại` };
      list.push(p);
      this._save(list);
      return { ok: true, promo: p };
    },

    update(code, data) {
      const list = this.getAll();
      const i = list.findIndex(x => x.code === String(code).toUpperCase());
      if (i === -1) return { ok: false, error: 'Không tìm thấy mã khuyến mãi' };
      const p = this._normalize({ ...list[i], ...data, code: list[i].code });
      const err = this._validate(p);
      if (err) return { ok: false, error: err };
      list[i] = p;
      this._save(list);
      return { ok: true, promo: p };
    },

    remove(code) {
      const c = String(code).toUpperCase();
      const list = this.getAll();
      const next = list.filter(x => x.code !== c);
      if (next.length === list.length) return false;
      this._save(next);
      return true;
    }
  },

  /* ---------- FLOORS ---------- */
  floors: {
    getAll() { return SEED_FLOORS; },
    getById(id) { return SEED_FLOORS.find(f => f.id === id) || null; }
  },

  /* ---------- SEATS ---------- */
  seats: {
    _getStateMap() {
      try {
        const saved = JSON.parse(localStorage.getItem('cappan_seats_state') || '{}');
        if (Array.isArray(saved)) {
          const map = {};
          saved.forEach(s => {
            if (s.id && s.status === 'booked') map[s.id] = 'booked';
          });
          localStorage.setItem('cappan_seats_state', JSON.stringify(map));
          return map;
        }
        return (saved && typeof saved === 'object') ? saved : {};
      } catch (e) {
        console.warn('Lỗi đọc seats state:', e);
        return {};
      }
    },

    _setStateMap(map) {
      localStorage.setItem('cappan_seats_state', JSON.stringify(map));
    },

    syncFromBookings() {
      const map = this._getStateMap();
      const bookings = API.bookings.getAll();
      const activeSeatIds = bookings
        .filter(b => b.status === 'confirmed')
        .map(b => b.seatId);

      Object.keys(map).forEach(seatId => {
        if (map[seatId] === 'booked' && !activeSeatIds.includes(seatId)) {
          delete map[seatId];
        }
      });

      activeSeatIds.forEach(seatId => {
        map[seatId] = 'booked';
      });

      this._setStateMap(map);
      return map;
    },

    getAll() {
      const map = this._getStateMap();
      return SEED_SEATS.map(s => ({
        ...s,
        status: map[s.id] || 'available'
      }));
    },

    getById(id) {
      const found = this.getAll().find(s => s.id === id);
      return found || null;
    },

    getByFloor(fId) {
      return this.getAll().filter(s => s.floorId === fId);
    },

    getAvailable() {
      return this.getAll().filter(s => s.status === 'available');
    },

    getBooked() {
      return this.getAll().filter(s => s.status === 'booked');
    },

    book(id) {
      const map = this._getStateMap();
      map[id] = 'booked';
      this._setStateMap(map);
      return this.getById(id);
    },

    release(id) {
      const map = this._getStateMap();
      map[id] = 'available';
      this._setStateMap(map);
      return this.getById(id);
    },

    releaseAll() {
      this._setStateMap({});
    },

    releaseByFloor(floorId) {
      const map = this._getStateMap();
      SEED_SEATS.filter(s => s.floorId === floorId).forEach(s => {
        delete map[s.id];
      });
      this._setStateMap(map);
    },

    resetToDefault() {
      localStorage.removeItem('cappan_seats_state');
    },

    /* Hoàn tất các booking đang hoạt động thỏa điều kiện, trả về số booking */
    _completeActive(filterFn) {
      const active = API.bookings.getAll().filter(b => b.status === 'confirmed' && filterFn(b));
      active.forEach(b => API.bookings.complete(b.id));
      return active.length;
    },

    /* Reset 1 chỗ: hoàn tất booking đang giữ chỗ rồi trả ghế */
    resetSeat(id) {
      const n = this._completeActive(b => b.seatId === id);
      this.release(id);
      this.syncFromBookings();
      return n;
    },

    resetByFloor(floorId) {
      const ids = SEED_SEATS.filter(s => s.floorId === floorId).map(s => s.id);
      const n = this._completeActive(b => ids.includes(b.seatId));
      this.releaseByFloor(floorId);
      this.syncFromBookings();
      return n;
    },

    resetAll() {
      const n = this._completeActive(() => true);
      this.releaseAll();
      this.syncFromBookings();
      return n;
    }
  },

  /* ---------- BOOKINGS ---------- */
  bookings: {
    getAll() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.bookings) || '[]');
      } catch { return []; }
    },

    getByUser(uid) {
      return this.getAll().filter(b => b.userId === uid);
    },

    getBySeat(sid) {
      return this.getAll().filter(b => b.seatId === sid);
    },

    getActiveBySeat(sid) {
      return this.getAll().find(b => b.seatId === sid && b.status === 'confirmed') || null;
    },

    create(data) {
  // ⚡ P1-3: Validate seat trước khi tạo booking (chặn double-booking)
  const seat = API.seats.getById(data.seatId);
  if (!seat) { console.warn('[bookings.create] Seat không tồn tại:', data.seatId); return null; }
  if (seat.status !== 'available') { console.warn('[bookings.create] Seat đã được đặt:', data.seatId); return null; }

  const list = this.getAll();
  const bk = {
    id: 'BK' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: data.userId,
    seatId: data.seatId,
    floorId: data.floorId,
    date: data.date,
    time: data.time,
    guests: data.guests || 2,
    note: data.note || '',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };
  list.push(bk);
  localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(list));

  API.seats.book(data.seatId);
  API.seats.syncFromBookings();

  return bk;
},

    cancel(id) {
      const list = this.getAll();
      const i = list.findIndex(b => b.id === id);
      if (i === -1) return null;
      list[i].status = 'cancelled';
      localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(list));

      API.seats.release(list[i].seatId);
      API.seats.syncFromBookings();

      return list[i];
    },

    complete(id) {
      const list = this.getAll();
      const i = list.findIndex(b => b.id === id);
      if (i === -1) return null;
      list[i].status = 'completed';
      localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(list));

      API.seats.release(list[i].seatId);
      API.seats.syncFromBookings();

      return list[i];
    }
  },

  /* ---------- ORDERS ---------- */
  orders: {
    getAll() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || '[]');
      } catch {
        return [];
      }
    },

    getById(id) {
      return this.getAll().find(o => o.id === id) || null;
    },

    getByUser(uid) {
      return this.getAll().filter(o => o.userId === uid);
    },

    /* Đơn đang xử lý = chưa hoàn tất VÀ chưa bị hủy */
    isActive(o) { return o.step < 4 && o.status !== 'cancelled'; },
    getActive() { return this.getAll().filter(o => this.isActive(o)); },

    update(id, patch) {
      const list = this.getAll();
      const i = list.findIndex(o => o.id === id);
      if (i === -1) return null;
      list[i] = { ...list[i], ...patch };
      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(list));
      const cur = this.getCurrent();
      if (cur && cur.id === id) this.setCurrent(list[i]);
      return list[i];
    },

    cancel(id) {
      const o = this.getById(id);
      if (!o || o.status === 'cancelled') return null;
      return this.update(id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
    },

    getCurrent() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.currentOrder) || 'null');
      } catch {
        return null;
      }
    },

    setCurrent(o) {
      if (o) {
        localStorage.setItem(STORAGE_KEYS.currentOrder, JSON.stringify(o));
      } else {
        localStorage.removeItem(STORAGE_KEYS.currentOrder);
      }
    },

    create(data) {
      const list = this.getAll();
      const o = {
        id: 'OD' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        userId: data.userId,
        items: data.items,
        total: data.total,
        subtotal: data.subtotal || data.total,
        shipping: data.shipping || 0,
        discount: data.discount || 0,
        promoCode: data.promoCode || '',
        address: data.address,
        phone: data.phone,
        note: data.note || '',
        customerName: data.customerName || '',
        status: 'pending',
        step: 0,
        createdAt: new Date().toISOString()
      };
      list.push(o);
      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(list));
      this.setCurrent(o);
      return o;
    },

    updateStep(id, step) {
      const list = this.getAll();
      const i = list.findIndex(o => o.id === id);
      if (i === -1) return null;
      if (list[i].status === 'cancelled') return list[i];   // đơn đã hủy không đổi bước nữa

      list[i].step = step;
      const map = ['pending', 'preparing', 'delivering', 'delivering', 'completed'];
      list[i].status = map[step] || 'pending';

      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(list));

      const cur = this.getCurrent();
      if (cur && cur.id === id) this.setCurrent(list[i]);

      return list[i];
    },

    remove(id) {
      const list = this.getAll();
      const i = list.findIndex(o => o.id === id);
      if (i === -1) return false;

      list.splice(i, 1);
      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(list));

      const cur = this.getCurrent();
      if (cur && cur.id === id) this.setCurrent(null);

      return true;
    },

    clearAll() {
      localStorage.removeItem(STORAGE_KEYS.orders);
      this.setCurrent(null);
    },

    clearOld(days = 1) {
      const list = this.getAll();
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

      const filtered = list.filter(o => {
        const created = new Date(o.createdAt).getTime();
        return created > cutoff;
      });

      const removed = list.length - filtered.length;
      if (removed > 0) {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(filtered));
      }

      return removed;
    }
  },

  /* ---------- CART ---------- */
  cart: {
    _getKey() {
      const user = API.users.getCurrent();
      if (user && user.id) {
        return `cappan_cart_${user.id}`;
      }
      return 'cappan_cart_guest';
    },

    _getUserId() {
      const user = API.users.getCurrent();
      return user ? user.id : null;
    },

    get() {
      try {
        const key = this._getKey();
        return JSON.parse(localStorage.getItem(key) || '[]');
      } catch { return []; }
    },

    set(items) {
      const key = this._getKey();
      localStorage.setItem(key, JSON.stringify(items));
    },

    add(item) {
      const cart = this.get();
      const ex = cart.find(i => i.itemId === item.itemId && i.size === item.size);
      if (ex) ex.qty++;
      else cart.push({ ...item, qty: 1 });
      this.set(cart);
      return cart;
    },

    remove(itemId, size) {
      const cart = this.get().filter(i => !(i.itemId === itemId && i.size === size));
      this.set(cart);
      return cart;
    },

    clear() {
      const key = this._getKey();
      localStorage.removeItem(key);
    },

    mergeGuestToUser(userId) {
      try {
        const guestKey = 'cappan_cart_guest';
        const userKey = `cappan_cart_${userId}`;

        const guestCart = JSON.parse(localStorage.getItem(guestKey) || '[]');
        if (guestCart.length === 0) return;

        const userCart = JSON.parse(localStorage.getItem(userKey) || '[]');

        guestCart.forEach(gItem => {
          const ex = userCart.find(uItem =>
            uItem.itemId === gItem.itemId && uItem.size === gItem.size
          );
          if (ex) ex.qty += gItem.qty;
          else userCart.push(gItem);
        });

        localStorage.setItem(userKey, JSON.stringify(userCart));
        localStorage.removeItem(guestKey);
      } catch (e) {
        console.warn('Lỗi merge cart:', e);
      }
    },

    getByUserId(userId) {
      try {
        const key = `cappan_cart_${userId}`;
        return JSON.parse(localStorage.getItem(key) || '[]');
      } catch { return []; }
    },

    clearByUserId(userId) {
      localStorage.removeItem(`cappan_cart_${userId}`);
    }
  },

      /* ---------- STAFF ---------- */
  staff: {
    _getStateKey() { return 'cappan_staff_list'; },
    _getCustomStaff() { try { return JSON.parse(localStorage.getItem(this._getStateKey()) || '[]'); } catch { return []; } },
    _setCustomStaff(list) { localStorage.setItem(this._getStateKey(), JSON.stringify(list)); },
    
    getAll() {
      let custom = this._getCustomStaff();
      const staffUsers = API.users.getAll().filter(u => u.role === 'staff');
      let changed = false;

      // Đồng bộ user role staff vào list (Không dùng đệ quy gọi lại getAll)
      staffUsers.forEach(u => {
        if (!custom.find(s => s.userId === u.id) && !SEED_STAFF.find(s => s.phone === u.phone)) {
          const allExisting = [...SEED_STAFF, ...custom];
          const maxId = allExisting.reduce((max, s) => {
            const num = parseInt((s.id || '').replace('S', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          
          custom.push({
            id: 'S' + String(maxId + 1).padStart(3, '0'),
            userId: u.id,
            name: u.name || 'Nhân viên mới',
            role: 'Nhân viên',
            phone: u.phone || '',
            avatar: (u.name || 'N').trim().charAt(0).toUpperCase(),
            joinedAt: new Date().toISOString(),
            isNew: true
          });
          changed = true;
        }
      });

      if (changed) this._setCustomStaff(custom);
      return [...SEED_STAFF, ...custom];
    },
    
    getById(id) { return this.getAll().find(s => s.id === id) || null; },
    
    addFromUser(user) {
      if (!user || user.role !== 'staff') return null;
      const custom = this._getCustomStaff();
      if (custom.find(s => s.userId === user.id) || SEED_STAFF.find(s => s.phone === user.phone)) return null;

      // Không dùng this.getAll() ở đây để tránh đệ quy
      const allExisting = [...SEED_STAFF, ...custom];
      const maxId = allExisting.reduce((max, s) => {
        const num = parseInt((s.id || '').replace('S', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newId = 'S' + String(maxId + 1).padStart(3, '0');

      const newStaff = {
        id: newId,
        userId: user.id,
        name: user.name || 'Nhân viên mới',
        role: 'Nhân viên',
        phone: user.phone || '',
        avatar: (user.name || 'N').trim().charAt(0).toUpperCase(),
        joinedAt: new Date().toISOString(),
        isNew: true
      };
      
      custom.push(newStaff);
      this._setCustomStaff(custom);
      return newStaff;
    },
    
    removeCustom(staffId) { 
      const custom = this._getCustomStaff().filter(s => s.id !== staffId); 
      this._setCustomStaff(custom); 
      return true; 
    },
    
    resetCustom() { localStorage.removeItem(this._getStateKey()); }
  },

  /* ---------- SHIFTS (ĐÃ DỌN DẸP TRÙNG LẶP) ---------- */
  shifts: {
    getAll() {
      return SEED_SHIFTS;
    },
    getById(id) {
      return SEED_SHIFTS.find(s => s.id === id) || null;
    },

    getSchedule() {
      try {
        return JSON.parse(localStorage.getItem('cappan_schedule') || '{}');
      } catch { return {}; }
    },

    setSchedule(schedule) {
      localStorage.setItem('cappan_schedule', JSON.stringify(schedule));
    },

    getStaffInShift(date, shiftId) {
      const schedule = this.getSchedule();
      return (schedule[date] && schedule[date][shiftId]) || [];
    },

    addStaffToShift(date, shiftId, staffId) {
  // ⚡ P2-6: Chặn xếp 2+ ca/ngày cho cùng 1 nhân viên
  const busyShift = this.isStaffBusy(date, staffId);
  if (busyShift && busyShift !== shiftId) {
    console.warn(`[shifts] ${staffId} đã có ca ${busyShift} ngày ${date}`);
    return false;
  }

  const schedule = this.getSchedule();
  if (!schedule[date]) schedule[date] = {};
  if (!schedule[date][shiftId]) schedule[date][shiftId] = [];

  if (schedule[date][shiftId].includes(staffId)) return false;

  schedule[date][shiftId].push(staffId);
  this.setSchedule(schedule);
  return true;
},

    /* Chỉ giữ lại DUY NHẤT 1 hàm isStaffBusy sạch sẽ ở đây */
    isStaffBusy(date, staffId) {
      const schedule = this.getSchedule();
      if (!schedule[date]) return null;
      for (const shiftId of Object.keys(schedule[date])) {
        if (schedule[date][shiftId].includes(staffId)) {
          return shiftId;
        }
      }
      return null;
    },

    removeStaffFromShift(date, shiftId, staffId) {
      const schedule = this.getSchedule();
      if (!schedule[date] || !schedule[date][shiftId]) return false;
      const idx = schedule[date][shiftId].indexOf(staffId);
      if (idx === -1) return false;
      schedule[date][shiftId].splice(idx, 1);
      this.setSchedule(schedule);
      return true;
    },

    clearAll() {
      localStorage.removeItem('cappan_schedule');
    }
  },

  /* ---------- STATS ---------- */
  stats: {
        revenueInRange(fromTs, toTs) {
      const all = API.orders.getAll().filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= fromTs && t <= toTs && o.status !== 'cancelled';
      });

      // ⚡ FIX: Chỉ tính doanh thu từ đơn đã hoàn tất (step >= 4)
      const completed = all.filter(o => o.step >= 4);

      return {
        total: completed.reduce((s, o) => s + o.total, 0),
        count: all.length,
        completedCount: completed.length,
        pendingCount: all.length - completed.length, // ⚡ Bổ sung dòng này
        orders: all
      };
    },

    today() {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      return this.revenueInRange(start.getTime(), Date.now());
    },

    thisWeek() {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return this.revenueInRange(monday.getTime(), Date.now());
    },

    thisMonth() {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      return this.revenueInRange(start, Date.now());
    },

    last7Days() {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const start = d.getTime();
        const end = start + 24 * 60 * 60 * 1000 - 1;
        const r = this.revenueInRange(start, end);
        days.push({
          date: `${d.getDate()}/${d.getMonth() + 1}`,
          revenue: r.total,
          count: r.count
        });
      }
      return days;
    },

    topItems(limit = 5) {
      const map = {};
      API.orders.getAll().forEach(o => {
        if (o.status === 'cancelled') return;
        o.items.forEach(it => {
          if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, revenue: 0 };
          map[it.name].qty += it.qty;
          map[it.name].revenue += it.price * it.qty;
        });
      });
      return Object.values(map)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit);
    },

    ordersByStatus() {
      const list = API.orders.getAll();
      return {
        pending:    list.filter(o => o.status !== 'cancelled' && o.step === 0).length,
        preparing:  list.filter(o => o.status !== 'cancelled' && o.step === 1).length,
        shipping:   list.filter(o => o.status !== 'cancelled' && (o.step === 2 || o.step === 3)).length,
        completed:  list.filter(o => o.status !== 'cancelled' && o.step >= 4).length,
        cancelled:  list.filter(o => o.status === 'cancelled').length
      };
    },

    bookingsByStatus() {
      const list = API.bookings.getAll();
      return {
        confirmed: list.filter(b => b.status === 'confirmed').length,
        completed: list.filter(b => b.status === 'completed').length,
        cancelled: list.filter(b => b.status === 'cancelled').length
      };
    },

    occupancyRate() {
      const seats = API.seats.getAll();
      const booked = seats.filter(s => s.status === 'booked').length;
      return seats.length ? Math.round((booked / seats.length) * 100) : 0;
    }
  },

  /* ---------- UTILS ---------- */
  utils: {
    formatVND(n) { return n.toLocaleString('vi-VN') + 'đ'; },
    randomId(prefix='ID', len=4) { return prefix + Math.floor(Math.random() * Math.pow(10, len)); },
    now() { return new Date().toISOString(); },
    today() {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;   // giờ địa phương
    }
  }
};
/* ============================================================
   UPGRADE 11: Schema versioning + migration
============================================================ */
(function migrateSchema() {
  const SCHEMA_VERSION = 2;
  const KEY = 'cappan_schema_version';
  const current = parseInt(localStorage.getItem(KEY) || '0', 10);

  if (current === SCHEMA_VERSION) return;

  console.info(`[schema] Migrating from v${current} → v${SCHEMA_VERSION}`);

  try {
    // v1 → v2: đảm bảo orders có field subtotal/shipping/discount
    if (current < 2) {
      const orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || '[]');
      let patched = 0;
      orders.forEach(o => {
        if (o.subtotal === undefined) { o.subtotal = o.total; patched++; }
        if (o.shipping === undefined) { o.shipping = 0; patched++; }
        if (o.discount === undefined) { o.discount = 0; patched++; }
      });
      if (patched > 0) {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
        console.info(`[schema] Patched ${patched} fields in orders`);
      }
    }
    localStorage.setItem(KEY, String(SCHEMA_VERSION));
    console.info('[schema] Migration complete');
  } catch (e) {
    console.error('[schema] Migration failed:', e);
  }
})();
/* Seed demo users khi load */
/* Seed demo users khi load */
API.users.seedDemo();
API.menu._syncSeed();
API.promotions._sync();

/* ⚡ FIX 4.3b: đồng bộ cache menu giữa các tab cùng trình duyệt
   - storage event KHÔNG fire trên tab gây ra thay đổi → tab gốc đã tự
     invalidate qua mutation method (markOutOfStock/add/update/remove)
   - storage event fire TRÊN tab khác → phải invalidate cache + thông báo UI
   - e.key === null xảy ra khi localStorage.clear() → vẫn phải invalidate
*/
window.addEventListener('storage', (e) => {
  // e.key === null → localStorage.clear() (xoá toàn bộ)
  // e.key bắt đầu cappan_menu_ → 1 trong 4 key menu bị thay đổi
  const isMenuChange = (e.key === null) ||
                       (e.key && e.key.startsWith('cappan_menu_'));
  // e.storageArea check: storage event cũng fire cho sessionStorage
  //   → sessionStorage của app không dùng prefix cappan_menu_ nên an toàn,
  //     nhưng check rõ ràng để tránh bug tương lai
  const isLocalStorage = !e.storageArea || e.storageArea === localStorage;

  if (isMenuChange && isLocalStorage) {
    API.menu._invalidate();
    // _epoch++ không cần vì _invalidate đã set _cache = null → chắc chắn miss.
    // Giữ để phòng thủ nếu sau này _invalidate đổi implementation:
    API.menu._epoch++;

    // ⚡ Optional: dispatch để page tự re-render (xem mục D)
    try {
      window.dispatchEvent(new CustomEvent('cappan:menu-changed', {
        detail: { key: e.key, newValue: e.newValue }
      }));
    } catch (err) { /* CustomEvent không hỗ trợ trên browser cũ */ }
  }
});