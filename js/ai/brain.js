/* ============================================================
    AI BRAIN v5.0 — ULTRA SMART CHATBOT
    Fast-Path <100ms | Smart Router | Multi-Intent | Context Engine
    Taste/Health Aware | Precision Tool-Calling | Generative UI
  ============================================================ */

  const AI_LOCAL_FIRST = true;
  const AI_LOCAL_MIN_CONF = 0.5;

  const AI_PROXY_URL = 'https://cappan-proxy.cappannguyen.workers.dev';
  const AI_ACCESS_TOKEN = '';

  const AI_DIRECT_KEYS = { groq: [], gemini: [] };
  (function checkProxyHealth() {
    if (!AI_PROXY_URL) return;
    fetch(AI_PROXY_URL.replace('/api/chat', '/health'), { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(info => { if (info) console.info('[AI] Proxy online:', info.providers); else console.warn('[AI] Proxy trả lỗi'); })
      .catch(() => console.warn('[AI] Proxy không phản hồi'));
  })();

  const AI_MODELS = [
    { name: 'openai/gpt-oss-20b', maxTokens: 1200 },
    { name: 'openai/gpt-oss-120b', maxTokens: 1000 },
  ];
  const GEMINI_MODELS = [
    { name: 'gemini-3.8-flash', maxTokens: 1200 },
    { name: 'gemini-3.6-flash', maxTokens: 1200 }
  ];
  const AI_PROVIDERS = [
    { id: 'groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', proxyKeyCount: 1, models: AI_MODELS },
    { id: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', proxyKeyCount: 1, models: GEMINI_MODELS }
  ];

  const AI_CONFIG = {
    temperature: 0.4, timeoutMs: 15000, cooldownMs: 60000,
    COOL_KEY: 'cappan_ai_cool', _slots: [], _cool: {},
    _isRealKey(k) { return !!k && !/^(PASTE|YOUR|XXX)/i.test(k); },
    _build() {
      this._slots = [];
      AI_PROVIDERS.forEach(p => {
        p.models.forEach(model => {
          if (AI_PROXY_URL) {
            for (let ki = 0; ki < p.proxyKeyCount; ki++) {
              this._slots.push({ id: `${p.id}:${model.name}:k${ki}`, provider: p.id, keyIndex: ki, model });
            }
          } else {
            (AI_DIRECT_KEYS[p.id] || []).forEach((key, ki) => {
              if (!this._isRealKey(key)) return;
              this._slots.push({ id: `${p.id}:${model.name}:k${ki}`, provider: p.id, keyIndex: ki, key, endpoint: p.endpoint, model });
            });
          }
        });
      });
      if (this._slots.length === 0) console.warn('[AI] Không có key/proxy nào');
      try { this._cool = JSON.parse(sessionStorage.getItem(this.COOL_KEY) || '{}'); } catch (e) { this._cool = {}; }
    },
    lastError: '',
    pick(exclude = []) {
      const now = Date.now();
      return this._slots.find(s => !exclude.includes(s.id) && (this._cool[s.id] || 0) <= now && (this._cool['@' + s.provider] || 0) <= now) || null;
    },
    coolProvider(provider, ms, why) {
      this._cool['@' + provider] = Date.now() + ms;
      try { sessionStorage.setItem(this.COOL_KEY, JSON.stringify(this._cool)); } catch (e) {}
      console.warn(`⛔ ${why} — tạm bỏ qua "${provider}" ${Math.round(ms / 60000)} phút`);
    },
    cool(slot, ms, why) {
      this.lastError = why;
      if (ms > 0) {
        this._cool[slot.id] = Date.now() + ms;
        try { sessionStorage.setItem(this.COOL_KEY, JSON.stringify(this._cool)); } catch (e) {}
      }
      console.warn(`⚠️ ${why} — ${slot.id}${ms > 0 ? ` nghỉ ${Math.round(ms / 1000)}s` : ''}`);
    },
    reset() { this._cool = {}; this.lastError = ''; try { sessionStorage.removeItem(this.COOL_KEY); } catch (e) {} },
    status() {
      const now = Date.now();
      console.table(this._slots.map(s => ({ slot: s.id, state: (this._cool[s.id] || 0) > now ? `nghỉ ${Math.round((this._cool[s.id] - now) / 1000)}s` : 'sẵn sàng' })));
    }
  };

  let __toolCallSeq = 0;
  const genToolCallId = () => { __toolCallSeq = (__toolCallSeq + 1) % 1e6; return 'call_' + __toolCallSeq.toString(36) + '_' + Math.random().toString(36).slice(2, 8); };
  AI_CONFIG._build();

  /* Context Engine */
  const AI_CTX = {
    KEY: 'cappan_ai_ctx_v5',
    _load() { try { return JSON.parse(sessionStorage.getItem(this.KEY) || '{}'); } catch { return {}; } },
    _save(c) { try { sessionStorage.setItem(this.KEY, JSON.stringify(c)); } catch {} },
    get() { return this._load(); },
    update(p) { const c = this._load(); Object.assign(c, p); c.updatedAt = Date.now(); this._save(c); return c; },
    clear() { try { sessionStorage.removeItem(this.KEY); } catch {} },
    pushTurn(role, text, meta={}) { const c = this._load(); if (!Array.isArray(c.turns)) c.turns = []; c.turns.push({ role, text: String(text||'').slice(0,200), meta, ts: Date.now() }); if (c.turns.length > 10) c.turns = c.turns.slice(-10); this._save(c); },
    getRecent(n=3){ const c=this._load(); return (c.turns||[]).slice(-n); }
  };

  /* Fast Path */
  const FAST_PATH = {
    match(inp){
      if(!inp||!inp.norm) return null;
      const n = inp.norm;
      
      // ⚡ FIX: Bỏ qua nếu đang muốn CẬP NHẬT địa chỉ/thông tin giao hàng
      const isUpdateAddr = /\b(doi|sua|thay|cap nhat|chinh|doi lai|sua lai)\b/.test(n) && /\b(dia chi|thong tin giao hang|noi o|giao hang)\b/.test(n);
      
      if(AIInput._isGreeting && AIInput._isGreeting(n)) return {type:'text', msg:'Dạ em chào anh/chị ạ. Anh/chị cần em tư vấn món, đặt bàn hay hỗ trợ gì vậy ạ?'};
      if(AIInput._isThanks && AIInput._isThanks(n)) return {type:'text', msg:'Dạ không có gì ạ. Nếu cần gì em luôn sẵn sàng hỗ trợ nhé ạ.'};
      if(AIInput._isCancel && AIInput._isCancel(n)) return {type:'text', msg:'Dạ em đã ghi nhận ạ. Anh/chị cần em giúp gì khác không ạ?'};
      if(/\b(wifi|mat khau wifi)\b/.test(n)){ const w = kbGet('store.wifi',{name:'CAPPAN_Free',password:'cappannguyen'}); return {type:'text', msg:`Dạ wifi quán: ${w.name} | Mật khẩu: ${w.password} ạ.`}; }
      
      if(!isUpdateAddr && !/\b(cua (toi|minh)|cua (toi|minh) la|da luu)\b/.test(n) && /\b(dia chi|o dau|duong)\b/.test(n)) return {type:'text', msg:`Dạ địa chỉ quán: ${kbGet('store.address','')} ạ.`};
      
      if(/\b(gio mo cua|may gio mo|dong cua|gio hoat dong)\b/.test(n)) return {type:'text', msg:`Dạ quán mở cửa: ${kbGet('store.hours','07:00 - 22:30')} hàng ngày ạ.`};
      if(/\b(hotline|so dien thoai quan|lien he)\b/.test(n)) return {type:'text', msg:`Dạ hotline hỗ trợ: ${kbGet('store.hotline','0366 444 038')} ạ.`};
      if(/\b(gui xe|dau xe|bai xe|parking)\b/.test(n)) return {type:'text', msg:`Dạ quán có chỗ đậu xe ${kbGet('store.policies.parking','miễn phí')} ạ.`};
      
      return null;
    }
  };

  /* ---- kbGet: đọc KB theo dotted path ---- */
  function kbGet(path, fallback) {
    try {
      if (typeof KB === 'undefined') return fallback;
      let cur = KB;
      for (const key of String(path).split('.')) {
        if (cur == null) return fallback;
        cur = cur[key];
      }
      return cur === undefined || cur === null ? fallback : cur;
    } catch (e) { return fallback; }
  }

  /* ---- KBFast ---- */
  const KBFast = {
    MAX_LEN: 120,
    _norm(s) {
      return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    },
    _menuNames() {
      try { return (API.menu.getAll() || []).map(m => this._norm(m.name)).filter(Boolean); }
      catch (e) { return []; }
    },
  answer(q) {
    if (!q) return null;
    const s = String(q).trim();
    if (!s || s.length > this.MAX_LEN) return null;
    const n = this._norm(s);
    if (!n) return null;

    const isUpdateInfo = /\b(doi|sua|thay|cap nhat|chinh|doi lai|sua lai)\b/.test(n) && /\b(dia chi|thong tin giao hang|noi o|giao hang|so dien thoai|sdt|dien thoai|phone)\b/.test(n);
    if (isUpdateInfo) return null;
    const isUpdateAddr = /\b(doi|sua|thay|cap nhat|chinh|doi lai|sua lai)\b/.test(n) && /\b(dia chi|thong tin giao hang|noi o|giao hang)\b/.test(n);

      const menus = this._menuNames();
      if (menus.some(mn => n === mn || n === 'cho minh ' + mn || n === 'co ' + mn || n === 'cau hoi ve ' + mn)) return null;

      if (/\b(con (cho|ban)|cho (ngoi|nao|trong)|ban nao|chon cho)\b/.test(n)) return null;
      if (/\b(nhan vien|nhân viên|lich ca|ca sang|ca toi|ca chieu)\b/.test(n)) return null;
      if (/\bdeadline\b/.test(n)) return null;
      if (/\b(cho minh|mình|toi|minh)\b/.test(n) && /\b(giao hang|o dau|dia chi)\b/.test(n)) return null;
      if (/\bdia chi giao hang\b/.test(n)) return null;
      if (/\b(mon|do uong|quan)\b/.test(n) && /\b(chay nhat|running|ban chay nhat|best seller)\b/.test(n)) return null;
      if (/\b(dat ban|book ban|giu cho)\b/.test(n)) return null;
      if (/\b(goi y|tư vấn|tu van|khau vi|ngot|beo|chua|lanh|nong)\b/.test(n)) return null;
      if (/\b(hut thuoc|thuoc la)\b/.test(n)) {
        return 'Dạ CAPPAN là không gian không khói thuốc ạ, anh/chị vui lòng không hút thuốc trong quán.';
      }
      if (/\b(thu cung|cho meo|meo|pet|vat nuoi)\b/.test(n)) {
        return 'Dạ CAPPAN không cho phép mang thú cưng vào quán ạ, để đảm bảo vệ sinh chung.';
      }
      if (/\b(app|ung dung|tai app|cai app)\b/.test(n)) return 'Dạ hiện tại CAPPAN chưa có app riêng ạ. Anh/chị vui lòng truy cập website để đặt chỗ và đặt nước ạ.';
      if (/\b(tuyen dung|xin viec|tri lam|tim viec)\b/.test(n)) return 'Dạ hiện tại CAPPAN chưa có đợt tuyển dụng. Anh/chị theo dõi fanpage để cập nhật thông tin mới nhất nhé.)';
      if (/\b(chu quan|sang lap|founder|owner|ong chu|ba chu)\b/.test(n)) return 'Dạ em chưa có thông tin này. Anh/chị vui lòng gọi hotline ' + kbGet('store.hotline', '0366 444 038') + ' để được hỗ trợ ạ.)';
      if (/\b(thanh lap|mo nam|ra doi|khai truong nam)\b/.test(n)) return 'Dạ em chưa có thông tin này. Anh/chị vui lòng gọi hotline ' + kbGet('store.hotline', '0366 444 038') + ' để được hỗ trợ ạ.)';
      if (/\b(chi nhanh|co so|dia diem khac|quan khac)\b/.test(n)) return 'Dạ hiện tại CAPPAN chỉ có 1 chi nhánh tại Công viên Gia Định, Q. Gò Vấp ạ.)';
      if (/\b(tiec|sinh nhat|su kien|doan dong|dat tiec)\b/.test(n)) return 'Dạ CAPPAN có nhận đặt tiệc riêng cho đoàn từ 10 người. Anh/chị vui lòng gọi hotline ' + kbGet('store.hotline', '0366 444 038') + ' để được tư vấn ạ.)';
      if (/\b(bao mat|du lieu ca nhan|quyen rieng tu|thong tin ca nhan)\b/.test(n)) return 'Dạ thông tin của anh/chị chỉ dùng để đặt chỗ và đặt nước. Chi tiết xem trang "Chính sách bảo mật" ở cuối website ạ.)';

      if (/mat khau wifi|mat khau cua wifi/.test(n)) {
        const w = kbGet('store.wifi', { name: 'CAPPAN_Free', password: 'cappannguyen' });
        return 'Dạ mật khẩu wifi quán là ' + w.password + ' ạ.';
      }
      if (/\bwifi\b/.test(n)) {
        const w = kbGet('store.wifi', { name: 'CAPPAN_Free', password: 'cappannguyen' });
        return 'Dạ wifi quán: ' + w.name + ' | Mật khẩu: ' + w.password + ' ạ.';
      }
      if (/\b(mo cua|dong cua|may gio|gio mo|gio dong|gio hoat dong)\b/.test(n)) {
        const hours = kbGet('store.hours', '07:00 - 22:30');
        return 'Dạ quán mở cửa ' + hours + ' hàng ngày ạ.';
      }
      const isOrderCtx = /\b(don hang|don cua|don toi|don minh|don nao|shipper|giao hang|giao toi|giao chua|trang thai|tinh trang|booking|dat cho|dat ban|kiem tra don|xem don)\b/.test(n);
      if (!isOrderCtx && /\b(dia chi quan|dia chi cua quan|dia chi cappan|quan o dau|quan nam o dau|quan o duong nao)\b/.test(n)) {
        return 'Dạ địa chỉ quán: ' + kbGet('store.address', 'Công viên Gia Định') + ' ạ.';
      }
      if (!isUpdateAddr && !isOrderCtx && /\bdia chi\b/.test(n) && n.split(' ').length <= 8) {
        return 'Dạ địa chỉ quán: ' + kbGet('store.address', 'Công viên Gia Định') + ' ạ.';
      }
      if (/(hotline|so dien thoai|lien he|ho tro)/.test(n)) {
        return 'Dạ hotline CAPPAN: ' + kbGet('store.hotline', '0366 444 038') + ' ạ.';
      }
      if (/\b(gui xe|dau xe|bai xe|parking)\b/.test(n)) {
        return 'Dạ quán có chỗ đậu xe ' + kbGet('store.policies.parking', 'Miễn phí') + ' phía sau quán ạ.';
      }
      if (/\b(o cam|sac dien thoai|cong sac|sac tranh|sac dien)\b/.test(n)) {
        return 'Dạ quán có ổ cắm điện tại mọi bàn, anh/chị sạc điện thoại thoải mái nha ạ.';
      }
    if (!isUpdateAddr && /\b(giao hang|ship|deliver|van chuyen)\b/.test(n)) {
      return 'Dạ có ạ. CAPPAN giao hàng trong bán kính 3km, phí ship 15.000đ ạ.';
    }
      if (/\b(ban la ai|ai hay nguoi|nguoi that|may tinh|robot|chatbot|la ai)\b/.test(n)) {
        return 'Dạ em là AI của CAPPAN, không phải người thật. Em có thể nhầm, với thông tin quan trọng anh/chị vui lòng gọi hotline ' + kbGet('store.hotline', '0366 444 038') + ' ạ.';
      }
      if (/\b(do an|mon an|an vat|an nhe|ban do an)\b/.test(n)) {
        return 'Dạ CAPPAN chủ yếu phục vụ đồ uống, món ăn hiện có là Bánh Flan. Anh/chị gọi hotline ' + kbGet('store.hotline', '0366 444 038') + ' để hỏi thêm món ăn nhẹ nhé ạ.';
      }
      if (/\b(mon chay|an chay|co chay|vegan)\b/.test(n)) {
        return 'Dạ CAPPAN chưa có menu chay riêng, nhưng có Sinh tố Bơ, Sinh tố Xoài, Nước ép Cam, Trà Sen Vàng phù hợp ạ.';
      }
      if (/\b(chem khau|may lanh|lanh|nhiet do)\b/.test(n)) {
        return 'Dạ quán có máy lạnh ở khu trong nhà, các khu ngoài trời thoáng mát ạ.';
      }
      if (/\b(combo|gom|goi combo)\b/.test(n)) {
        const list = (kbGet('combos', []) || []).map(c => c.name + ' (' + c.items.join(' + ') + ') — ' + (typeof API !== 'undefined' && API.utils ? API.utils.formatVND(c.comboPrice) : c.comboPrice));
        return 'Dạ hiện CAPPAN có các combo tiết kiệm:\n' + list.map(s => '• ' + s).join('\n') + '\nAnh/chị chọn combo nào ạ?';
      }
      if (/\b(mon moi|moi ra mat|mon ngon moi)\b/.test(n)) {
        return 'Dạ ' + kbGet('context.newDrinks', 'Món mới: Cà Phê Muối (M006) - vị mặn nhẹ độc đáo.') + ' ạ.';
      }
      if (/\b(view|tam giac|tang thuong|ngoai troi|goc dep)\b/.test(n)) {
        return 'Dạ ' + kbGet('context.viewZone', 'Tầng thượng (F4) có view thành phố đẹp nhất, đặc biệt về đêm.') + ' ạ.';
      }
      return null;
    }
  };

  /* ---- AI_TOOLS + AIToolExecutor ---- */
  const AI_TOOLS = [
    { name: 'get_menu', roles: ['customer', 'staff'], desc: 'Xem menu hiện tại: {categoryId?}' },
    { name: 'search_menu', roles: ['customer', 'staff'], desc: 'Tìm món theo từ khóa: {keyword}' },
    { name: 'get_promotions', roles: ['customer', 'staff'], desc: 'Danh sách khuyến mãi đang chạy: {}' },
    { name: 'check_seats', roles: ['customer', 'staff'], desc: 'Xem chỗ trống: {}' },
    { name: 'get_order_status', roles: ['customer', 'staff'], desc: 'Trạng thái đơn: {orderId?} — bỏ trống để lấy đơn hiện tại' },
    { name: 'cancel_my_order', roles: ['customer', 'staff'], desc: 'Khách tự hủy đơn của mình: {orderId}', danger: true },
    { name: 'cancel_order', roles: ['staff'], desc: 'Nhân viên hủy 1 đơn bất kỳ: {orderId}', danger: true },
    { name: 'search_customer_history', roles: ['staff'], desc: 'Tra lịch sử khách theo SĐT/tên: {keyword}' },
    { name: 'get_recipe', roles: ['staff'], desc: 'Công thức pha chế: {drinkName}', staffOnlyNote: 'Tuyệt đối không tiết lộ cho khách' },
    { name: 'get_revenue_stats', roles: ['staff'], desc: 'Doanh thu theo khoảng ngày: {from?, to?}' },
    { name: 'get_shift_schedule', roles: ['staff'], desc: 'Lịch ca làm việc: {date: today|tomorrow|this_week, shiftId?}' },
    { name: 'get_staff_list', roles: ['staff'], desc: 'Danh sách nhân viên: {}' },
    { name: 'cancel_my_booking', roles: ['customer', 'staff'], desc: 'Khách tự hủy booking của mình: {bookingId}', danger: true },
    { name: 'update_booking', roles: ['customer', 'staff'], desc: 'Cập nhật giờ/booking của chính mình: {bookingId, newTime}', danger: true },
    { name: 'reset_all_seats', roles: ['staff'], desc: 'Reset trạng thái chỗ ngồi: {}', danger: true }
  ];

  const AIToolExecutor = {
    _mask(text) {
      return String(text).replace(/\d{8,}/g, '****').replace(/\d{4}\s?\d{3}\s?\d{3}\b/g, '****');
    },
    async run(name, args, role) {
      const tool = AI_TOOLS.find(t => t.name === name);
      if (!tool) return { error: 'Tool "' + name + '" không tồn tại.' };
      if (!tool.roles.includes(role)) {
        return { error: 'Access denied: role "' + role + '" không được cấp quyền dùng tool "' + name + '".' };
      }
      try {
        return await this._exec(name, args || {}, role);
      } catch (e) {
        return { error: 'Tool "' + name + '" lỗi: ' + (e && e.message ? e.message : e) };
      }
    },
    async _exec(name, a, role) {
      const me = API.users.getCurrent() || { id: '', name: 'Khách' };
      switch (name) {
        case 'get_menu': {
          const all = API.menu.getAll();
          return { items: all.filter(m => !a.categoryId || m.categoryId === a.categoryId).slice(0, 30).map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock, description: m.description })) };
        }
        case 'search_menu': {
          const kw = String(a.keyword || '').toLowerCase();
          return { items: API.menu.getAll().filter(m => (m.name + ' ' + (m.description || '')).toLowerCase().includes(kw)).slice(0, 15).map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock })) };
        }
        case 'get_promotions':
          return { promotions: API.promotions.getAll().map(p => ({ code: p.code, name: p.name, discount: p.discount, status: API.promotions.status(p, API.utils.today()) })) };
        case 'check_seats': {
          const seats = API.seats.getAll().filter(s => s.status === 'available');
          return { available: seats.slice(0, 12).map(s => ({ id: s.id, capacity: s.capacity, zone: s.zone || s.floorId })) };
        }
        case 'get_order_status': {
          const o = a.orderId ? API.orders.getById(a.orderId) : API.orders.getCurrent();
          if (!o) return { error: 'Không tìm thấy đơn hàng phù hợp.' };
          const mine = role === 'staff' || o.userId === me.id;
          if (!mine) return { error: 'Đơn này không thuộc tài khoản của anh/chị.' };
          return { id: o.id, step: o.step, status: o.status, total: o.total, items: o.items, createdAt: o.createdAt };
        }
        case 'cancel_my_order': {
          const o = API.orders.getById(a.orderId);
          if (!o || o.userId !== me.id) return { error: 'Đơn không tồn tại hoặc không thuộc anh/chị.' };
          if (o.status === 'cancelled') return { error: 'Đơn đã hủy trước đó rồi.' };
          // ⚡ FIX: chặn hủy đơn đã vào giai đoạn pha chế/giao (step >= 2) — khớp đường local
          if (o.step >= 2) return { error: 'Đơn đã vào giai đoạn pha chế/giao hàng, không thể tự hủy. Anh/chị vui lòng gọi hotline 0366 444 038 để được hỗ trợ ạ.' };
          // ⚡ FIX: dùng API.orders.cancel để set đúng cancelledAt (thống kê không lệch)
          const r = API.orders.cancel(a.orderId);
          return { ok: !!r, orderId: a.orderId, step: o.step };
        }
        case 'cancel_order': {
          const o = a.orderId ? API.orders.getById(a.orderId) : API.orders.getCurrent();
          if (!o) return { error: 'Không tìm thấy đơn ' + (a.orderId || '') + '.' };
          if (o.status === 'cancelled') return { error: 'Đơn đã hủy rồi.' };
          // ⚡ FIX: dùng API.orders.cancel để set đúng cancelledAt
          const r = API.orders.cancel(o.id);
          return { ok: !!r, orderId: o.id };
        }
        case 'search_customer_history': {
          const kw = String(a.keyword || '').trim().toLowerCase();
          if (!kw || kw.length < 3) return { error: 'Cần "keyword" ≥ 3 ký tự (SĐT/tên/ID).' };
          const users = API.users.getAll().filter(u => (u.phone + ' ' + u.name + ' ' + u.id).toLowerCase().includes(kw));
          const orders = (API.orders.getAll() || []).filter(o => users.some(u => u.id === o.userId));
          const mask = s => this._mask(s);
          return {
            customers: users.slice(0, 8).map(u => ({ id: u.id, name: u.name, role: u.role, phone: mask(u.phone), joinedAt: u.createdAt }))
              .concat(users.length ? [] : { note: 'Không tìm thấy khách nào khớp' }),
            totalOrders: orders.length,
            orders: orders.slice(0, 10).map(o => ({ id: o.id, step: o.step, status: o.status, total: o.total }))
          };
        }
    case 'get_recipe': {
    const recs = (typeof SEED_RECIPES !== 'undefined') ? SEED_RECIPES : {};
    const kw = (typeof normVN === 'function') ? normVN(a.drinkName || '') : String(a.drinkName || '').toLowerCase();
    if (!kw) return { error: 'Cần "drinkName" để tra công thức.' };
    const key = Object.keys(recs).find(k =>
      k.toLowerCase() === String(a.drinkName || '').toLowerCase() ||
      normVN(recs[k].name || '').includes(kw)
    );
    if (!key) return { error: 'Không tìm thấy công thức "' + (a.drinkName || '') + '".' };
    return { id: key, name: recs[key].name, size: recs[key].size, ingredients: recs[key].ingredients, steps: recs[key].steps };
  }
        case 'get_revenue_stats': {
          const tr = a.timeRange || (a.from || a.to ? 'range' : 'today');
          const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
          const now = new Date();
          const today = startOfDay(now);
          const st = API.stats;
          const tToday = st.revenueInRange(today, Date.now());
          if (tr === 'today') {
            return { timeRange: 'today', todayRevenue: tToday.total, todayOrders: tToday.completedCount, weekRevenue: 0, monthRevenue: 0 };
          }
          if (tr === 'week') {
            let wk = 0, wkC = 0;
            for (let i = 0; i < 7; i++) { const s = st.revenueInRange(today - i * 86400000, today - i * 86400000 + 86399999); wk += s.total; wkC += s.completedCount; }
            return { timeRange: 'week', todayRevenue: 0, weekRevenue: wk, weekOrders: wkC, monthRevenue: 0 };
          }
          if (tr === 'this_week') {
            const w = st.thisWeek();
            return { timeRange: 'this_week', todayRevenue: tToday.total, weekRevenue: w.total, monthRevenue: 0, total: w.total, count: w.count };
          }
          if (tr === 'month') {
            let mo = 0, moC = 0;
            for (let i = 0; i < 30; i++) { const s = st.revenueInRange(today - i * 86400000, today - i * 86400000 + 86399999); mo += s.total; moC += s.completedCount; }
            return { timeRange: 'month', todayRevenue: 0, weekRevenue: 0, monthRevenue: mo, monthOrders: moC };
          }
          if (tr === 'range') {
            // ⚡ FIX: dùng đúng khoảng a.from → a.to (trước đây trả nhầm số liệu hôm nay)
            const f = a.from ? startOfDay(a.from) : today;
            const t = a.to ? (() => { const x = new Date(a.to); x.setHours(23, 59, 59, 999); return x.getTime(); })() : Date.now();
            const r = st.revenueInRange(Math.min(f, t), Math.max(f, t));
            return { timeRange: 'range', total: r.total, count: r.count, completedCount: r.completedCount, pendingCount: r.pendingCount, from: a.from || '', to: a.to || '' };
          }
          return { timeRange: 'today', total: tToday.total, count: tToday.count, from: 'today', to: 'today' };
        }
        case 'get_shift_schedule': {
          const HUMAN = { morning: 'Ca sáng', afternoon: 'Ca chiều', evening: 'Ca tối' };
          const dayISO = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
          const now = new Date();
          const todayISO = dayISO(now);
          let dates = [todayISO];
          if (a.date === 'tomorrow') { const t = new Date(now); t.setDate(now.getDate() + 1); dates = [dayISO(t)]; }
          else if (a.date === 'this_week' || a.date === 'week') { dates = []; for (let i = 0; i < 7; i++) { const t = new Date(now); t.setDate(now.getDate() + i); dates.push(dayISO(t)); } }
          const upcoming = {};
          dates.forEach(d => {
            const wared = API.shifts.getSchedule()[d] || {};
            const shifts = a.shiftId ? { [a.shiftId]: wared[a.shiftId] || [] } : wared;
            if (Object.values(shifts).some(arr => (arr || []).length)) upcoming[d] = shifts;
          });
          const out = {};
          for (const d of Object.keys(upcoming)) {
            out[d] = {};
            for (const sid of Object.keys(upcoming[d])) {
              out[d][sid] = (upcoming[d][sid] || []).map(sId => { const s = API.staff.getById ? API.staff.getById(sId) : null; return s ? s.name : sId; });
            }
          }
          return { today: todayISO, shifts: HUMAN, upcoming: out, filter: a.shiftId || 'all' };
        }
        case 'get_staff_list': {
          return { staff: API.staff.getAll().slice(0, 30).map(s => ({ id: s.id, name: s.name, role: s.role, phone: this._mask(s.phone || '') })) };
        }
        case 'cancel_my_booking': {
          const bk = API.bookings.getAll().find(b => b.id === a.bookingId) || API.bookings.getAll().find(b => b.seatId === a.seatId && b.userId === me.id);
          if (!bk || bk.userId !== me.id) return { error: 'Booking này không phải của anh/chị hoặc không tìm thấy.' };
          API.bookings.cancel(bk.id);
          return { ok: true, bookingId: bk.id, status: 'cancelled' };
        }
        case 'update_booking': {
          const bk = API.bookings.getAll().find(b => b.id === a.bookingId);
          if (!bk) return { error: 'Không tìm thấy booking ' + (a.bookingId || '') + '.' };
          if (bk.userId !== me.id) return { error: 'Booking này không phải của anh/chị (không phải do tài khoản hiện tại tạo).' };
          if (!a.newTime) return { error: 'Cần "newTime" (HH:mm).' };
          const updated = API.bookings.update(a.bookingId, { time: a.newTime });
          return { ok: !!updated, updated: updated ? { id: updated.id, time: updated.time, seatId: updated.seatId } : null };
        }
        case 'reset_all_seats': {
          const n = API.seats.resetAll();
          return { ok: true, resetCount: n };
        }
        default:
          return { error: 'Tool chưa khai báo handler.' };
      }
    }
  };

  /* ---- ResponseCache / AIMetrics ---- */
  const ResponseCache = {
    TTL: 10 * 60 * 1000,
    _m: new Map(),
    key(obj) {
      try { return JSON.stringify(obj).slice(0, 400); } catch { return String(Date.now()); }
    },
    get(k) {
      const e = this._m.get(k);
      if (!e) return null;
      if (Date.now() - e.ts > this.TTL) { this._m.delete(k); return null; }
      return e.val;
    },
    has(k) { return !!this.get(k); },
    set(k, val) { this._m.set(k, { val, ts: Date.now() }); },
    clear() { this._m.clear(); },
    size() { return this._m.size || 0; }
  };

  const AIMetrics = {
    KEY: 'cappan_ai_metrics', MAX: 300,
    _events: [], _counters: {}, _max: 200,

    record(kind, detail) {
      try {
        this._events.push({ kind, detail, ts: Date.now() });
        if (this._events.length > this._max) this._events = this._events.slice(-this._max);
        this._counters[kind] = (this._counters[kind] || 0) + 1;
      } catch (e) {}
    },
    gauge(kind) { return this._counters[kind] || 0; },
    events() { return this._events.slice(); },
    counters() { return Object.assign({}, this._counters); },

    _read() { try { const a = JSON.parse(localStorage.getItem(this.KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
    _write(l) { try { localStorage.setItem(this.KEY, JSON.stringify(l.slice(-this.MAX))); } catch (e) {} },
    _emit(ev) { try { if (window.Realtime) window.Realtime.emit(ev, {}); } catch (e) {} },
    mapSource(s) { return ({ kb: 'kb', cache: 'cache', llm: 'llm', down: 'legacy', legacy: 'legacy' })[s] || 'rule'; },

    log(e) {
      const l = this._read();
      l.push(Object.assign({ t: new Date().toISOString(), role: 'customer', q: '', tools: [], ms: 0 }, e, { source: this.mapSource(e && e.source) }));
      this._write(l); this._emit('ai:metrics');
    },
    logTurn({ q, res, ms, ttft, role, tools, model }) {
      res = res || {};
      this.log({
        q: String(q || '').slice(0, 90), role: role === 'staff' ? 'staff' : 'customer',
        source: res.source || 'rule', intent: res.intent || '', ms: ms || 0, ttft: ttft == null ? null : ttft,
        tools: tools || [], model: model || '',
        qLen: String(q || '').length, aLen: String(res.message || res.cards || '').length,
        error: res.type === 'error' ? res.message : ''
      });
    },
    logFeedback(q, a, v) {
      const l = this._read(), key = String(q || '').slice(0, 90);
      for (let i = l.length - 1; i >= 0; i--) {
        if (l[i].q === key && !l[i].fbOnly) { l[i].fb = v; this._write(l); this._emit('ai:feedback'); return; }
      }
      l.push({ t: new Date().toISOString(), role: 'customer', q: key, source: 'rule', fb: v, fbOnly: true, tools: [], ms: 0 });
      this._write(l); this._emit('ai:feedback');
    },
    getAll() { return this._read(); },
    clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} this._events = []; this._counters = {}; },
    reset() { this.clear(); },
    installFlushHooks() { /* ghi trực tiếp, không cần flush */ },

    summary(list) {
      list = list || this._read();
      const S = ['kb', 'rule', 'cache', 'llm', 'legacy'];
      const bySrc = {}, sum = {}, cnt = {};
      S.forEach(k => { bySrc[k] = 0; sum[k] = 0; cnt[k] = 0; });
      const turns = list.filter(e => !e.fbOnly), tools = {}, models = {};
      let tokIn = 0, tokOut = 0, fbUp = 0, fbDown = 0;
      turns.forEach(e => {
        const k = S.includes(e.source) ? e.source : 'rule';
        bySrc[k]++; if (e.ttft != null) { sum[k] += e.ttft; cnt[k]++; }
        tokIn += Math.ceil((e.qLen || 0) / 3); tokOut += Math.ceil((e.aLen || 0) / 3);
        (e.tools || []).forEach(t => { tools[t] = (tools[t] || 0) + 1; });
        if (e.model) models[e.model] = (models[e.model] || 0) + 1;
      });
      list.forEach(e => { if (e.fb === 'up') fbUp++; else if (e.fb === 'down') fbDown++; });
      const avg = (a, n) => n ? Math.round(a / n) : 0;
      const avgTtftBy = {}; S.forEach(k => { avgTtftBy[k] = avg(sum[k], cnt[k]); });
      const total = turns.length;
      const arr = o => Object.entries(o).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      return {
        total, bySrc, avgTtftBy,
        avgTtft: avg(S.reduce((a, k) => a + sum[k], 0), S.reduce((a, k) => a + cnt[k], 0)),
        tokIn, tokOut, fbUp, fbDown,
        noLlmPct: total ? Math.round((total - bySrc.llm) / total * 100) : 0,
        legacyPct: total ? Math.round(bySrc.legacy / total * 100) : 0,
        tools: arr(tools), models: arr(models)
      };
    },
    toCSV() {
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const cols = ['t', 'role', 'q', 'source', 'intent', 'ttft', 'ms', 'tools', 'model', 'fb'];
      return '\uFEFF' + [cols.join(',')].concat(this._read().map(r => cols.map(c => q(Array.isArray(r[c]) ? r[c].join('|') : r[c])).join(','))).join('\n');
    }
  };

  /* ---- AIBRAIN ---- */
  const AIBrain = {
    HIST_KEY: 'cappan_ai_hist_v5',
    PENDING_KEY: 'cappan_ai_pending_v5',
    MAX_HIST: 12,
    histories: {},
    _pending: {},
    _onPhaseChange: null,

    _getSessionId() {
      try {
        const u = API.users.getCurrent();
        return u ? u.role + '_' + u.id : 'guest';
      } catch (e) { return 'guest'; }
    },
    _loadHistories() {
      if (!Object.keys(this.histories).length) {
        try {
          this.histories = JSON.parse(localStorage.getItem(this.HIST_KEY) || '{}') || {};
          if (!Object.keys(this.histories).length) {
            const legacy = sessionStorage.getItem(this.HIST_KEY);
            if (legacy) { this.histories = JSON.parse(legacy) || {}; this._saveHistories(); }
          }
        } catch (e) { this.histories = {}; }
      }
      return this.histories;
    },
    _saveHistories() {
      try { localStorage.setItem(this.HIST_KEY, JSON.stringify(this.histories)); } catch (e) {}
    },
    _getHistory(sid) {
      const h = this._loadHistories();
      if (!Array.isArray(h[sid])) h[sid] = [];
      return h[sid];
    },
    _pushHistory(sid, role, content) {
      if (!content) return;
      const h = this._loadHistories();
      const arr = this._getHistory(sid);
      const limit = /\[UI_\w+\]/.test(content) ? 6000 : 800;
      arr.push({ role, content: String(content).slice(0, limit) });
      if (arr.length > this.MAX_HIST) h[sid] = arr.slice(-this.MAX_HIST);
      this._saveHistories();
    },
    _sanitizeHistory(sid) {
      const h = this._loadHistories();
      const arr = h[sid];
      if (!Array.isArray(arr)) return;
      const clean = arr.filter(m => m && typeof m.content === 'string' && ['user', 'assistant', 'system', 'tool'].includes(m.role));
      h[sid] = clean.slice(-this.MAX_HIST);
      this._saveHistories();
    },
    _clearHistory(sid) {
      const h = this._loadHistories();
      delete h[sid];
      this.histories = h;
      this._saveHistories();
    },

    _readPendingStore() {
      try { return JSON.parse(sessionStorage.getItem(this.PENDING_KEY) || '{}') || {}; }
      catch { return {}; }
    },
    _writePendingStore(st) {
      try { sessionStorage.setItem(this.PENDING_KEY, JSON.stringify(st)); } catch (e) {}
    },
    _setPending(sid, p) {
      const st = this._readPendingStore();
      st[sid] = p;
      this._pending[sid] = p;
      this._writePendingStore(st);
    },
    _getPending(sid) {
      if (this._pending[sid]) return this._pending[sid];
      const st = this._readPendingStore();
      if (st[sid]) { this._pending[sid] = st[sid]; }
      return this._pending[sid] || null;
    },
    _clearPending(sid) {
      delete this._pending[sid];
      const st = this._readPendingStore();
      delete st[sid];
      this._writePendingStore(st);
    },

    _toolContent(v) {
      if (v === undefined || v === null) return 'null';
      const shrink = (x, depth) => {
        if (x === undefined || x === null || typeof x !== 'object') {
          if (typeof x === 'string' && x.length > 120) return x.slice(0, 117) + '…';
          return x;
        }
        if (Array.isArray(x)) {
          const keep = Math.max(6, Math.ceil((x.length || 10) / Math.pow(2, depth)));
          return x.slice(0, keep).map(y => shrink(y, depth));
        }
        const out = {};
        for (const k of Object.keys(x)) out[k] = shrink(x[k], depth + 1);
        return out;
      };
      let s = JSON.stringify(v);
      if (s && s.length <= 5000) return s;
      let dep = 0;
      while (dep < 8) {
        try {
          s = JSON.stringify(shrink(JSON.parse(JSON.stringify(v)), dep));
          if (s.length <= 5000) return s;
        } catch (e) { break; }
        dep++;
      }
      try { return JSON.stringify({ truncated: true, total: v && v.total != null ? v.total : null }); }
      catch { return '{"truncated":true}'; }
    },
    _parseSSEEvent(line, acc) {
      if (!line || typeof line !== 'string') return acc;
      const body = line.replace(/^data:\s?/, '').trim();
      if (!body || body === '[DONE]') return acc;
      let d;
      try { d = JSON.parse(body); } catch (e) { return acc; }
      const c = (d.choices && d.choices[0]) || null;
      if (!c) return acc;
      const del = (c.delta !== undefined ? c.delta : (c.message || {}));
      if (typeof del.content === 'string' && del.content) {
        acc.content += del.content;
        if (typeof acc.onChunk === 'function') acc.onChunk(del.content, acc.content);
      }
      if (Array.isArray(del.tool_calls)) {
        del.tool_calls.forEach(tc => {
          const i = (typeof tc.index === 'number' ? tc.index : 0);
          const cur = acc.toolCallsMap[i] || { id: '', function: { name: '', arguments: '' }, type: 'function' };
          if (tc.id) cur.id = tc.id;
          if (tc.function && tc.function.name) cur.function.name += tc.function.name;
          if (tc.function && tc.function.arguments) cur.function.arguments += tc.function.arguments;
          acc.toolCallsMap[i] = cur;
        });
      }
      return acc;
    },

    _localCards(inp) {
      try {
        const ctx = LocalBrain.ctx;
        if (ctx && ctx.sid) {
          const cur = this._getSessionId();
          if (cur !== ctx.sid) { LocalBrain.ctx = null; return ''; }
        }
        if (!(LocalBrain.ctx && LocalBrain.ctx.kind === 'drink' && Array.isArray(LocalBrain.ctx.shown) && LocalBrain.ctx.shown.length)) {
          return '';
        }
        const c = LocalBrain.ctx;
        const reasons = c.reasons || {};
        const items = c.shown.map(id => {
          const m = API.menu.getById(id);
          if (!m) return null;
          return { id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge, reason: reasons[id] || '' };
        }).filter(Boolean);
        if (!items.length) return '';
        return '[UI_MENU]' + JSON.stringify({ title: c.title || 'Món phù hợp với anh/chị', items: items }) + '[/UI_MENU]';
      } catch (e) { return ''; }
    },

    async _handleMultiIntent(subInputs, role, sid, opts) {
      const parts = [];
      const refusal = 'Dạ anh/chị không có quyền truy cập nội dung này. Chức năng chỉ dành cho nhân viên được cấp quyền của quán ạ.';
      for (const raw of (subInputs || []).slice(0, 5)) {
        if (!raw || !String(raw).trim()) continue;
        try {
          if (typeof IntentAuthorization !== 'undefined' && typeof IntentAuthorization.check === 'function') {
            const auth = IntentAuthorization.check(raw, role);
            if (auth && auth.allowed === false) {
              parts.push(refusal);
              AIMetrics.record('auth_block', { intent: auth.intent, role });
              continue;
            }
          }
          const ans = await this._answerLocal(raw, role);
          parts.push(ans || (('Dạ em đã ghi nhận phần "' + String(raw).trim().slice(0, 120) + '". '
            + 'Anh/chị hỏi sâu hơn giúp em nhé, ví dụ giờ mở cửa, gợi ý món hoặc đặt bàn ạ.')));
        } catch (e) {
          parts.push('Dạ có lỗi khi xử lý ý "' + String(raw).trim().slice(0, 80) + '". Anh/chị hỏi lại bằng cách đơn giản hơn nhé ạ.');
        }
      }
      return { type: 'text', message: parts.join('\n\n'), source: 'multi', role, sid };
    },

    async _answerLocal(raw, role) {
      const n = KBFast._norm(raw);
      const kb = KBFast.answer(raw);
      if (kb) return kb;
      try {
        const l = LocalBrain.answer(raw);
        if (l && l.confidence >= AI_LOCAL_MIN_CONF && l.text) return l.text;
      } catch (e) {}
      try {
        const g = AIBrainLegacy.tryReply(raw);
        if (g) return g;
      } catch (e) {}
      return null;
    },

    _drafts: {},
    DRAFT_KEY: 'cappan_ai_drafts_v6',
    _draftsLoaded: false,
    _loadDrafts() {
      if (!this._draftsLoaded) {
        try { this._drafts = JSON.parse(localStorage.getItem(this.DRAFT_KEY) || '{}') || {}; } catch (e) { this._drafts = {}; }
        const now = Date.now();
        Object.keys(this._drafts).forEach(k => {
          const d = this._drafts[k];
          if (!d || !d._ts || (now - d._ts > 30 * 60 * 1000)) delete this._drafts[k];
        });
        this._draftsLoaded = true;
      }
      return this._drafts;
    },
    _saveDrafts() { try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this._drafts)); } catch (e) {} },
    _draftSet(sid, st) { st._ts = Date.now(); this._loadDrafts()[sid] = st; this._saveDrafts(); return st; },
    _draftDel(sid) { this._loadDrafts(); delete this._drafts[sid]; this._saveDrafts(); },

    _isoDate(label) {
      const p = n => String(n).padStart(2, '0');
      const fmt = d => d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      const d = new Date();
      const fixed = { 'Hôm nay': 0, 'Ngày mai': 1, 'Ngày mốt': 2 };
      if (label in fixed) { d.setDate(d.getDate() + fixed[label]); return fmt(d); }
      const m = String(label).match(/(\d)/);
      const target = m ? (parseInt(m[1], 10) - 1) : 0;
      d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
      return fmt(d);
    },

    _validateSlot(iso, time) {
      const today = API.utils.today();
      if (iso < today) return 'Không thể đặt chỗ cho ngày đã qua';
      const p = n => String(n).padStart(2, '0');
      const mx = new Date(); mx.setDate(mx.getDate() + 14);
      const maxStr = mx.getFullYear() + '-' + p(mx.getMonth() + 1) + '-' + p(mx.getDate());
      if (iso > maxStr) return 'Chỉ nhận đặt trước tối đa 14 ngày';
      const [h, m] = String(time).split(':').map(Number);
      const mins = h * 60 + m;
      if (mins < 420 || mins > 1320) return 'Giờ đặt phải trong khoảng 07:00 – 22:00';
      if (iso === today) {
        const n = new Date();
        const nowMins = n.getHours() * 60 + n.getMinutes();
        if (mins < nowMins) return 'Giờ này đã qua, vui lòng chọn giờ sau';
        if (mins < nowMins + 30) return 'Cần đặt trước ít nhất 30 phút';
      }
      return null;
    },

    _parseQty(n) {
      const d = String(n).match(/\b(\d{1,3})\b/);
      if (d && parseInt(d[1], 10) <= 50) return parseInt(d[1], 10);
      const w = String(n).match(/\b(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/);
      if (w && typeof LocalBrain !== 'undefined' && LocalBrain.NUMW) return LocalBrain.NUMW[w[1]] || 1;
      return null;
    },

    _parseDateTime(n) {
      let date = 'Hôm nay';
      if (/\b(ngay mai|toi mai|sang mai|chieu mai|hom sau)\b/.test(n)) date = 'Ngày mai';
      else if (/\b(ngay mot|hom kia)\b/.test(n)) date = 'Ngày mốt';
      else if (/\b(thu 2|thu 3|thu 4|thu 5|thu 6|thu 7|chu nhat)\b/.test(n)) {
        const hit = String(n).match(/\b(thu \d|chu nhat)\b/)[0];
        date = hit === 'chu nhat' ? 'Chủ nhật' : 'Thứ ' + hit.replace('thu ', '');
      }
      let time = null;
      const m = String(n).match(/(\d{1,2})\s*(?:h|:|gio|gi)\s*(\d{1,2})?/);
      if (m) {
        let hh = parseInt(m[1], 10);
        const mm = m[2] ? parseInt(m[2], 10) : 0;
        if (/\b(toi|chieu)\b/.test(n) && hh >= 1 && hh <= 11) hh += 12;
        if (hh >= 0 && hh <= 23 && mm <= 59) time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      }
      if (!time && /\b(toi nay|buoi toi)\b/.test(n)) time = '19:00';
      if (!time && /\b(sang|buoi sang)\b/.test(n)) time = '09:00';
      if (!time && /\b(chieu|buoi chieu)\b/.test(n)) time = '15:00';
      return time ? { date, time } : null;
    },

    _draftRepliesCart(qty, name) {
      return [
        { label: '🛒 Xem giỏ & Thanh toán', href: './cart.html' },
        { label: 'Gọi thêm món', text: 'gợi ý món khác' },
        { label: 'Bỏ món này', text: 'hủy' }
      ];
    },

    _selfService(n, sid, role) {
      if (role !== 'customer') return null;
      if (typeof API === 'undefined' || !API.users) return null;

      const wantsCancelBk = /\b(huy|thu hoi)\b/.test(n)
        && /\b(ban|cho|booking|dat cho|bk)\b/.test(n)
        && !/\b(mon|gio hang|don)\b/.test(n);
      if (wantsCancelBk) {
        const me = API.users.getCurrent();
        if (!me) return this._serviceNeedLogin('hủy booking');
        const bks = (API.bookings.getByUser(me.id) || []).filter(b => b && b.status === 'confirmed');
        if (!bks.length) {
          return {
            type: 'text',
            message: 'Dạ hiện anh/chị **chưa có booking nào đang hoạt động** ạ. Anh/chị muốn đặt bàn mới thì bấm chip số người ở thẻ bên dưới nhé ạ?\n[UI_BOOKING_PLAN]{"guests":[1,2,4,6,8]}[/UI_BOOKING_PLAN]',
            source: 'draft', intent: 'booking_cancel'
          };
        }
        const mCode = n.match(/\bbk[a-z0-9]+\b/);
        const target = mCode ? (bks.find(b => String(b.id).toLowerCase() === mCode[0]) || null) : (bks.length === 1 ? bks[0] : null);
        if (target) {
          this._draftSet(sid, { kind: 'cancel', stage: 'confirm', bkId: target.id, bkIds: bks.map(b => b.id) });
          return this._cancelOffer(target, bks);
        }
        this._draftSet(sid, { kind: 'cancel', stage: 'choose', bkIds: bks.map(b => b.id) });
        return {
          type: 'text',
          message: `Dạ anh/chị đang giữ **${bks.length} bàn**. Bấm nút **✗ Hủy** bên cạnh bàn cần hủy ở thẻ bên dưới ạ (hoặc gõ "hủy BK…mã"):\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks: bks, ask: true })}[/UI_BOOKING_CANCEL]`,
          source: 'draft', intent: 'booking_cancel'
        };
      }

      const qCart = /\b(gio hang cua toi|gio cua toi|xem gio hang|gio hang)\b/.test(n);
      if (qCart) {
        const items = API.cart.get() || [];
        const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
        return {
          type: 'text',
          message: (items.length
            ? `Dạ giỏ hàng của anh/chị hiện có **${items.length} món** — tổng **${API.utils.formatVND(total)}** ạ. Bấm bên dưới để thanh toán nhé ạ!`
            : 'Dạ giỏ hàng của anh/chị **đang trống** ạ. Anh/chị muốn em gợi ý món ngon không ạ?'),
          source: 'draft', intent: 'service',
          quickReplies: items.length
            ? [{ label: '🛒 Thanh toán', href: './cart.html' }, { label: '🍲 Gọi thêm', text: 'gợi ý món khác' }]
            : [{ label: '🍲 Gợi ý món', text: 'gợi ý món' }, { label: '📖 Xem menu', href: './menu.html' }]
        };
      }

      const qBks = /\b(booking cua toi|dat cho cua toi|dat ban cua toi|ban da dat|ban cua toi|cho ngon? cua toi)\b/.test(n);
      const qOrders = /\b(don hang cua toi|don cua toi|don hang cua minh|lich su mua hang|lich su dat hang|don nao cua toi)\b/.test(n);
      const qInfo = /\b(thong tin cua toi|thong tin ca nhan cua toi|ho so cua toi|tai khoan cua toi|em la ai)\b/.test(n);
      const qPoints = /\b(diem cua toi|diem tich luy|diem thuong|bao nhieu diem)\b/.test(n);
      const qVou = /\b(voucher cua toi|uu dai cua toi|ma giam gia cua toi)\b/.test(n);
      if (!qBks && !qOrders && !qInfo && !qPoints && !qVou) return null;

      const me2 = API.users.getCurrent();
      if (!me2) return this._serviceNeedLogin('xem thông tin của mình');

      const orders = API.orders.getByUser(me2.id) || [];
      const spend = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.total) || 0), 0);
      const myBks = (API.bookings.getByUser(me2.id) || []).filter(b => b && b.status === 'confirmed');

      if (qBks) {
        if (!myBks.length) {
          return { type: 'text', message: 'Dạ anh/chị **chưa có booking nào đang hoạt động** ạ. Anh/chị muốn đặt bàn thì bấm chip số người ở thẻ nhé ạ?\n[UI_BOOKING_PLAN]{"guests":[1,2,4,6,8]}[/UI_BOOKING_PLAN]', source: 'draft', intent: 'service' };
        }
        return {
          type: 'text',
          message: `Dạ đây là **${myBks.length} booking đang hoạt động** của anh/chị ạ. Muốn hủy bàn nào, bấm nút **✗ Hủy** bên cạnh bàn đó nhé ạ:\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks: myBks, ask: false })}[/UI_BOOKING_CANCEL]`,
          source: 'draft', intent: 'service'
        };
      }
      if (qOrders) {
        if (!orders.length) {
          return {
            type: 'text',
            message: 'Dạ anh/chị **chưa có đơn hàng nào** ạ. Mời anh/chị xem gợi ý món ngon bằng nút bên dưới nhé ạ!\n[UI_ORDER_ADDED]{"name":"Bắt đầu gọi món","qty":0,"total":0,"empty":true}[/UI_ORDER_ADDED]',
            source: 'draft', intent: 'service'
          };
        }
        const recent = orders.slice(-3).reverse();
        return {
          type: 'text',
          message: `Dạ đây là **${orders.length} đơn hàng** gần nhất của anh/chị ạ. Trạng thái từng đơn hiển thị trong thẻ ạ:\n[UI_ORDER]${JSON.stringify({ title: 'Đơn của tôi', total: orders.length, orders: recent })}[/UI_ORDER]`,
          source: 'draft', intent: 'service'
        };
      }
      const mem = (typeof UserMemory !== 'undefined' && UserMemory.get) ? UserMemory.get(me2.id) : null;
      const prof = { name: me2.name || '', phone: me2.phone || '', email: me2.email || '', id: me2.id, bookings: myBks.length, orders: orders.length, spend: spend, mem: mem ? { orderCount: mem.orderCount || 0, totalSpent: mem.totalSpent || 0, favTags: (mem.favTags || []).slice(-3) } : null };
      let lead = 'Dạ em đọc hết **hồ sơ anh/chị trong hệ thống CAPPAN** rồi nhé ạ:';
      if (qPoints) lead = `Dạ theo hồ sơ, anh/chị đã chi **${API.utils.formatVND(spend || (prof.mem && prof.mem.totalSpent) || 0)}** qua **${Math.max(orders.length, prof.mem ? prof.mem.orderCount : 0)} đơn** ạ. Chi tiết trong thẻ ạ:`;
      return {
        type: 'text',
        message: lead + '\n[UI_MY_INFO]' + JSON.stringify(prof) + '[/UI_MY_INFO]',
        source: 'draft', intent: 'service'
      };
    },

    _serviceNeedLogin(what) {
      return {
        type: 'text',
        message: `Dạ để ${what}, anh/chị cần **đăng nhập** trước nhé ạ. Anh/chị bấm nút bên dưới để đăng nhập/tạo tài khoản ạ!\n[UI_NEED_LOGIN]{}[/UI_NEED_LOGIN]`,
        source: 'draft', intent: 'service'
      };
    },

    _cancelOffer(bk, bks) {
      return {
        type: 'text',
        message: `Dạ em xác nhận: booking **${bk.id}** — bàn **${bk.seatId}** cho ${bk.guests} người, lúc **${bk.time}** ${String(bk.date || '').toLowerCase()}.\nAnh/chị bấm nút để **hủy** (hoặc giữ bàn) nhé ạ?\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks: [bk], ask: true, confirm: true })}[/UI_BOOKING_CANCEL]`,
        source: 'draft', intent: 'booking_cancel'
      };
    },

    _cancelBookingStep(st, n, sid) {
      const me = API.users.getCurrent();
      const all = me ? (API.bookings.getByUser(me.id) || []).filter(b => b && b.status === 'confirmed') : [];

      if (/\b(thoi|khong|dung lai|bo qua|giu lai|giu ban|giu)\b/.test(n)) {
        this._draftDel(sid);
        return { type: 'text', message: 'Dạ em giữ nguyên bàn cho anh/chị. Anh/chị cần chi tiết khác thì nói giúp em ạ!', source: 'draft', intent: 'booking_cancel' };
      }

      const mCode = n.match(/\bbk[a-z0-9]+\b/);
      const bk = mCode ? all.find(b => String(b.id).toLowerCase() === mCode[0]) : all.find(b => b.id === st.bkId);

      if (st.stage === 'choose' && !bk) {
        return { type: 'text', message: 'Dạ anh/chị bấm nút **✗ Hủy** của bàn cần hủy ở thẻ bên dưới, hoặc gõ "hủy BK…mã" giùm em ạ.', source: 'draft', intent: 'booking_cancel' };
      }
      if (!bk) return { type: 'text', message: 'Dạ bàn anh/chị cần hủy hiện **không còn hoạt động** (có thể đã bị hủy hoặc hết hạn). Anh/chị cần em đặt bàn mới không ạ?', source: 'draft', intent: 'booking_cancel' };

      if (st.stage === 'choose') {
        this._draftSet(sid, { kind: 'cancel', stage: 'confirm', bkId: bk.id, bkIds: all.map(b => b.id) });
        return this._cancelOffer(bk, all);
      }

      if (st.stage === 'confirm') {
        // P3.1: đổi ý muốn sửa
        if (/\b(doi|sua|chinh|thay)\b/.test(n) && /\b(gio|ban|ngay|cho|dat)\b/.test(n)) {
          this._draftDel(sid);
          return {
            type: 'text',
            message: 'Dạ em đã hủy yêu cầu hủy bàn. Nếu muốn đổi giờ/bàn khác, anh/chị gõ **"đặt bàn mới"** giúp em nhé ạ!',
            source: 'draft', intent: 'booking_cancel',
            quickReplies: [
              { label: '🪑 Đặt bàn mới', text: 'đặt bàn' },
              { label: '📅 Booking của tôi', text: 'booking của tôi' }
            ]
          };
        }
        // P3.2: confirm phải rõ ràng
        const t = n.trim();
        const isConfirm = /\b(huy|xac nhan|dong y|huy xo|chot)\b/.test(n)
          || /^(ok|oke|duoc|u|uh|vang|yes)\s*[.!?]?$/.test(t);
        if (!isConfirm) return this._cancelOffer(bk, all);
      } else {
        // P3.3: defense
        return this._cancelOffer(bk, all);
      }

      const res = API.bookings.cancel(bk.id);
      this._draftDel(sid);
      if (!res) return { type: 'text', message: 'Dạ hệ thống báo **không hủy được** booking này (có thể đã có thay đổi). Anh/chị kiểm tra lại giúp em nhé ạ!', source: 'draft', intent: 'booking_cancel' };
      return {
        type: 'text',
        message: `🚫 Dạ em đã **hủy thành công** booking **${bk.id}** (bàn ${bk.seatId}, ${bk.time} ${String(bk.date || '').toLowerCase()}) ạ. Anh/chị bấm nút bên dưới nếu cần em hỗ trợ tiếp nhé!\n[UI_BOOKING_CANCELLED]${JSON.stringify({ id: bk.id, seat: bk.seatId, date: bk.date, time: bk.time, guests: bk.guests })}[/UI_BOOKING_CANCELLED]`,
        source: 'draft', intent: 'booking_cancel'
      };
    },

    /* ═══════════════════════════════════════════════════════════
      ⚡ P4.1 — CHECKOUT STEP (mới)
    ═══════════════════════════════════════════════════════════ */
    _checkoutStep(st, n, sid) {
      const me = API.users.getCurrent();
      if (!me) return this._serviceNeedLogin('thanh toán');

      // 1. Sửa thông tin
      if (/\b(sua|doi|thay|cap nhat|chinh)\b/.test(n) && /\b(thong tin|dia chi|sdt|dien thoai|phone)\b/.test(n)) {
        const isPhoneIntent = /\b(sdt|dien thoai|phone|so dien thoai)\b/.test(n);
        const isAddrIntent = /\b(dia chi|noi o|cho o|giao hang)\b/.test(n);
        const phoneMatch = n.match(/(0\d{9,10})/);
        const patch = {};

        if (isPhoneIntent && phoneMatch) patch.phone = phoneMatch[1];

        if (isAddrIntent) {
          let newAddr = n.replace(/^(?:sua|doi|thay|cap nhat|chinh|doi lai|sua lai)\s+(?:dia chi|thong tin giao hang|thong tin|dia chi moi|noi o|cho o)(?:\s+(?:thanh|sang|qua|toi|la))?\s*/i, '').trim();
          const afterThanh = n.match(/(?:thanh|sang|qua|toi)\s+(.+)$/i);
          if (afterThanh) newAddr = afterThanh[1].trim();
          if (newAddr.length >= 5) patch.address = newAddr;
        }

        if (Object.keys(patch).length > 0) {
          API.users.update(me.id, patch);
          if (typeof updateUserArea === 'function') updateUserArea();
          if (patch.address) st.address = patch.address;
          if (patch.phone) st.phone = patch.phone;
          this._draftSet(sid, st);
          const changes = [];
          if (patch.address) changes.push(`địa chỉ: **${patch.address}**`);
          if (patch.phone) changes.push(`SĐT: **${patch.phone}**`);
          return {
            type: 'text',
            message: `✓ Đã cập nhật ${changes.join(' và ')} ạ.\nAnh/chị xác nhận đặt hàng nhé:`,
            source: 'draft', intent: 'checkout',
            cards: `[UI_ORDER_CHECKOUT]${JSON.stringify({ name: st.name, phone: st.phone, address: st.address, total: st.total })}[/UI_ORDER_CHECKOUT]`
          };
        }

        // Không có gì để update → chuyển sang chờ nhập
        if (isPhoneIntent) {
          this._draftSet(sid, { kind: 'update_addr', stage: 'waiting', field: 'phone', _backupCheckout: { ...st } });
          return { type: 'text', message: 'Dạ anh/chị cho em **SĐT mới** ạ (VD: "0909123456").', source: 'draft' };
        }
        this._draftSet(sid, { kind: 'update_addr', stage: 'waiting', field: 'address', _backupCheckout: { ...st } });
        return { type: 'text', message: 'Dạ anh/chị cho em **địa chỉ mới** ạ (VD: "123 Lê Lợi, Q.1").', source: 'draft' };
      }

      // 2. Hủy checkout
      if (/\b(huy|thoi|khong dat|bo qua)\b/.test(n) && !/\b(xac nhan|ok)\b/.test(n)) {
        this._draftDel(sid);
        return {
          type: 'text',
          message: 'Dạ em đã hủy yêu cầu đặt hàng. Giỏ hàng của anh/chị **vẫn giữ nguyên** ạ.',
          source: 'draft', intent: 'checkout',
          quickReplies: [{ label: '🛒 Xem giỏ', href: './cart.html' }, { label: '📖 Xem menu', href: './menu.html' }]
        };
      }

      // 3. Xác nhận → tạo đơn THẬT
      if (/\b(xac nhan|dong y|chot|dat hang ngay|duyet don)\b/.test(n) || /^(ok|oke)\s*[.!?]?$/.test(n.trim())) {
        if (!Array.isArray(st.cart) || !st.cart.length) {
          this._draftDel(sid);
          return { type: 'text', message: 'Dạ giỏ hàng trống, không thể đặt ạ.', source: 'draft', intent: 'checkout' };
        }
        let order = null;
        try {
          order = API.orders.create({
            userId: me.id, items: st.cart, total: st.total,
            subtotal: Math.max(0, st.total - 15000), shipping: 15000,
            discount: 0, promoCode: '', address: st.address,
            phone: st.phone, note: '', customerName: st.name
          });
        } catch (e) {
          return { type: 'text', message: 'Dạ em gặp lỗi khi tạo đơn. Anh/chị thử lại giúp em nhé!', source: 'draft', intent: 'checkout' };
        }
        if (!order || !order.id) {
          return { type: 'text', message: 'Dạ không tạo được đơn. Anh/chị thử lại nhé!', source: 'draft', intent: 'checkout' };
        }
        API.cart.clear();
        if (typeof updateUserArea === 'function') updateUserArea();
        this._draftDel(sid);
        return {
          type: 'text',
          message: `🎉 Dạ em đã **đặt hàng thành công** đơn **${order.id}** ạ!\nTổng tiền: **${API.utils.formatVND(order.total)}**.\nAnh/chị theo dõi shipper bên dưới nhé:`,
          source: 'draft', intent: 'checkout',
          cards: `[UI_LIVE_ORDER]${JSON.stringify({ ...order, staff: false })}[/UI_LIVE_ORDER]`,
          quickReplies: [
            { label: '📦 Xem lịch sử đơn', text: 'lịch sử đơn' },
            { label: '🏠 Về trang chủ', href: './index.html' }
          ]
        };
      }

      // 4. Fallback
      return {
        type: 'text',
        message: 'Dạ em đang chờ xác nhận đơn ạ. Bấm **✓ Xác nhận** để đặt, hoặc gõ **"hủy"** để thoát và giữ giỏ hàng nhé!',
        source: 'draft', intent: 'checkout',
        cards: `[UI_ORDER_CHECKOUT]${JSON.stringify({ name: st.name, phone: st.phone, address: st.address, total: st.total })}[/UI_ORDER_CHECKOUT]`
      };
    },

    /* ═══════════════════════════════════════════════════════════
      ⚡ P4.2 — UPDATE ADDR/PHONE STEP (mới)
    ═══════════════════════════════════════════════════════════ */
    _updateAddrStep(st, n, sid) {
      const me = API.users.getCurrent();
      if (!me) return this._serviceNeedLogin('cập nhật thông tin');

      const backup = st._backupCheckout || null;

      // Hủy
      if (/^(thoi|huy|khong|bo qua|de sau)\s*[.!?]?$/.test(n.trim())) {
        this._draftDel(sid);
        if (backup) {
          this._draftSet(sid, backup);
          return {
            type: 'text',
            message: 'Dạ em giữ địa chỉ cũ. Anh/chị xác nhận đặt hàng nhé:',
            source: 'draft', intent: 'checkout',
            cards: `[UI_ORDER_CHECKOUT]${JSON.stringify({ name: backup.name, phone: backup.phone, address: backup.address, total: backup.total })}[/UI_ORDER_CHECKOUT]`
          };
        }
        return { type: 'text', message: 'Dạ em đã hủy. Anh/chị cần gì khác không ạ?', source: 'draft' };
      }

      // Phone mode
      if (st.field === 'phone') {
        const phoneMatch = n.match(/(0\d{9,10})/);
        if (!phoneMatch) {
          return { type: 'text', message: 'Dạ SĐT chưa đúng, anh/chị gõ lại ạ (VD: "0909123456").', source: 'draft' };
        }
        API.users.update(me.id, { phone: phoneMatch[1] });
        if (typeof updateUserArea === 'function') updateUserArea();
        this._draftDel(sid);
        if (backup) {
          backup.phone = phoneMatch[1];
          this._draftSet(sid, backup);
          return {
            type: 'text',
            message: `✓ Đã cập nhật SĐT mới: **${phoneMatch[1]}**\nAnh/chị xác nhận đặt hàng nhé:`,
            source: 'draft', intent: 'checkout',
            cards: `[UI_ORDER_CHECKOUT]${JSON.stringify({ name: backup.name, phone: phoneMatch[1], address: backup.address, total: backup.total })}[/UI_ORDER_CHECKOUT]`
          };
        }
        return {
          type: 'text',
          message: `✓ Đã cập nhật SĐT: **${phoneMatch[1]}**`,
          source: 'draft',
          quickReplies: [{ label: '🛒 Đặt hàng', href: './order.html' }, { label: '📝 Hồ sơ', href: './profile.html' }]
        };
      }

      // Address mode (default)
      const cleaned = String(n).replace(/^(dia chi (moi )?(la |thanh |sang )?|nha (toi |minh )?o )/, '').trim();
      if (cleaned.length < 5) {
        return { type: 'text', message: 'Dạ địa chỉ hơi ngắn, anh/chị ghi rõ hơn nhé ạ (VD: "123 Lê Lợi, Q.1").', source: 'draft' };
      }
      API.users.update(me.id, { address: cleaned });
      if (typeof updateUserArea === 'function') updateUserArea();
      this._draftDel(sid);
      if (backup) {
        backup.address = cleaned;
        this._draftSet(sid, backup);
        return {
          type: 'text',
          message: `✓ Đã cập nhật địa chỉ mới: **${cleaned}**\nAnh/chị xác nhận đặt hàng nhé:`,
          source: 'draft', intent: 'checkout',
          cards: `[UI_ORDER_CHECKOUT]${JSON.stringify({ name: backup.name, phone: backup.phone, address: cleaned, total: backup.total })}[/UI_ORDER_CHECKOUT]`
        };
      }
      return {
        type: 'text',
        message: `✓ Đã cập nhật địa chỉ: **${cleaned}**`,
        source: 'draft',
        quickReplies: [{ label: '🛒 Đặt hàng ngay', href: './order.html' }, { label: '📝 Hồ sơ', href: './profile.html' }]
      };
    },

    _draftEngine(text, sid, role, inp) {
      this._loadDrafts();
      const r = this._draftEngineCore(text, sid, role, inp);
      if (this._drafts[sid]) this._drafts[sid]._ts = Date.now();
      this._saveDrafts();
      return r;
    },

    _draftEngineCore(text, sid, role, inp) {
      if (role === 'guest') {
        const n0 = (typeof AIInput !== 'undefined' && AIInput.normalize) ? AIInput.normalize(text).norm : normVN(text);
        return /\b(dat ban|dat cho|book ban|giu ban)\b/.test(n0)
          ? this._serviceNeedLogin('đặt bàn')
          : null;
      }
      if (role !== 'customer') return null;
      const n = (typeof AIInput !== 'undefined' && AIInput.normalize) ? AIInput.normalize(text).norm : normVN(text);
      const cancel = /\b(huy|khong dat)\b/.test(n)
        || /\bbo\s+(di|qua|mon|cho|dat)\b/.test(n)
        || /^(bo|thoi)$/.test(n.trim());

      const st = this._drafts[sid];
      if (st) {
        // ⚡ P1: Registry dispatch
        const HANDLERS = {
          order:       () => this._orderStep(st, n, sid),
          booking:     () => this._bookingStep(st, n, sid),
          cancel:      () => this._cancelBookingStep(st, n, sid),
          checkout:    () => this._checkoutStep(st, n, sid),
          update_addr: () => this._updateAddrStep(st, n, sid)
        };

        if (st.kind === 'order' || st.kind === 'booking') {
          if (cancel) {
            delete this._drafts[sid];
            return { type: 'text', message: 'Dạ em đã hủy yêu cầu đang làm dở theo anh/chị ạ. Anh/chị cần em giúp gì khác không?' };
          }
        }

        const handler = HANDLERS[st.kind];
        if (handler) {
          const res = handler();
          if (res) return res;
        }
      }

      if (cancel) return null;

      if (/\b(dat ban|dat (cho|ghe)|book ban|giu ban|muon dat ban)\b/.test(n)) {
        const g0 = this._parseQty(n);
        const dt0 = this._parseDateTime(n);
        this._drafts[sid] = { kind: 'booking', stage: g0 ? (dt0 ? 'confirm' : 'ask_time') : 'ask_guests', data: { guests: g0 || null, date: dt0 ? dt0.date : null, time: dt0 ? dt0.time : null }, label: 'đặt bàn', seatId: null };
        if (g0 && dt0) return this._bookingStep(this._drafts[sid], n, sid);
        if (g0) return this._bookingStep(this._drafts[sid], n, sid);
        return {
          type: 'text',
          message: 'Dạ em hỗ trợ đặt bàn ngay ạ. Anh/chị bấm chọn **số người** ở thẻ bên dưới nhé ạ?\n[UI_BOOKING_PLAN]{"guests":[1,2,4,6,8]}[/UI_BOOKING_PLAN]',
          source: 'draft', intent: 'booking'
        };
      }

      const isOrder = /\b(dat|lay|goi|mua|them|order|cho toi)\b/.test(n)
        && !/\b(dat ban|dat (cho|ghe)|book ban|giu ban|goi y|tu van|khau vi|mon nao|gi vay|co sao|sao)\b/.test(n);
      if (isOrder && typeof LocalBrain !== 'undefined' && LocalBrain._findItems) {
        const items = LocalBrain._findItems(text) || [];
        const hit = (items.length && !items.generic) ? items[0].m : null;
        if (hit) {
          if (hit.inStock === false) return { type: 'text', message: 'Dạ **' + hit.name + '** hiện đã hết hàng ạ. Anh/chị chọn món khác nhé!', source: 'draft' };
          const qty = this._parseQty(n) || 1;
          this._drafts[sid] = { kind: 'order', stage: 'ask_time', itemId: hit.id, name: hit.name, price: hit.price, img: hit.img, qty, label: 'đặt ' + hit.name };
          const vnd = API.utils.formatVND(hit.price * qty);
          return {
            type: 'text',
            message: `Dạ em ghi nhận: **${hit.name}** x${qty} (${vnd}).\nAnh/chị bấm chọn **số lượng** và **cách nhận** ở thẻ bên dưới nhé ạ!\n[UI_ORDER_PICK]${JSON.stringify({ id: hit.id, name: hit.name, price: hit.price, qty: qty })}[/UI_ORDER_PICK]`,
            source: 'draft', intent: 'order'
          };
        }
      }
      return null;
    },

    _orderStep(st, n, sid) {
      // ⚡ P2: STATE waiting_pickup_time
      if (st.stage === 'waiting_pickup_time') {
        const dt = this._parseDateTime(n);
        if (!dt) {
          return {
            type: 'text',
            message: 'Dạ anh/chị cho em **giờ cụ thể** nhé (VD: "17h30" hoặc "chiều mai 15h") ạ?',
            source: 'draft', intent: 'order',
            quickReplies: [
              { label: '🕐 17h30', text: '17h30' },
              { label: '🕕 18h00', text: '18h00' },
              { label: '🕖 19h00', text: '19h00' }
            ]
          };
        }
        for (let i = 0; i < st.qty; i++) {
          API.cart.add({ itemId: st.itemId, name: st.name, price: st.price, img: st.img, size: 'M', toppings: [] });
        }
        delete this._drafts[sid];
        return {
          type: 'text',
          message: `Dạ em đã ghi nhận **${st.name}** x${st.qty} — lấy lúc **${dt.time}** ${dt.date.toLowerCase()} vào giỏ ạ.\nBấm nút bên dưới để thanh toán nhé ạ!\n[UI_ORDER_ADDED]${JSON.stringify({ name: st.name, qty: st.qty, total: st.price * st.qty, pickup: dt.time + ' ' + dt.date.toLowerCase() })}[/UI_ORDER_ADDED]`,
          source: 'draft', intent: 'order'
        };
      }

      const q = this._parseQty(n);
      const isPickQty = q && /^\s*(lay|chon|dat|mua)\s+\d+(\s+(ly|mon|phan|coc))?\s*$/i.test(n);
      if (q && q !== st.qty && /\b(lay|chon|them|huy|gia|dat|doi)\b/.test(n) && !/nguoi|khach/.test(n)) {
        st.qty = q;
        return {
          type: 'text',
          message: `Dạ em cập nhật **${st.name}** x${st.qty} (${API.utils.formatVND(st.price * st.qty)} ạ). Anh/chị bấm **cách nhận** ở thẻ bên dưới nhé ạ?\n[UI_ORDER_PICK]${JSON.stringify({ id: st.itemId, name: st.name, price: st.price, qty: st.qty })}[/UI_ORDER_PICK]`,
          source: 'draft', intent: 'order'
        };
      }

      // ⚡ P2: "Đặt giờ lấy" — set state
      if (/\b(dat gio lay|hen gio|gio lay|lay luc|lay vao|lay gio)\b/.test(n)) {
        st.stage = 'waiting_pickup_time';
        return {
          type: 'text',
          message: 'Dạ anh/chị muốn **lấy lúc mấy giờ** ạ? Bấm chip hoặc gõ giờ cụ thể nhé.',
          source: 'draft', intent: 'order',
          quickReplies: [
            { label: '🕐 17h30', text: '17h30' },
            { label: '🕕 18h00', text: '18h00' },
            { label: '🕖 19h00', text: '19h00' }
          ]
        };
      }

      if (isPickQty || /\b(nhan ngay|lay ngay|dat ngay|mua ngay|ok|oke)\b/.test(n)) {
        const qty = q || st.qty;
        for (let i = 0; i < qty; i++) {
          API.cart.add({ itemId: st.itemId, name: st.name, price: st.price, img: st.img, size: 'M', toppings: [] });
        }
        delete this._drafts[sid];
        return {
          type: 'text',
          message: `Dạ em đã thêm **${st.name}** x${qty} vào giỏ hàng ạ.\nAnh/chị bấm nút bên dưới để thanh toán nhé ạ!\n[UI_ORDER_ADDED]${JSON.stringify({ name: st.name, qty, total: st.price * qty })}[/UI_ORDER_ADDED]`,
          source: 'draft', intent: 'order'
        };
      }
      const dt = this._parseDateTime(n);
      if (dt) {
        for (let i = 0; i < st.qty; i++) API.cart.add({ itemId: st.itemId, name: st.name, price: st.price, img: st.img, size: 'M', toppings: [] });
        delete this._drafts[sid];
        return {
          type: 'text',
          message: `Dạ em đã ghi nhận **${st.name}** x${st.qty} — lấy lúc **${dt.time}** ${dt.date.toLowerCase()} vào giỏ ạ.\nBấm nút bên dưới để thanh toán nhé ạ!\n[UI_ORDER_ADDED]${JSON.stringify({ name: st.name, qty: st.qty, total: st.price * st.qty, pickup: dt.time + ' ' + dt.date.toLowerCase() })}[/UI_ORDER_ADDED]`,
          source: 'draft', intent: 'order'
        };
      }
      return { type: 'text', message: 'Dạ anh/chị muốn **nhận ngay** hay **đặt giờ lấy hàng** ạ?', source: 'draft', intent: 'order', quickReplies: [{ label: 'Nhận ngay', text: 'nhận ngay' }, { label: 'Đặt giờ lấy', text: 'đặt giờ lấy' }] };
    },

    _bookingStep(st, n, sid) {
      if (st.stage === 'ask_guests') {
        const g = this._parseQty(n);
        if (!g || g < 1 || g > 20) return { type: 'text', message: 'Dạ anh/chị cho em biết số người cụ thể nhé ạ (ví dụ "4 người").', source: 'draft', intent: 'booking' };
        st.data.guests = g;
        st.stage = 'ask_time';
        return {
          type: 'text',
          message: `Dạ bàn cho **${st.data.guests} người**. Anh/chị bấm chọn **khung giờ** ở thẻ bên dưới nhé ạ?\n[UI_TIME_PICK]{}[/UI_TIME_PICK]`,
          source: 'draft', intent: 'booking'
        };
      }
      if (st.stage === 'confirm') {
        if (this._bookingConfirmKey(n) && st.seatId) return this._bookingResolve(st, n, sid);
        if (!st.seatId) return this._bookingOffer(st, sid, n);
        const avail = (API.seats.getAll() || []).filter(s => s.status === 'available' && (s.capacity || 4) >= st.data.guests);
        const pickM = n.match(/\b(?:chon|muon|doi|lay)\s+(?:ban\s+)?([a-z0-9]+)\b/) || n.match(/\bban\s+([a-z0-9]+)\b/);
        if (pickM) {
          const cand = avail.find(s => String(s.id).toLowerCase() === pickM[1]);
          if (cand) { st.seatId = cand.id; return this._bookingOffer(st, sid, n); }
        }
        if (/\b(chon ban khac|ban khac|cho khac)\b/.test(n) && avail.length > 1) {
          const alt = avail.find(s => s.id !== st.seatId);
          st.seatId = alt.id;
          return this._bookingOffer(st, sid, n);
        }
        const dt = this._parseDateTime(n);
        if (dt) {
          st.data.date = dt.date;
          st.data.time = dt.time;
          return this._bookingOffer(st, sid, n);
        }
        const seat = API.seats.getById(st.seatId);
        if (!seat) { delete this._drafts[sid]; return { type: 'text', message: 'Dạ bàn hiện vừa có thay đổi. Anh/chị thử lại giúp em nhé!', source: 'draft', intent: 'booking' }; }
        return {
          type: 'text',
          message: `Dạ em xác nhận: bàn **${seat.id}** (sức chứa ${seat.capacity || 4}) cho **${st.data.guests} người**, lúc **${st.data.time}** ${st.data.date.toLowerCase()}.\nAnh/chị **xác nhận** giúp em nhé ạ?\n[UI_BOOKING_CONFIRM]${JSON.stringify({ seat: seat.id, cap: seat.capacity || 4, guests: st.data.guests, date: st.data.date, time: st.data.time, alts: avail.filter(s => s.id !== st.seatId).slice(0, 3).map(s => s.id) })}[/UI_BOOKING_CONFIRM]`,
          source: 'draft', intent: 'booking'
        };
      }
      if (st.stage === 'ask_time') {
        const dt = this._parseDateTime(n);
        if (!dt) return { type: 'text', message: 'Dạ anh/chị bấm khung giờ gợi ý ở thẻ bên dưới, hoặc gõ **giờ cụ thể** nhé ạ (ví dụ "19h" hoặc "8h sáng mai").\n[UI_TIME_PICK]{}[/UI_TIME_PICK]', source: 'draft', intent: 'booking' };
        st.data.date = dt.date; st.data.time = dt.time;

        const avail = (API.seats.getAll() || []).filter(s => s.status === 'available' && (s.capacity || 4) >= st.data.guests);
        if (!avail.length) {
          delete this._drafts[sid];
          return { type: 'text', message: `Dạ hiện **chưa có chỗ trống** phù hợp cho ${st.data.guests} người lúc ${dt.time} ${dt.date.toLowerCase()}. Anh/chị thử giờ khác hoặc gọi hotline ${kbGet('store.hotline', '0366 444 038')} ạ.`, source: 'draft', intent: 'booking' };
        }
        st.seatId = avail[0].id;
        return this._bookingOffer(st, sid, n);
      }
      return null;
    },

    _bookingOffer(st, sid, rawText) {
      if (st.data.date && st.data.time) {
        const err = this._validateSlot(this._isoDate(st.data.date), st.data.time);
        if (err) {
          st.stage = 'ask_time';
          st.seatId = null;
          return {
            type: 'text',
            message: `Dạ ${err} ạ. Anh/chị chọn khung giờ khác giúp em nhé:\n[UI_TIME_PICK]{}[/UI_TIME_PICK]`,
            source: 'draft', intent: 'booking'
          };
        }
      }
      const avail = (API.seats.getAll() || []).filter(s => s.status === 'available' && (s.capacity || 4) >= st.data.guests);
      if (!avail.length) {
        delete this._drafts[sid];
        return { type: 'text', message: `Dạ hiện **chưa có chỗ trống** phù hợp cho ${st.data.guests} người lúc ${st.data.time} ${st.data.date ? st.data.date.toLowerCase() : ''}. Anh/chị thử giờ khác hoặc gọi hotline ${kbGet('store.hotline', '0366 444 038')} ạ.`, source: 'draft', intent: 'booking' };
      }
      st.seatId = (st.seatId && avail.some(s => s.id === st.seatId)) ? st.seatId : avail[0].id;
      st.stage = 'confirm';
      const seat = API.seats.getById(st.seatId) || avail[0];
      const alts = avail.filter(s => s.id !== st.seatId).slice(0, 3).map(s => s.id);
      const payload = JSON.stringify({ seat: seat.id, cap: seat.capacity || 4, guests: st.data.guests, date: st.data.date, time: st.data.time, alts: alts, more: Math.max(0, avail.length - 1 - alts.length) });
      return {
        type: 'text',
        message: `Dạ em gợi ý: bàn **${seat.id}** (sức chứa ${seat.capacity || 4}) trống lúc **${st.data.time}** ${st.data.date ? st.data.date.toLowerCase() : ''} — cho **${st.data.guests} người**.\nAnh/chị kiểm tra thẻ bên dưới rồi **xác nhận** nhé ạ?\n[UI_BOOKING_CONFIRM]${payload}[/UI_BOOKING_CONFIRM]`,
        source: 'draft', intent: 'booking'
      };
    },

    // ⚡ P5: tighter confirm regex
    _bookingConfirmKey(n) {
      const t = n.trim();
      return /^(xac nhan|dong y|chot|dung roi|duoc roi|ok dat|yes)\b/.test(t)
        || /^(ok|oke|duoc)\s*[.!?]?$/.test(t)
        || /\b(xac nhan dat (cho|ban)|chot ban|dat di)\b/.test(n);
    },

    _bookingResolve(st, n, sid) {
      const me = API.users.getCurrent();
      if (me && (API.bookings.getByUser(me.id) || []).filter(b => b.status === 'confirmed').length >= 3) {
        this._draftDel(sid);
        return { type: 'text', message: 'Dạ anh/chị đang có **3 booking hoạt động** rồi ạ. Mình hoàn tất/hủy bớt rồi đặt thêm giúp em nhé!', source: 'draft', intent: 'booking' };
      }
      const seat = API.seats.getById(st.seatId);
      if (!seat) { this._draftDel(sid); return { type: 'text', message: 'Dạ bàn vừa có thay đổi. Anh/chị thử lại giúp em nhé!', source: 'draft', intent: 'booking' }; }
      const label = st.data.date;
      const isoDate = this._isoDate(label);
      const bk = API.bookings.create({
        userId: me ? me.id : '',
        seatId: seat.id,
        floorId: seat.floorId,
        date: isoDate,
        time: st.data.time,
        guests: st.data.guests,
        note: ''
      });
      this._draftDel(sid);
      if (!bk) return { type: 'text', message: 'Dạ hệ thống báo chỗ vừa được người khác giữ mất rồi. Anh/chị thử lại giúp em nhé!', source: 'draft', intent: 'booking' };
      return {
        type: 'text',
        message: `🎉 Dạ em đã **đặt thành công** bàn **${bk.seatId}** cho ${bk.guests} người, lúc **${bk.time}** ${label.toLowerCase()} ạ.\nMã đặt chỗ: **${bk.id}**. Hẹn gặp anh/chị tại CAPPAN ạ!\n[UI_BOOKING_DONE]${JSON.stringify({ id: bk.id, seat: bk.seatId, guests: bk.guests, date: label, time: bk.time })}[/UI_BOOKING_DONE]`,
        source: 'draft', intent: 'booking'
      };
    },

    // ⚡ P7.1: bỏ chip "Đặt món thứ 1"
    _quickRepliesFor(text, source, intent) {
      try {
        const n = (typeof AIInput !== 'undefined' && AIInput.normalize) ? AIInput.normalize(text).norm : String(text || '').toLowerCase();
        const cart = [{ label: '🛒 Xem giỏ & Thanh toán', href: './cart.html' }, { label: 'Gọi thêm món', text: 'gợi ý món khác' }];
        const recs = [
          { label: '🔄 Gợi ý khác', text: 'gợi ý món khác' },
          { label: '📖 Menu đầy đủ', href: './menu.html' }
        ];
        const timeOpts = ['Tối nay', 'Ngày mai', 'Cuối tuần này'];
        const menuQ = ['Menu có gì?', 'Còn chỗ yên tĩnh không?', 'Đặt nước thế nào?'];
        switch (source) {
          case 'kb': return n.length <= 2 ? menuQ : ['Menu có gì?', 'Đặt chỗ thế nào?', 'Còn khuyến mãi gì?'];
          case 'rule':
            if (intent === 'action' || intent === 'order') return cart;
            if (intent === 'drink') return recs;
            if (intent === 'booking' || intent === 'seat') return timeOpts;
            return null;
          case 'down': return [{ label: 'Thử lại', text: 'gợi ý món' }, { label: '☎ Gọi hotline', href: 'tel:' + String(kbGet('store.hotline', '0366 444 038')).replace(/\D/g, '') }];
          default: return null;
        }
      } catch (e) { return null; }
    },

    async streamReply(text, onChunk, opts) {
      const sid = this._getSessionId();
      const role = sid.startsWith('staff') ? 'staff' : 'customer';
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      let ttft = null;
      this._turnTools = [];
      this._turnModel = '';

      const wrapped = (d, f) => {
        if (ttft == null) ttft = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        if (typeof onChunk === 'function') onChunk(d, f);
      };

      let res;
      try {
        res = await this._streamReplyCore(text, wrapped, opts);
      } catch (e) {
        AIMetrics.logTurn({
          q: text,
          res: { source: 'down', type: 'error', message: String(e && e.message || e) },
          ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
          role
        });
        throw e;
      }

      const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);

      try {
        const h = this._getHistory(sid);
        const last = h[h.length - 1];
        const hasContent = res && (res.message || res.cards);
        if (res && res.type !== 'pending' && hasContent && !(last && last.role === 'assistant')) {
          this._pushHistory(sid, 'assistant', (res.message || '') + (res.cards ? '\n' + res.cards : ''));
        }
      } catch (e) {}

      AIMetrics.logTurn({
        q: text, res, ms,
        ttft: ttft == null ? ms : ttft,
        role,
        tools: this._turnTools || [],
        model: this._turnModel || ''
      });

      return res;
    },

    _guardLLMClaim(msg, role) {
      const text = String(msg || '').trim();
      try {
        if (!text) return { message: text, source: 'llm' };
        const ranTools = Array.isArray(this._turnTools) ? this._turnTools : [];
        const MUTATING = /^(cancel_my_order|cancel_order|cancel_my_booking|cancel_booking|update_booking|reset_all_seats|create_order|create_booking|book_table|update_order)/;
        const ranOp = ranTools.some(n => MUTATING.test(n));
        if (ranOp) return { message: text, source: 'llm' };
        const successVerb = /(th\u00e0nh\s*c\u00f4ng|\u0111\u00e3\s+(\u0111a{0,1}\s*)?(\u0111\u1eb7t|h\u1ee7y|th\u00eam|x\u00f3a|thanh\s*to\u00e1n|ghi\s*nh\u1eadn)|em\s*\u0111\u00e3)/i;
        const fakeId = /(\bOD[a-z0-9]{4,12}\b|\bBK[a-z0-9]{4,12}\b|m\u00e3\s*(\u0111\u01a1n|\u0111\u1eb7t\s*ch\u1ed7))/i;
        if (successVerb.test(text) && fakeId.test(text)) {
          console.warn('[AIBrain] Chặn LLM tự tuyên bố thao tác dữ liệu không qua tool:', text.slice(0, 90));
          try { AIMetrics.record('llm_fake_claim', 1); } catch (e) {}
          return {
            message: 'Dạ em chưa thực hiện thao tác nào cả, anh/chị đừng lo ạ. Cần ' + (role === 'staff' ? 'xử lý đơn' : 'đặt nước hay đặt bàn') + ', cứ gõ trực tiếp trong khung chat này — em sẽ hiện **thẻ chọn** và **xác nhận** thật từng bước cho anh/chị ạ.',
            source: 'guard'
          };
        }
      } catch (e) {}
      return { message: text, source: 'llm' };
    },

    async _streamReplyCore(text, onChunk, opts) {
      const sid = this._getSessionId();
      const role = sid.startsWith('staff') ? 'staff' : sid.startsWith('customer') ? 'customer' : 'guest';
      AIMetrics.record('turn', Math.round((text || '').length));
      if (typeof this._onPhaseChange === 'function') { try { this._onPhaseChange('thinking'); } catch (e) {} }
      if (typeof AI_CTX !== 'undefined' && AI_CTX.pushTurn) { try { AI_CTX.pushTurn('user', text); } catch (e) {} }

      const cacheKey = role + '|' + (typeof AIInput !== 'undefined' && AIInput.normalize ? AIInput.normalize(text).norm : text.toLowerCase());
      const cached = this._loadDrafts()[sid] ? null : ResponseCache.get(cacheKey);
      if (cached) {
        AIMetrics.record('cache_hit', 1);
        this._pushHistory(sid, 'user', text);
        this._pushHistory(sid, 'assistant', cached.message || '');
        if (typeof onChunk === 'function') { onChunk(cached.message, cached.message); }
        return Object.assign({}, cached, { source: 'cache' });
      }

      this._pushHistory(sid, 'user', text);
      const inp = (typeof AIInput !== 'undefined' && AIInput.process) ? AIInput.process(text, role) : { norm: text.toLowerCase(), intent: '', valid: true, isMulti: false };
      if (inp && inp.valid === false) {
        return { type: 'text', message: 'Dạ câu hỏi hơi dài hoặc chứa ký tự lạ. Anh/chị gửi lại gọn hơn nhé ạ.', source: 'guard' };
      }
      if (typeof InjectionGuard !== 'undefined' && typeof InjectionGuard.checkInput === 'function') {
        const g = InjectionGuard.checkInput(text);
        if (g && g.blocked) {
          AIMetrics.record('guard_block', g.score);
          return { type: 'text', message: 'Dạ em không thể xử lý phần yêu cầu chứa chỉ thị phía hệ thống. Anh/chị đưa câu hỏi bình thường về món/nước/đặt bàn nhé ạ.', source: 'guard' };
        }
      }

      const p = this._getPending(sid);
      if (p && p.args && p.args._confirm) { /* handled at confirm level */ }

      let split = null;
      try {
        if (!this._loadDrafts()[sid] && typeof MultiIntentSplitter !== 'undefined' && MultiIntentSplitter.split) {
          split = await MultiIntentSplitter.split(text, role);
        }
      } catch (e) {}
      if (split && split.isMultiIntent) {
        const res = await this._handleMultiIntent(split.subInputs, role, sid, null);
        this._pushHistory(sid, 'assistant', res.message);
        return res;
      }

      try {
        if (IntentAuthorization.check) {
          const auth = IntentAuthorization.check(text, role);
          if (auth && auth.allowed === false) {
            AIMetrics.record('auth_block', auth.intent);
            return { type: 'text', message: 'Dạ anh/chị không có quyền truy cập nội dung này. Chức năng chỉ dành cho nhân viên được cấp quyền của quán ạ.', source: 'auth' };
          }
        }
      } catch (e) {}

      const dr = this._draftEngine(text, sid, role, inp);
      if (dr) {
        this._pushHistory(sid, 'assistant', dr.message || '');
        AIMetrics.record('draft', dr.intent || dr.kind || '');
        if (!dr.quickReplies && !(dr.message && dr.message.indexOf('[UI_') !== -1) && dr.intent === 'order' && dr.source === 'draft') dr.quickReplies = this._draftRepliesCart(dr.qty || 1, dr.name || '');
        return dr;
      }

      try {
        const f = FAST_PATH.match(inp);
        if (f && f.msg) {
          const r = { type: 'text', message: f.msg, source: 'kb', quickReplies: this._quickRepliesFor(text, 'kb') };
          ResponseCache.set(cacheKey, r);
          return r;
        }
      } catch (e) {}
      const kb = KBFast.answer(text);
      if (kb) {
        const r = { type: 'text', message: kb, source: 'kb', quickReplies: this._quickRepliesFor(text, 'kb') };
        ResponseCache.set(cacheKey, r);
        return r;
      }

      try {
        const l = LocalBrain.answer(text);
        if (l && l.confidence >= AI_LOCAL_MIN_CONF && l.text) {
          let cards = '';
          if (l.recommendationData
              && Array.isArray(l.recommendationData.items)
              && l.recommendationData.items.length) {
            cards = '[UI_MENU]' + JSON.stringify(l.recommendationData) + '[/UI_MENU]';
          } else if (l.intent === 'drink' && typeof this._localCards === 'function') {
            cards = this._localCards({ intent: l.intent }) || '';
          }
          this._pushHistory(sid, 'assistant', l.text);
          return {
            type: 'text',
            message: l.text,
            source: 'rule',
            cards: cards || undefined,
            quickReplies: this._quickRepliesFor(text, 'rule', l.intent)
          };
        }
      } catch (e) {}
      try {
        const g2 = AIBrainLegacy.tryReply(text);
        if (g2) {
          this._pushHistory(sid, 'assistant', g2);
          return { type: 'text', message: g2, source: 'rule', quickReplies: this._quickRepliesFor(text, 'rule', (inp && inp.intent)) };
        }
      } catch (e) {}

      if (typeof this._onPhaseChange === 'function') { try { this._onPhaseChange('stream2'); } catch (e) {} }
      const exclude = [];
      for (let attempt = 0; attempt < AI_CONFIG._slots.length + 1; attempt++) {
        const slot = AI_CONFIG.pick(exclude);
        if (!slot) break;
        exclude.push(slot.id);
        try {
          const out = await this._callLLM(slot, text, sid, role, onChunk);
          if (out) return out;
        } catch (e) {
          const msg = String(e && e.message || e);
          if (/429|quota|rate/i.test(msg)) AI_CONFIG.cool(slot, 60 * 1000, 'Rate limited');
          else AI_CONFIG.cool(slot, 5 * 1000, msg.slice(0, 120));
        }
      }
      const hot = kbGet('store.hotline', '0366 444 038');
      const fallbacks = [
        'Dạ hệ thống AI của em đang bận hoặc chưa cấu hình khoá truy cập. Anh/chị gọi hotline ' + hot + ' hoặc thử lại sau ít phút nhé ạ.',
        'Dạ xin lỗi anh/chị, em chưa kết nối được tới bộ não AI lúc này. Mọi hỗ trợ nhanh nhất qua hotline ' + hot + ' ạ.',
        'Dạ em tạm thời chưa trả lời được câu này. Anh/chị thử lại một lát, hoặc liên hệ hotline ' + hot + ' để nhân viên hỗ trợ ngay nhé ạ.'
      ];
      const pickIdx = Math.floor(Date.now() / 60000) % fallbacks.length;
      return { type: 'text', message: fallbacks[pickIdx], source: 'down', quickReplies: this._quickRepliesFor(text, 'down') };
    },

    _throttleChunk(onChunk) {
      if (typeof onChunk !== 'function') return null;
      let last = 0, timer = null, lastText = '';
      return (delta, full) => {
        lastText = full;
        const now = Date.now();
        if (now - last >= 30) { last = now; try { onChunk(delta, lastText); } catch (e) {} }
        else if (!timer) {
          timer = setTimeout(() => { timer = null; last = Date.now(); try { onChunk('', lastText); } catch (e) {} }, 32);
        }
      };
    },

    async _callLLM(slot, text, sid, role, onChunk) {
      if (typeof this._onPhaseChange === 'function') { try { this._onPhaseChange('tool'); } catch (e) {} }
      const sys = typeof AI_SYSTEM_PROMPT !== 'undefined' ? AI_SYSTEM_PROMPT : 'Bạn là trợ lý ảo của quán CAPPAN, trả lời tiếng Việt thân thiện trong 3-5 câu, không chế số liệu.';
      let sysFull = sys;
      try {
        if (role === 'customer' && typeof UserMemory !== 'undefined' && typeof UserMemory.buildPromptInjection === 'function') {
          if (typeof API !== 'undefined' && API.users.getCurrent()) {
            sysFull += ' ' + UserMemory.buildPromptInjection(API.users.getCurrent().id);
          }
        }
      } catch (e) {}
      try {
        if (typeof AI_CTX !== 'undefined' && AI_CTX.getRecent) {
          const recent = AI_CTX.getRecent(3).map(t => t.role + ': ' + String(t.text).slice(0, 120)).join('\n');
          if (recent) sysFull += '\n[NGỮ CẢNH GẦN NHẤT]\n' + recent;
        }
      } catch (e) {}
      const _cleanHist = (this._getHistory(sid) || []).map(m => {
        const content = String(m.content || '')
          .replace(/\[UI_(\w+)\][\s\S]*?\[\/UI_\1\]/g, '[thẻ $1]');
        return { role: m.role, content };
      });
      const base = [
        { role: 'system', content: sysFull },
        ..._cleanHist,
        { role: 'user', content: text }
      ];

      try { AIBrain._turnModel = slot.model.name; } catch (e) {}

      const _TOOL_PARAMS = {
        get_menu:                { categoryId: 'string?' },
        search_menu:             { keyword: 'string' },
        get_promotions:          {},
        check_seats:             {},
        get_order_status:        { orderId: 'string?' },
        cancel_my_order:         { orderId: 'string' },
        cancel_order:            { orderId: 'string?' },
        search_customer_history: { keyword: 'string' },
        get_recipe:              { drinkName: 'string' },
        get_revenue_stats:       { timeRange: 'string?' },
        get_shift_schedule:      { date: 'string?', shiftId: 'string?' },
        get_staff_list:          {},
        cancel_my_booking:       { bookingId: 'string' },
        update_booking:          { bookingId: 'string', newTime: 'string' },
        reset_all_seats:         {}
      };

      const _toolSchema = (name) => {
        const p = _TOOL_PARAMS[name] || {};
        const properties = {};
        const required = [];
        Object.keys(p).forEach(k => {
          properties[k] = { type: 'string' };
          if (!p[k].endsWith('?')) required.push(k);
        });
        const schema = { type: 'object', properties };
        if (required.length) schema.required = required;
        return schema;
      };

      const tools = AI_TOOLS
        .filter(t => t.roles.includes(role))
        .map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.desc + (t.danger ? ' [CÂN NHẮC XÁC NHẬN TRƯỚC]' : ''),
            parameters: _toolSchema(t.name)
          }
        }));
      let messages = base;
      onChunk = this._throttleChunk(onChunk) || onChunk;
      let first = true;
      for (let round = 0; round < 3; round++) {
        const body = {
          provider: slot.provider, keyIndex: slot.keyIndex, model: slot.model.name,
          messages, stream: true,
          max_tokens: slot.model.maxTokens || 1000,
          temperature: AI_CONFIG.temperature,
          tools: tools.length ? tools : undefined
        };
        const res = await fetch(AI_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(AI_ACCESS_TOKEN ? { 'X-Access-Token': AI_ACCESS_TOKEN } : {}) },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          const err = new Error(res.status + ' ' + t.slice(0, 140));
          if (res.status === 429) throw err;
          AI_CONFIG.cool(slot, 60 * 1000, 'Upstream ' + res.status);
          return null;
        }
        const acc = { content: '', toolCallsMap: {}, onChunk };
        const reader = res.body && res.body.getReader ? res.body.getReader() : null;
        if (reader) {
          const dec = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const ln of dec.decode(value, { stream: true }).split(/\r?\n/)) this._parseSSEEvent(ln, acc);
          }
        } else {
          const all = await res.text();
          all.split(/\r?\n/).forEach(ln => this._parseSSEEvent(ln, acc));
        }
        const calls = Object.values(acc.toolCallsMap).filter(c => c.function && c.function.name).map(c => ({
          id: c.id || genToolCallId(),
          type: 'function',
          function: { name: c.function.name, arguments: c.function.arguments || '{}' }
        }));
        if (!calls.length) {
          const msg = acc.content.trim();
          const claimMsg = this._guardLLMClaim(msg, role);
          this._pushHistory(sid, 'assistant', claimMsg.message);
          if (typeof AI_CTX !== 'undefined' && AI_CTX.pushTurn) { try { AI_CTX.pushTurn('assistant', claimMsg.message, { source: 'llm' }); } catch (e) {} }
          if (typeof AIOutput !== 'undefined' && AIOutput.build) {
            return AIOutput.build('text', { message: claimMsg.message, source: claimMsg.source });
          }
          return { type: 'text', message: claimMsg.message, source: claimMsg.source };
        }
        const p = this._getPending(sid);
        const needConfirm = calls.filter(c => {
          const meta = AI_TOOLS.find(t => t.name === c.function.name);
          return meta && meta.danger;
        });
        if (needConfirm.length) {
          const c = needConfirm[0];
          let args = {};
          try { args = JSON.parse(c.function.arguments || '{}'); } catch (e) { args = {}; }
          const info = { toolName: c.function.name, toolCallId: c.id || genToolCallId(), args, ts: Date.now() };
          this._setPending(sid, info);
          // ⚡ FIX: các tool danger còn lại trong batch không bị nuốt âm thầm — báo rõ vào câu hỏi xác nhận
          const extra = needConfirm.slice(1).map(x => AI_TOOLS.find(t => t.name === x.function.name) ? x.function.name : '').filter(Boolean);
          const extraTxt = extra.length ? ' (kèm ' + extra.length + ' thao tác khác cũng cần xác nhận: ' + extra.join(', ') + ')' : '';
          return { type: 'pending', toolName: info.toolName, toolCallId: info.toolCallId, args, message: 'Dạ em cần anh/chị xác nhận trước khi thực hiện "' + info.toolName + '"' + extraTxt + ' ạ.' };
        }
        messages = messages.concat([{ role: 'assistant', tool_calls: calls }]);
        for (const c of calls) {
          let args = {};
          try { args = JSON.parse(c.function.arguments || '{}'); } catch (e) { args = {}; }
          const out = await AIToolExecutor.run(c.function.name, args, role);
          try { (AIBrain._turnTools = AIBrain._turnTools || []).push(c.function.name); } catch (e) {}
          messages.push({ role: 'tool', tool_call_id: c.id, content: this._toolContent(out) });
        }
        continue;
      }
      AI_CONFIG.cool(slot, 30 * 1000, 'Vòng tool-call lặp nhiều lần');
      return null;
    },

    async confirmPending(toolName, toolCallId, args) {
      if (toolCallId === undefined && /^call_/.test(String(toolName))) {
        toolCallId = toolName;
        toolName = null;
      }
      const sid = this._getSessionId();
      const p = this._getPending(sid);
      if (!p || (toolCallId && p.toolCallId !== toolCallId)) {
        return { type: 'text', message: 'Dạ em không còn yêu cầu nào đang chờ xác nhận ạ.', source: 'system' };
      }
      // ⚡ FIX: pending có TTL 10 phút — yêu cầu confirm treo lâu không được chạy vô thời hạn
      if (p.ts && Date.now() - p.ts > 10 * 60 * 1000) {
        this._clearPending(sid);
        return { type: 'text', message: 'Dạ yêu cầu xác nhận trước đó đã **hết hạn** (quá 10 phút). Anh/chị vui lòng yêu cầu lại nhé ạ.', source: 'system' };
      }
      const role = sid.startsWith('staff') ? 'staff' : sid.startsWith('customer') ? 'customer' : 'guest';
      const out = await AIToolExecutor.run(p.toolName, Object.assign({}, p.args), role);
      this._clearPending(sid);
      AIMetrics.record('confirm', p.toolName);
      return { type: 'text', message: (out && !out.error) ? 'Dạ em đã thực hiện xong "' + p.toolName + '" ạ. Anh/chị cần em giúp gì khác không?' : 'Dạ thao tác chưa thực hiện được (' + (out && out.error ? out.error : 'lỗi') + ').', source: 'tool' };
    },
    cancelPending() {
      const sid = this._getSessionId();
      this._clearPending(sid);
      return { type: 'text', message: 'Dạ em đã hủy thao tác chờ theo yêu cầu ạ.', source: 'system' };
    }
  };

  /* ---- normVN ---- */
  function normVN(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---- Patch AIBrainLegacy: chặn lộ công thức ---- */
  (function patchLegacyGuards() {
    if (typeof AIBrainLegacy === 'undefined') return;
    const guard = (text, run) => {
      const role = (typeof API !== 'undefined' && API.users.getCurrent()) ? API.users.getCurrent().role : 'customer';
      if (role !== 'staff' && /\bcong thuc\b|\bcông thức\b/i.test(normVN(text))) {
        return 'Dạ quán không có thông tin về công thức để chia sẻ cho khách ạ. Anh/chị muốn em gợi ý món phù hợp thay thế không?';
      }
      if (/\btran chau\b/.test(normVN(text)) && typeof API !== 'undefined'
          && !API.menu.getAll().some(m => /tran chau/.test(normVN(m.name)))) {
        return 'Dạ quán hiện chưa có món "trà sữa trân châu" trong menu ạ. Anh/chị thử "Trà Đào Cam Sả" hoặc "Trà Sen Vàng" xem sao ạ!';
      }
      return run();
    };
    for (const method of ['tryReply', 'reply']) {
      if (typeof AIBrainLegacy[method] !== 'function') continue;
      const orig = AIBrainLegacy[method];
      AIBrainLegacy[method] = function (text) {
        try { return guard(text, () => orig.apply(this, arguments)); }
        catch (e) { return orig.apply(this, arguments); }
      };
    }
  })();

  /* ---- Patch LocalBrain: cross-session lock ---- */
  (function patchLocalBrainCrossSession() {
    if (typeof LocalBrain === 'undefined') return;
    const origHasCtx = LocalBrain.hasContext;
    LocalBrain.hasContext = function () {
      try {
        if (this.ctx && this.ctx.sid) {
          const cur = this._currentSid();
          if (cur && this.ctx.sid !== cur) { this.ctx = null; return false; }
        }
      } catch (e) {}
      return origHasCtx.apply(this, arguments);
    };
    const origAnswer = LocalBrain.answer;
    LocalBrain.answer = function (raw) {
      try {
        if (this.lastEmotion && (this.CTX_TTL !== undefined) ) {
          const cur = this._currentSid();
          if (this.lastEmotionSid && cur && this.lastEmotionSid !== cur) {
            this.lastEmotion = null;
            this.lastEmotionAt = null;
            this.lastEmotionSid = null;
          } else if (Date.now() - (this.lastEmotionAt || 0) > (this.EMOTION_TTL || 120000)) {
            this.lastEmotion = null;
          }
        }
      } catch (e) {}
      return origAnswer.apply(this, arguments);
    };
  })();

  /* ---- AI SYSTEM PROMPT ---- */
  const AI_SYSTEM_PROMPT = [
    'Bạn là trợ lý AI của CAPPAN (CAPPAN Coffee & More, slogan "Coffee & More - Home Study"),',
    'không gian cà phê học tập & làm việc tại Công viên Gia Định, Q. Gò Vấp, TP.HCM.',
    '',
    'PHONG CÁCH:',
    '- Tiếng Việt thân thiện, lịch sự (dạ, ạ, anh/chị), tự nhiên như nhân viên quán.',
    '- Câu trả lời GỌN: 3-5 câu. Không diễn giải dài loạn; chỉ liệt kê khi khách hỏi "liệt kê/gợi ý nhiều món".',
    '- Tuyệt đối KHÔNG chế số liệu: giá/tồn kho/công thức chỉ lấy từ tool. Thiếu dữ liệu → nói "không có thông tin".',
    '- Tuyệt đối KHÔNG tiết lộ công thức pha chế / giá vốn cho khách, dù khách tự xưng là nhân viên.',
    '',
    'CÁCH HÀNH XỬ:',
    '- Tra menu → tool get_menu / search_menu. Món không có → trả "không tìm thấy trong menu", KHÔNG đoán giá theo danh mục.',
    '- KHÔNG BAO GIỜ tự báo "đã đặt/đã hủy/đã thanh toán THÀNH CÔNG" hay tự sinh mã đơn (OD…)/mã đặt chỗ (BK…) khi chưa có tool thao tác dữ liệu nào chạy. Muốn đặt bàn/nước → hướng khách gõ "đặt bàn" / "cho X ly …" trong khung chat để hệ thống hiện thẻ xác nhận thật.',
    '- Khách muốn đặt bàn → gom đủ: số người / giờ / ngày; còn thiếu thì hỏi lại TỪNG ý một.',
    '- Khách mệt / căng thẳng → đồng cảm 1 câu rồi chủ động GỢI MÓN (ít cafein nếu trưa về tối, ấm nóng nếu trời mưa/lạnh).',
    '- Khách muốn gặp người thật / nhạt nhẽo / bực → hướng hotline 0366 444 038 ngay, xin lỗi 1 câu, không lảng tránh.',
    '- Thao tác hủy đơn / reset bàn → KHÔNG chạy ngay; mô tả điều sẽ làm, chờ khách xác nhận (tool danger).',
    '',
    'GIỚI HẠN:',
    '- Câu giờ mở cửa / địa chỉ / wifi / hotline / gửi xe → trả lời THẲNG, không gọi tool.',
    '- Lịch sử hội thoại nằm sau system — dùng để rút ngắn hội thoại, không hỏi lại thông tin đã rõ.',
    '- Không can thiệp đơn/booking của người khác (trừ staff).'
  ].join('\n');