/* ============================================================
   API GIẢ — MÔ PHỎNG BACKEND (ĐÃ FIX LỖI LOGIC)
============================================================ */

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
    _getStateMap() {
      try {
        return JSON.parse(localStorage.getItem('cappan_menu_state') || '{}');
      } catch { return {}; }
    },

    _setStateMap(map) {
      localStorage.setItem('cappan_menu_state', JSON.stringify(map));
    },

    getAll() {
      const stateMap = this._getStateMap();
      return SEED_MENU_ITEMS.map(m => ({
        ...m,
        inStock: stateMap[m.id] !== undefined ? stateMap[m.id] : m.inStock
      }));
    },

    getById(id) {
      return this.getAll().find(m => m.id === id) || null;
    },

    getByCategory(catId) {
      return this.getAll().filter(m => m.categoryId === catId);
    },

    getAvailable() {
      return this.getAll().filter(m => m.inStock);
    },

    getOutOfStock() {
      return this.getAll().filter(m => !m.inStock);
    },

    search(kw) {
      const k = kw.toLowerCase().trim();
      if (!k) return this.getAll();
      return this.getAll().filter(m => m.name.toLowerCase().includes(k));
    },

    markOutOfStock(id) {
      const map = this._getStateMap();
      map[id] = false;
      this._setStateMap(map);
      return this.getById(id);
    },

    markInStock(id) {
      const map = this._getStateMap();
      map[id] = true;
      this._setStateMap(map);
      return this.getById(id);
    },

    add(item) {
      const newItem = {
        id: 'M' + Date.now().toString().slice(-4),
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
      SEED_MENU_ITEMS.push(newItem);
      return newItem;
    },

    remove(id) {
      const i = SEED_MENU_ITEMS.findIndex(m => m.id === id);
      if (i === -1) return false;
      SEED_MENU_ITEMS.splice(i, 1);
      const map = this._getStateMap();
      delete map[id];
      this._setStateMap(map);
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
      const list = this.getAll();
      const bk = {
        id: 'BK' + Math.floor(1000 + Math.random() * 9000),
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
        id: 'OD' + Math.floor(1000 + Math.random() * 9000),
        userId: data.userId,
        items: data.items,
        total: data.total,
        subtotal: data.subtotal || data.total,
        shipping: data.shipping || 0,
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
    _getStateKey() {
      return 'cappan_staff_list';
    },

    _getCustomStaff() {
      try {
        return JSON.parse(localStorage.getItem(this._getStateKey()) || '[]');
      } catch { return []; }
    },

    _setCustomStaff(list) {
      localStorage.setItem(this._getStateKey(), JSON.stringify(list));
    },

    getAll() {
      const custom = this._getCustomStaff();
      return [...SEED_STAFF, ...custom];
    },

    getById(id) {
      return this.getAll().find(s => s.id === id) || null;
    },

    addFromUser(user) {
      if (!user || user.role !== 'staff') return null;

      const custom = this._getCustomStaff();

      if (custom.find(s => s.userId === user.id) || SEED_STAFF.find(s => s.userId === user.id)) {
        return null;
      }

      const allExisting = this.getAll();
      const maxId = allExisting.reduce((max, s) => {
        const num = parseInt((s.id || '').replace('S', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newId = 'S' + String(maxId + 1).padStart(3, '0');

      const avatar = (user.name || 'N').trim().charAt(0).toUpperCase();

      const newStaff = {
        id: newId,
        userId: user.id,
        name: user.name || 'Nhân viên mới',
        role: 'Nhân viên',
        phone: user.phone || '',
        avatar: avatar,
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

    resetCustom() {
      localStorage.removeItem(this._getStateKey());
    }
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
      const orders = API.orders.getAll().filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= fromTs && t <= toTs && o.status !== 'cancelled';
      });
      return {
        total: orders.reduce((s, o) => s + o.total, 0),
        count: orders.length,
        orders
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
        pending:    list.filter(o => o.step === 0).length,
        preparing:  list.filter(o => o.step === 1).length,
        shipping:   list.filter(o => o.step === 2 || o.step === 3).length,
        completed:  list.filter(o => o.step >= 4).length,
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
    today() { return new Date().toISOString().split('T')[0]; }
  }
};

/* Seed demo users khi load */
API.users.seedDemo();