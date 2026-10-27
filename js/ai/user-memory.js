/* ============================================================
   USER MEMORY — Persistent preference profile
   FIXES:
     - sid isolation (Gap C): key = PREFIX + sid
       Trước: 1 user 2 session share memory → leak rejectedIds
       Sau: sid riêng biệt → logout/login → memory reset
     - Thêm getRejected(sid) — _scoreDrinks gọi
     - TTL 90 ngày, cap favTags 20 / rejectedIds 30
     - Hook API.orders.create tự động
============================================================ */

const UserMemory = {
  PREFIX: 'cappan_user_memory_v2_',
  TTL_MS: 90 * 24 * 60 * 60 * 1000,

  /* Lấy sid hiện tại (role_userId). Không có AIBrain → fallback userId */
  _sid(userId) {
    try {
      if (typeof AIBrain !== 'undefined' && typeof AIBrain._getSessionId === 'function') {
        return AIBrain._getSessionId();
      }
    } catch (e) {}
    return userId || 'guest';
  },

  _key(userId) {
    return this.PREFIX + this._sid(userId);
  },

  _defaults() {
    return {
      favTags: [], favCategory: null, allergies: [], dietFlags: [],
      orderCount: 0, totalSpent: 0, avgOrderHour: null,
      lastSeenAt: 0, lastNudgeAt: 0, rejectedIds: [],
      acceptedUpsellCount: 0, dismissedUpsellCount: 0, updatedAt: 0
    };
  },

  _load(userId) {
    try {
      const raw = localStorage.getItem(this._key(userId));
      if (!raw) return this._defaults();
      const obj = JSON.parse(raw);
      if (obj._exp && Date.now() > obj._exp) return this._defaults();
      return { ...this._defaults(), ...obj };
    } catch { return this._defaults(); }
  },

  _save(userId, data) {
    try {
      data.updatedAt = Date.now();
      data._exp = Date.now() + this.TTL_MS;
      data.favTags = (data.favTags || []).slice(-20);
      data.rejectedIds = (data.rejectedIds || []).slice(-30);
      localStorage.setItem(this._key(userId), JSON.stringify(data));
    } catch (e) { console.warn('[UserMemory] save fail:', e); }
  },

  get(userId) {
    const u = (typeof API !== 'undefined' && API.users) ? API.users.getCurrent() : null;
    return this._load(userId || (u && u.id));
  },

  /* ⚡ Method mới — _scoreDrinks gọi */
  getRejected(userId) {
    return new Set(this._load(userId).rejectedIds || []);
  },

  recordOrder(order, userId) {
    const d = this._load(userId);
    const hour = new Date(order.createdAt || Date.now()).getHours();
    d.orderCount += 1;
    d.totalSpent += Number(order.total) || 0;
    d.avgOrderHour = d.avgOrderHour == null ? hour : Math.round(d.avgOrderHour * 0.7 + hour * 0.3);

    const catCount = {};
    (order.items || []).forEach(it => {
      const m = API.menu.getById(it.itemId);
      if (!m) return;
      catCount[m.categoryId] = (catCount[m.categoryId] || 0) + (it.qty || 1);
      const tags = (typeof LB_TAGS !== 'undefined' && LB_TAGS[it.itemId]) || [];
      tags.forEach(t => { if (!d.favTags.includes(t)) d.favTags.push(t); });
    });

    const fav = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    if (fav && (d.orderCount >= 2 || !d.favCategory)) d.favCategory = fav[0];
    d.lastSeenAt = Date.now();
    this._save(userId, d);
  },

  recordReject(itemId, userId) {
    const d = this._load(userId);
    if (itemId && !d.rejectedIds.includes(itemId)) d.rejectedIds.push(itemId);
    d.dismissedUpsellCount += 1;
    this._save(userId, d);
  },

  recordAccept(itemId, userId) {
    const d = this._load(userId);
    d.acceptedUpsellCount += 1;
    d.rejectedIds = d.rejectedIds.filter(id => id !== itemId);
    this._save(userId, d);
  },

  buildPromptInjection(userId) {
    const d = this._load(userId);
    if (d.orderCount === 0) return '';
    const parts = [];
    if (d.favCategory) {
      const c = API.categories.getById(d.favCategory);
      if (c) parts.push(`hay gọi nhóm ${c.name.replace(/^\S+\s/, '')}`);
    }
    if (d.favTags.length) {
      const t = d.favTags.slice(-3).map(x => (typeof LB_WORDS !== 'undefined' && LB_WORDS[x]) || x).join(', ');
      parts.push(`thích vị ${t}`);
    }
    if (d.avgOrderHour != null) parts.push(`thường ghé ~${d.avgOrderHour}h`);
    if (d.allergies.length) parts.push(`DỊ ỨNG: ${d.allergies.join(', ')}`);
    return parts.length ? `\n[USER MEMORY] Khách quen (${d.orderCount} đơn): ${parts.join('; ')}.` : '';
  },

  shouldNudge(userId) {
    const d = this._load(userId);
    return Date.now() - (d.lastNudgeAt || 0) > 30 * 60 * 1000;
  },

  markNudged(userId) {
    const d = this._load(userId);
    d.lastNudgeAt = Date.now();
    this._save(userId, d);
  },

  /* Xóa memory của 1 sid cụ thể */
  clear(userId) {
    try { localStorage.removeItem(this._key(userId)); } catch (e) {}
  },

  /* Xóa TẤT CẢ memory v2 (dùng khi logout toàn cục) */
  clearAll() {
    try {
      const prefix = this.PREFIX;
      Object.keys(localStorage).forEach(k => { if (k.startsWith(prefix)) localStorage.removeItem(k); });
    } catch (e) {}
  }
};

window.UserMemory = UserMemory;

/* Auto-hook orders.create — lưu memory khi đặt đơn */
if (typeof API !== 'undefined' && API.orders && typeof API.orders.create === 'function' && !API.orders._memoryHooked) {
  API.orders._memoryHooked = true;
  const _orig = API.orders.create.bind(API.orders);
  API.orders.create = function(data) {
    const o = _orig(data);
    try { if (o && o.userId && typeof UserMemory !== 'undefined') UserMemory.recordOrder(o, o.userId); }
    catch (e) { console.warn('[UserMemory] recordOrder fail:', e); }
    return o;
  };
}