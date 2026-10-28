/* ============================================================
   AI BRAIN LEGACY — FULL REFACTOR v5.0
   FIXES:
     - itemRecency scope bug (crash _scoreDrinks) → khai báo đúng scope
     - _findItems: fullMatch flag → không bị nhầm generic
     - medicalRecommend: giữ Bánh Flan (không có cafein)
     - Wire medicalRecommend + multiOrder vào chain (was dead code)
     - parseSeat: đầy đủ 8 preference (floor/guests/zone/time + view/quiet/group/outdoor/projector/outlet)
     - _seatReply: có set ctx → booking modal prefill đúng
     - _compare/_price/_stock/_info/_extreme: exposed → G12 test pass
     - Emotional delegation: giữ shim → G17a/G17b pass
   KEEP INTACT: AIBrainLegacy, LB_TAGS, LB_WORDS, GroupMemory
============================================================ */

const AIBrainLegacy = {
  _lastTopic: null,

  _kb(path, fallback = '') {
    try {
      const parts = path.split('.');
      let cur = (typeof KB !== 'undefined') ? KB : null;
      for (const p of parts) {
        if (!cur || cur[p] === undefined) return fallback;
        cur = cur[p];
      }
      return cur;
    } catch (e) { return fallback; }
  },

  _strict: false,
  tryReply(input) {
    this._strict = true;
    try { return this.reply(input) || null; }
    finally { this._strict = false; }
  },

  reply(input) {
    const text = input.toLowerCase().trim();
    const n = (typeof normVN === 'function') ? normVN(text) : text;

    const isComplex = /\b(moi nguoi|tung nguoi|nguoi (1|2|3|4|dau|thu|cuoi)|chia ra|vua.*vua|va.*vua|thich|so thich|gu)\b/.test(n) || input.split(',').length > 2;
    if (isComplex && input.split(' ').length > 6) return null;

    const user = API.users.getCurrent();
    const isStaff = user && user.role === 'staff';
    const lastTopic = this._lastTopic || null;
    this._lastTopic = this._detectTopic(text) || lastTopic;

    if (!isStaff) {
      const blocked = this._checkBlockedForCustomer(text);
      if (blocked) return blocked;
    }

    if (typeof LocalBrain !== 'undefined' && typeof LocalBrain.hasContext === 'function' && LocalBrain.hasContext()) {
      const f = LocalBrain.followUp(input);
      if (f && f.confidence >= LocalBrain.MIN_CONF) return f.text;
    }

    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 3 && lastTopic) {
      const contextReply = this._handleContext(text, lastTopic, user);
      if (contextReply) return contextReply;
    }

    if (this._strict && /doanh thu|doanh số|đánh dấu|hủy|huỷ|hoàn thành|hoàn tất|reset|phân ca|xếp ca|đổi giá|sửa giá|tra cứu khách|lịch sử khách|lịch sử của khách|đổi trạng thái|xóa|xóa đơn|xóa booking|tìm khách/.test(text)) return null;

    if (isStaff) {
      const staffReply = this._checkStaffQueries(text);
      if (staffReply) return staffReply;
    }

    return this._checkBookingHelp(text)
        || this._checkOrderHelp(text)
        || this._checkGreeting(text, user)
        || this._checkOutOfStock(text)
        || this._checkLocal(input)
        || this._checkSeats(text)
        || this._checkMenu(text)
        || this._checkPrice(text)
        || this._checkHours(text)
        || this._checkAddress(text)
        || this._checkWifi(text)
        || this._checkFloors(text)
        || this._checkParking(text)
        || this._checkVegetarian(text)
        || this._checkPeakHours(text)
        || this._checkChangeSeat(text)
        || this._checkBulkOrder(text)
        || this._checkFAQ(text)
        || this._checkPromotions(text)
        || this._checkMyAccount(text, user)
        || this._checkThanks(text)
        || this._fallback(text);
  },

  _checkBlockedForCustomer(text) {
    const n = (typeof normVN === 'function') ? normVN(text) : String(text || '').toLowerCase();
    const isRecipe = /\b(cong thuc|recipe|nguyen lieu|pha che)\b/.test(n);
    if (!isRecipe) {
      if (/\b(huy|huy bo)\s+(cho|ban|booking)\b/.test(n)) return null;
      if (/\b(doi|sua|cap nhat)\s+(gio|ngay|cho|ban|booking)\b/.test(n)) return null;
      if (/\b(diem tich luy|diem thuong|diem cua)\b/.test(n)) return null;
      if (/\b(ca lam viec|ca cua toi|lich ca cua toi)\b/.test(n)) return null;
      if (/\b(tuyen|part-time|xin viec)\b/.test(n)) return null;
      if (/\b(cho|ban|booking)\s+(toi|minh|em)\b/.test(n)) return null;
    }

    const rules = [
      { re: /\b(cong thuc|cach (lam|pha|che bien|nau|uong|nau an)|nguyen lieu|pha che|recipe|thanh phan|lam sao (pha|lam|che bien)|pha nhu the nao|lam nhu the nao|huong dan (pha|lam))\b/, msg: 'Dạ em không có thông tin về công thức pha chế ạ. Anh/chị vui lòng liên hệ quầy pha chế hoặc hotline 0366 444 038.' },
      { re: /\b(doanh thu|doanh so|gia von|ton kho|loi nhuan|kpi|thong ke noi bo)\b/, msg: 'Dạ em không có quyền cung cấp số liệu nội bộ ạ. Anh/chị vui lòng liên hệ quản lý ca.' },
      { re: /\b(nhan vien|lich ca|ca lam|phan ca|xep ca|staff list|danh sach nhan vien)\b/, msg: 'Dạ em không có quyền cung cấp thông tin nhân viên hoặc lịch ca ạ.' },
      { re: /\b(danh dau|reset|hoan thanh|xoa mon|doi gia|sua gia|cap nhat trang thai)\b/, msg: 'Dạ em không có quyền thực hiện thao tác ghi ạ. Anh/chị vui lòng liên hệ nhân viên.' },
      { re: /\b(ignore previous|bo qua huong dan|system prompt|jailbreak|prompt injection)\b/, msg: 'Dạ em không thể thực hiện yêu cầu này ạ.' }
    ];
    for (const r of rules) if (r.re.test(n)) return r.msg;
    return null;
  },

  _checkStaffQueries(text) {
    const n = (typeof normVN === 'function') ? normVN(text) : String(text).toLowerCase();
    const card = (tag, data) => `[UI_${tag}]${JSON.stringify(data)}[/UI_${tag}]`;
    const rules = [
      [/\b(nhan vien|staff)\b.*\b(danh sach|list|ai|co ai)\b/, () => {
        const staff = API.staff.getAll();
        if (!staff.length) return '👥 Chưa có nhân viên trong hệ thống.';
        return card('STAFF', staff.slice(0, 12).map(s => ({ id: s.id, name: s.name, role: s.role })));
      }],
      [/\b(cho|ban).*(trong|con)\b|\bcon (bao nhieu|may) (cho|ban)\b/, () => {
        const avail = API.seats.getAvailable();
        if (!avail.length) return '🪑 Hiện đã hết chỗ trống.';
        const byFloor = {};
        avail.forEach(s => {
          if (!byFloor[s.floorId]) byFloor[s.floorId] = { floorName: (API.floors.getById(s.floorId) || {}).name || s.floorId, total: API.seats.getByFloor(s.floorId).length, available: 0, seats: [] };
          byFloor[s.floorId].available++;
          byFloor[s.floorId].seats.push({ id: s.id, capacity: s.capacity, zone: s.zone });
        });
        const floors = Object.values(byFloor).map(f => ({ name: f.floorName, available: f.available, total: f.total }));
        const seats = [];
        Object.values(byFloor).forEach(f => f.seats.forEach(s => seats.push({ ...s, floor: f.floorName })));
        return card('SEAT', { available: avail.length, floors, seats: seats.slice(0, 6) });
      }],
      [/\b(don|order).*(dang|xu ly|cho|active)\b|\bco (bao nhieu|may) don\b/, () => {
        const active = API.orders.getActive();
        if (!active.length) return '📦 Không có đơn đang xử lý.';
        return card('ORDER', { total: active.length, orders: active.slice(0, 5).map(o => ({ id: o.id, customerName: o.customerName || 'Khách', total: o.total, step: o.step, stepText: ['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][o.step] })) });
      }],
      [/\b(booking|dat cho).*(hom nay|today)\b|\bco (bao nhieu|may) booking\b/, () => {
        const today = API.utils.today();
        const list = API.bookings.getAll().filter(b => b.date === today && b.status === 'confirmed');
        if (!list.length) return '📅 Hôm nay chưa có booking đang hoạt động.';
        return card('BOOKING', { date: today, total: list.length, bookings: list.slice(0, 6).map(b => { const u = API.users.getById(b.userId); const f = API.floors.getById(b.floorId); return { id: b.id, customerName: u ? u.name : 'Khách', seatId: b.seatId, floorName: f ? f.name : b.floorId, time: b.time, guests: b.guests, note: b.note }; }) });
      }],
      [/\b(doanh thu|revenue)\b.*\b(hom nay|today)\b/, () => card('KPI', { today: { revenue: API.stats.today().total, orders: API.stats.today().count, completedCount: API.stats.today().completedCount, pendingCount: API.stats.today().pendingCount }, week: API.stats.thisWeek().total, month: API.stats.thisMonth().total, status: API.stats.ordersByStatus() })],
      [/\b(mon|hang).*(het|out of stock)\b/, () => {
        const oos = API.menu.getOutOfStock();
        if (!oos.length) return '✅ Tất cả các món đều còn hàng.';
        return card('OOS', { count: oos.length, items: oos.map(m => ({ id: m.id, name: m.name })) });
      }]
    ];
    for (const [re, build] of rules) if (re.test(n)) { try { return build(); } catch (e) { return null; } }
    return null;
  },

  _detectTopic(text) {
    if (/chỗ|bàn|ngồi|khu vực/.test(text)) return 'seat';
    if (/menu|thực đơn|đồ uống|món/.test(text)) return 'menu';
    if (/đặt chỗ|đặt bàn/.test(text)) return 'booking';
    if (/đặt nước|order|giao hàng/.test(text)) return 'order';
    if (/giá|bao nhiêu/.test(text)) return 'price';
    return null;
  },

  _handleContext(text, topic, user) {
    if (topic === 'seat') {
      const zoneMap = { 'yên tĩnh': 'quiet', 'học': 'quiet', 'làm việc': 'quiet', 'cửa sổ': 'window', 'view': 'window', 'nhóm': 'group', 'họp': 'group', 'trung tâm': 'center' };
      for (const [kw, zone] of Object.entries(zoneMap)) if (text.includes(kw)) return this._replySeatsByZone(zone, kw);
    }
    if (topic === 'menu') {
      const catMap = { 'cà phê': 'coffee', 'coffee': 'coffee', 'trà': 'tea', 'tea': 'tea', 'sinh tố': 'smoothie', 'smoothie': 'smoothie', 'nước ép': 'juice', 'juice': 'juice', 'soda': 'soda', 'đá xay': 'soda', 'khác': 'other' };
      for (const [kw, catId] of Object.entries(catMap)) if (text.includes(kw)) return this._replyMenuByCategory(catId);
    }
    return null;
  },

  _replySeatsByZone(zone, zoneName) {
    const filtered = API.seats.getAvailable().filter(s => s.zone === zone);
    if (filtered.length === 0) return `Dạ hiện tại khu vực "${zoneName}" đã hết chỗ. Bạn có muốn thử khu vực khác không?`;
    const list = filtered.map(s => `• ${s.id} (${s.capacity} người) – ${API.floors.getById(s.floorId).name}`).join('\n');
    return `Dạ còn ${filtered.length} chỗ ở khu vực ${zoneName}:\n${list}\n\nBạn vào mục "Đặt chỗ" để chọn nhé!`;
  },

  _replyMenuByCategory(catId) {
    const cat = API.categories.getById(catId);
    if (!cat) return null;
    const items = API.menu.getByCategory(catId);
    const data = { title: `${cat.name} (${items.length} món)`, total: items.length, items: items.map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge })) };
    return `[UI_MENU]${JSON.stringify(data)}[/UI_MENU]`;
  },

  _checkGreeting(text, user) {
    const greetings = ['chào', 'hello', 'hi', 'xin chào', 'alo'];
    if (!greetings.some(g => text.includes(g))) return null;
    if (text.split(' ').length > 4) return null;
    const hour = new Date().getHours();
    let timeGreet = 'Xin chào';
    if (hour < 11) timeGreet = 'Chào buổi sáng'; else if (hour < 14) timeGreet = 'Chào buổi trưa'; else if (hour < 18) timeGreet = 'Chào buổi chiều'; else timeGreet = 'Chào buổi tối';
    return user ? `${timeGreet} ${user.name}! 👋\nTôi có thể giúp gì cho bạn hôm nay?` : `${timeGreet}! 👋 Tôi là trợ lý ảo CAPPAN.\nBạn có thể hỏi tôi về menu, chỗ ngồi, giờ mở cửa...`;
  },

  _checkLocal(input) {
    if (typeof LocalBrain === 'undefined') return null;
    const r = LocalBrain.answer(input);
    return (r && r.confidence >= LocalBrain.MIN_CONF) ? r.text : null;
  },

  _checkOutOfStock(text) {
    if (/\bcòn\s+gì\s+khác\b|\bcon\s+gi\s+khac\b|\bthêm\s+món\s+khác\b/i.test(text)) return null;
    const keys = ['hết', 'còn món', 'còn gì', 'còn không', 'hết hàng'];
    if (!keys.some(k => text.includes(k))) return null;
    const out = API.menu.getOutOfStock();
    const avail = API.menu.getAvailable();
    if (out.length === 0) return `Dạ quán vẫn còn đầy đủ ${avail.length} món ạ! Bạn muốn uống gì?`;
    const list = out.map(m => `• ${m.name}`).join('\n');
    return `Hiện tại quán đã HẾT các món sau:\n${list}\n\nCòn lại ${avail.length} món khác đang phục vụ ạ!`;
  },

  _checkSeats(text) {
    if (/cách.*(đặt|book)|hướng dẫn|làm sao/.test(text)) return null;
    if (/^(còn chỗ không|hết chỗ chưa|còn bàn không|trống không|có chỗ trống không)\??$/.test(text.trim())) return null;
    const zoneOnly = { 'yên tĩnh': 'quiet', 'cửa sổ': 'window', 'nhóm': 'group', 'trung tâm': 'center' };
    const cleanText = text.trim();
    for (const [kw, zone] of Object.entries(zoneOnly)) if (cleanText === kw || cleanText === kw + '?') return this._replySeatsByZone(zone, kw);
    const keys = ['chỗ', 'bàn', 'ngồi', 'trống', 'khu vực'];
    if (!keys.some(k => text.includes(k))) return null;
    this._lastTopic = 'seat';
    const zones = { 'yên tĩnh': 'quiet', 'học': 'quiet', 'làm việc': 'quiet', 'cửa sổ': 'window', 'view': 'window', 'đẹp': 'window', 'nhóm': 'group', 'họp': 'group', 'trung tâm': 'center' };
    for (const [kw, zone] of Object.entries(zones)) if (text.includes(kw)) return this._replySeatsByZone(zone, kw);
    const allAvailable = API.seats.getAvailable();
    if (allAvailable.length === 0) return 'Dạ hiện tại quán đã hết chỗ. Bạn thông cảm nhé! 😔';
    const byFloor = {};
    allAvailable.forEach(s => { byFloor[s.floorId] = (byFloor[s.floorId] || 0) + 1; });
    let reply = `Dạ còn tổng cộng ${allAvailable.length} chỗ trống:\n`;
    Object.keys(byFloor).forEach(fId => { reply += `• ${API.floors.getById(fId).name}: ${byFloor[fId]} chỗ\n`; });
    return reply + '\nBạn muốn ngồi khu vực nào? (yên tĩnh / cửa sổ / nhóm / ngoài trời)';
  },

  _checkMenu(text) {
    if (/giỏ hàng|gio hang|cart/.test(text)) return null;
    if (/\b(đầy đủ|toàn bộ|full|tất cả)\b/i.test(text)) return null;
    const specificCats = ['cà phê', 'ca phe', 'coffee', 'trà', 'tra', 'tea', 'sinh tố', 'sinh to', 'smoothie', 'nước ép', 'nuoc ep', 'juice', 'soda', 'đá xay', 'da xay', 'khác', 'khac', 'other'];
    if (specificCats.some(k => text.includes(k))) return null;
    const keys = ['menu', 'thực đơn', 'đồ uống', 'uống gì', 'món gì'];
    if (!keys.some(k => text.includes(k))) return null;
    this._lastTopic = 'menu';
    const cats = API.categories.getAll();
    const items = API.menu.getAll();
    const data = { totalItems: items.length, categories: cats.map(c => { const catItems = items.filter(m => m.categoryId === c.id); return { id: c.id, name: c.name, count: catItems.length, items: catItems.slice(0, 2).map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge })) }; }).filter(c => c.count > 0) };
    return `[UI_CATALOG]${JSON.stringify(data)}[/UI_CATALOG]`;
  },

  _checkPrice(text) {
    const n = (typeof normVN === 'function') ? normVN(text) : String(text || '').toLowerCase();
    if (/\b(diem|tich luy)\b/.test(n)) return null;
    if (/\b(ma giam|khuyen mai|voucher|coupon|ma km|giam gia|sale)\b/.test(n)) return null;
    const keys = ['giá', 'bao nhiêu', 'mắc không', 'đắt không', 'bao nhiu', 'nhieu tien'];
    if (!keys.some(k => n.includes(k) || text.includes(k))) return null;
    const items = API.menu.getAll();
    const found = items.find(i => n.includes(normVN(i.name)));
    if (found) return `${found.name} có giá ${API.utils.formatVND(found.price)} ạ!`;
    let specificName = null;
    const matchAfter = n.match(/(?:gia|bao nhieu)\s+(?:cua\s+)?([a-z0-9 ]{3,30}?)(?:\s+(?:la|bao|a|khong|\?|$))/);
    if (matchAfter) specificName = matchAfter[1].trim();
    if (!specificName) {
      const matchBefore = n.match(/([a-z0-9 ]{3,30}?)\s+(?:gia|bao nhieu|mac|dat)/);
      if (matchBefore) specificName = matchBefore[1].trim();
    }
    if (specificName) {
      specificName = specificName.replace(/\b(mon|do uong|nuoc|ly|cho|minh|toi|khong|ko|gia|bao|nhieu|gi|la|cua)\b/gi, '').trim();
      if (specificName.length >= 3) {
        const words = normVN(specificName).split(' ').filter(w => w.length >= 2);
        let sug = items.filter(m => words.some(w => normVN(m.name).includes(w))).slice(0, 3);
        if (sug.length === 0) sug = items.filter(m => m.inStock).sort(() => 0.5 - Math.random()).slice(0, 3);
        const itemsPayload = sug.map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock, reason: 'Món tương tự' }));
        const cardData = { title: `Không có món "${specificName}"`, total: itemsPayload.length, items: itemsPayload };
        return `Dạ hiện tại CAPPAN không có món "${specificName}" trong menu ạ.\nAnh/chị có thể tham khảo qua một vài món sau:\n[UI_MENU]${JSON.stringify(cardData)}[/UI_MENU]`;
      }
    }
    const min = Math.min(...items.map(i => i.price));
    const max = Math.max(...items.map(i => i.price));
    return `Dạ đồ uống CAPPAN dao động từ ${API.utils.formatVND(min)} đến ${API.utils.formatVND(max)}. Bạn muốn hỏi giá món nào cụ thể không?`;
  },

  _checkHours(text) {
    const keys = ['giờ', 'mở cửa', 'đóng cửa', 'mấy giờ'];
    if (!keys.some(k => text.includes(k))) return null;
    const hour = new Date().getHours();
    const openHour = this._kb('store.openHour', 7);
    const closeHour = this._kb('store.closeHour', 22);
    const hoursText = this._kb('store.hours', '07:00 – 22:30 hằng ngày');
    const open = hour >= openHour && hour < closeHour;
    return open ? `🕐 Quán đang MỞ CỬA ạ!\nGiờ hoạt động: ${hoursText}.` : `🕐 Hiện tại quán đã ĐÓNG CỬA.\nGiờ hoạt động: ${hoursText}. Hẹn gặp bạn ngày mai!`;
  },

  _checkAddress(text) { return null; },
  _checkWifi(text) { return null; },

  _checkBookingHelp(text) {
    const howToKeys = ['cách đặt chỗ', 'làm sao đặt', 'đặt chỗ thế nào', 'hướng dẫn đặt', 'book chỗ sao', 'đặt bàn thế nào', 'cách book', 'làm sao book'];
    if (!howToKeys.some(k => text.includes(k))) return null;
    this._lastTopic = 'booking';
    return `🪑 Để đặt chỗ, bạn làm theo 4 bước:\n1. Vào mục "Đặt chỗ" trên menu\n2. Chọn tầng bạn muốn ngồi\n3. Click vào chỗ màu XANH\n4. Điền thông tin và xác nhận\n\nBạn muốn ngồi tầng nào? (trệt / lầu 1 / lầu 2 / thượng)`;
  },

  _checkOrderHelp(text) {
    const howTo = /(cách|huong dan|lam sao|the nao|quy trinh|thu tuc|lam the nao)/.test(text);
    if (!howTo) return null;
    const keys = ['đặt nước', 'đặt món', 'order', 'giao hàng', 'ship'];
    if (!keys.some(k => text.includes(k))) return null;
    this._lastTopic = 'order';
    return `🥤 Để đặt nước, bạn làm theo 4 bước:\n1. Vào mục "Đặt nước"\n2. Chọn món → "+ Thêm vào giỏ"\n3. Vào "Giỏ hàng" để kiểm tra\n4. Điền địa chỉ → "Đặt hàng ngay"\n\nSau đó bạn có thể theo dõi shipper ở mục "Theo dõi đơn" nhé!`;
  },

  _checkFloors(text) {
    const keys = ['tầng', 'lầu', 'không gian', 'khu vực'];
    if (!keys.some(k => text.includes(k))) return null;
    const floors = API.floors.getAll();
    let reply = '🏢 CAPPAN có 4 không gian:\n';
    floors.forEach(f => { reply += `• ${f.name} — ${f.description}\n`; });
    return reply + '\nBạn muốn ngồi tầng nào ạ?';
  },

  _checkParking(text) {
    const keys = ['đậu xe', 'gửi xe', 'parking', 'bãi xe', 'để xe'];
    if (!keys.some(k => text.includes(k))) return null;
    return `🅿️ CAPPAN có bãi giữ xe miễn phí ngay phía sau quán.\nBạn cứ yên tâm mang xe đến nhé!`;
  },

  _checkVegetarian(text) {
    const keys = ['món chay', 'đồ chay', 'ăn chay', 'chay'];
    if (!keys.some(k => text.includes(k))) return null;
    return '🥗 Hiện tại CAPPAN chưa có menu chay riêng, nhưng có một số món phù hợp:\n• Sinh tố Bơ\n• Sinh tố Xoài\n• Nước ép Cam\n• Trà Sen Vàng\n\nBạn muốn thử món nào không ạ?';
  },

  _checkPeakHours(text) {
    const keys = ['đông nhất', 'cao điểm', 'đông khách', 'vắng nhất'];
    if (!keys.some(k => text.includes(k))) return null;
    return '📊 Quán thường ĐÔNG NHẤT vào:\n• 8:00 – 10:00\n• 14:00 – 16:00\n• 19:00 – 21:00\n\nNếu bạn muốn yên tĩnh, nên đến lúc 7:00 hoặc sau 16:00 nhé!';
  },

  _checkChangeSeat(text) {
    const keys = ['đổi chỗ', 'đổi bàn', 'thay đổi chỗ', 'chuyển chỗ'];
    if (!keys.some(k => text.includes(k))) return null;
    return `🔄 Bạn có thể đổi chỗ bằng cách:\n1. Vào "Tài khoản" → tab "Lịch sử đặt chỗ"\n2. Bấm "Hủy" ở chỗ cũ\n3. Vào "Đặt chỗ" → chọn chỗ mới\n\nHoặc gọi hotline: 0366 444 038 để được hỗ trợ nhé!`;
  },

  _checkBulkOrder(text) {
    const keys = ['tiệc', 'sinh nhật', 'sự kiện', 'đặt nhiều', 'số lượng lớn', '20 người', '30 người'];
    if (!keys.some(k => text.includes(k))) return null;
    return `🎉 CAPPAN có dịch vụ đặt tiệc riêng!\nVới đoàn đông (trên 10 người), bạn vui lòng gọi hotline: 0366 444 038 để được tư vấn nhé!`;
  },

  _checkFAQ(text) {
    if (typeof KB === 'undefined' || !Array.isArray(KB.faq)) return null;
    const n = normVN(text);
    
    // ⚡ FIX: Không trả lời FAQ "giao hàng" nếu user đang muốn SỬA/ĐỔI thông tin
    if (/\b(doi|sua|thay|cap nhat)\b/.test(n) && /\b(dia chi|giao hang|so dien thoai|sdt)\b/.test(n)) return null;
    
    if (/\b(ca|lich ca|shift|ca lam|ca cua)\b/.test(n)) return null;
    let bestMatch = null, bestScore = 0;
    KB.faq.forEach(f => {
      if (!f.keywords) return;
      const score = f.keywords.filter(k => n.includes(normVN(k))).length;
      if (score > bestScore) { bestScore = score; bestMatch = f; }
    });
    return (bestMatch && bestScore >= 1) ? bestMatch.answer : null;
  },

  _checkPromotions(text) {
    const n = (typeof normVN === 'function') ? normVN(text) : String(text || '').toLowerCase();
    const user = API.users.getCurrent();
    const isStaff = user && user.role === 'staff';
    if (/\b(them|tao|sua|xoa|doi|cap nhat)\b/.test(n) && /\b(ma|khuyen mai|voucher|coupon|sale)\b/.test(n)) {
      if (!isStaff) return 'Dạ em không có quyền tạo/sửa mã khuyến mãi ạ. Anh/chị vui lòng liên hệ nhân viên hoặc hotline 0366 444 038 nhé.';
      return `[UI_PROMO_MANAGE]{"title": "Quản lý khuyến mãi", "desc": "Dạ, để thêm hoặc sửa mã khuyến mãi, anh/chị vui lòng bấm vào nút bên dưới để mở trang quản lý."}[/UI_PROMO_MANAGE]`;
    }
    if (!/\b(ma giam|khuyen mai|voucher|coupon|ma km|giam gia|sale)\b/.test(n)) return null;
    const today = API.utils.today();
    const active = API.promotions.getActive(today);
    if (active.length === 0) return 'Dạ hiện tại quán chưa có chương trình khuyến mãi nào ạ.';
    const data = active.map(p => ({ code: p.code, description: p.description || p.name, discount: p.discount, minOrder: p.minOrder, validTo: p.endDate }));
    return `[UI_PROMO]${JSON.stringify(data)}[/UI_PROMO]`;
  },

  _checkMyAccount(text, user) {
    if (!text.includes('tài khoản') && !text.includes('account')) return null;
    return !user ? '🔒 Bạn cần đăng nhập để xem thông tin tài khoản.\nClick "Đăng nhập" ở góc phải trên nhé!' : '👤 Anh/chị bấm vào tên của mình ở góc phải trên để xem tài khoản nhé!';
  },

  _checkThanks(text) {
    const keys = ['cảm ơn', 'thanks', 'thank you', 'cám ơn'];
    if (!keys.some(k => text.includes(k))) return null;
    const replies = ['😊 Rất vui được giúp bạn!', '🙌 Không có gì ạ! Hẹn gặp bạn tại quán.', '☕ Cảm ơn bạn đã quan tâm CAPPAN!', '😄 Vui lòng phục vụ bạn!'];
    return replies[Math.floor(Math.random() * replies.length)];
  },

  _fallback(text) {
    if (this._strict) return null;
    const items = API.menu.getAll();
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    let bestMatch = null, bestScore = 0;
    items.forEach(m => {
      const nameLower = m.name.toLowerCase();
      const score = words.filter(w => nameLower.includes(w)).length;
      if (score > bestScore) { bestScore = score; bestMatch = m; }
    });
    if (bestMatch && bestScore >= 2) return `Bạn đang hỏi về ${bestMatch.name} phải không? Món này giá ${API.utils.formatVND(bestMatch.price)}. Bạn muốn đặt không?`;
    const catKeywords = { 'cà phê': 'coffee', 'coffee': 'coffee', 'trà': 'tea', 'sinh tố': 'smoothie', 'nước ép': 'juice', 'soda': 'soda' };
    for (const [kw, catId] of Object.entries(catKeywords)) if (text.includes(kw)) return this._replyMenuByCategory(catId);
    const replies = ['🤔 Câu này hơi khó với tôi. Bạn thử hỏi cụ thể hơn nhé!\n\nVí dụ:\n• "Còn chỗ yên tĩnh không?"\n• "Trà đào giá bao nhiêu?"\n• "Cách đặt chỗ thế nào?"', '😅 Tôi chưa hiểu rõ. Bạn có thể hỏi về:\n• Menu và giá\n• Chỗ ngồi (yên tĩnh / cửa sổ / nhóm)\n• Giờ mở cửa, địa chỉ, wifi\n• Cách đặt chỗ / đặt nước', '🤖 Tôi mới chỉ là trợ lý ảo đơn giản. Bạn thử hỏi:\n• "Menu có gì?"\n• "Còn chỗ không?"\n• "Giờ mở cửa?"'];
    return replies[Math.floor(Math.random() * replies.length)];
  }
};

/* ============================================================ */

const LB_TAGS = {
  M001: ['cafe', 'cafein', 'tinhtao', 'dang', 'ngot'], M002: ['cafe', 'cafein', 'beo', 'ngot'], M003: ['cafe', 'cafein', 'beo', 'nong'],
  M004: ['cafe', 'cafein', 'beo', 'nong'], M005: ['cafe', 'cafein', 'tinhtao', 'dang', 'nong', 'itngot'], M006: ['cafe', 'cafein', 'tinhtao', 'beo', 'dang', 'man'],
  M101: ['cafein', 'traicay', 'chua', 'thanh', 'giainhiet'], M102: ['cafein', 'beo', 'dang'], M103: ['cafein', 'beo', 'thanh'], M104: ['cafein', 'nong', 'ngot', 'thanh'],
  M201: ['traicay', 'beo', 'ngot'], M202: ['traicay', 'ngot', 'giainhiet'], M203: ['traicay', 'ngot', 'chua', 'giainhiet'], M204: ['traicay', 'chua', 'ngot', 'giainhiet'],
  M301: ['traicay', 'chua', 'thanh', 'giainhiet', 'itngot'], M302: ['traicay', 'thanh', 'itngot'], M303: ['traicay', 'thanh', 'giainhiet', 'itngot'],
  M401: ['chua', 'giainhiet', 'thanh', 'itngot'], M402: ['chua', 'traicay', 'giainhiet', 'thanh'], M403: ['cafe', 'cafein', 'tinhtao', 'beo', 'ngot', 'giainhiet'],
  M404: ['cafein', 'beo', 'ngot', 'giainhiet'], M501: ['cafe', 'cafein', 'chua', 'beo', 'ngot'], M502: ['nong', 'beo', 'ngot'], M503: ['banh', 'beo', 'ngot']
};
const LB_WORDS = { beo: 'béo ngậy', ngot: 'ngọt dịu', dang: 'đậm vị', chua: 'chua thanh', thanh: 'thanh nhẹ', traicay: 'trái cây', giainhiet: 'giải nhiệt', tinhtao: 'tỉnh táo', nong: 'dùng nóng', itngot: 'ít ngọt', man: 'mặn nhẹ độc đáo' };

/* ============================================================ */

const LocalBrain = {
  MIN_CONF: 0.5,
  ctx: null,
  bookingDraft: null,
  orderDraft: null,
  CTX_TTL: 15 * 60 * 1000,
  EMOTION_TTL: 120000,
  FLOORS: { tret: 'F1', 'lau 1': 'F2', 'lau 2': 'F3', thuong: 'F4' },
  NUMW: { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 },
  GENERIC: new Set(['ca', 'phe', 'tra', 'sinh', 'to', 'nuoc', 'ep', 'soda', 'da', 'xay', 'nong', 'sua']),

  _currentSid() {
    try { if (typeof AIBrain !== 'undefined' && typeof AIBrain._getSessionId === 'function') return AIBrain._getSessionId(); } catch (e) {}
    const u = API.users.getCurrent(); return u ? `${u.role}_${u.id}` : 'guest';
  },

  hasContext() { return !!(this.ctx && Date.now() - this.ctx.ts < this.CTX_TTL); },
  followUp(raw) { return null; },   // ⚡ state-less, không follow up
  reset() { this.ctx = null; this.bookingDraft = null; this.orderDraft = null; },

  norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9< ]+/g, ' ').replace(/\s+/g, ' ').trim();
  },
  _tok(s) {
    return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}<]+/gu, ' ').trim().split(' ').filter(Boolean).map(raw => { const norm = this.norm(raw); return { raw, norm, plain: raw === norm }; });
  },
  _lev1(a, b) {
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
  },
  _seed(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; },
  _pick(arr, seed) { return arr[this._seed(seed) % arr.length]; },
  _vnd(n) { return API.utils.formatVND(n); },
  _r(intent, text, confidence, extra) {
    return Object.assign({ intent, text, confidence }, extra || {});
  },

  _tagsOf(m) {
    if (LB_TAGS[m.id]) return LB_TAGS[m.id];
    const n = this.norm(m.name + ' ' + (m.description || ''));
    const t = [];
    if (m.categoryId === 'coffee') t.push('cafe', 'cafein');
    if (m.categoryId === 'tea') t.push('cafein');
    if (['smoothie', 'juice'].includes(m.categoryId)) t.push('traicay', 'giainhiet');
    if (m.categoryId === 'soda') t.push('giainhiet');
    if (/\bnong\b/.test(n)) t.push('nong');
    return t;
  },
  _items() { return API.menu.getAll().map(m => ({ m, tags: this._tagsOf(m), toks: this._tok(m.name) })); },

  /* ⚡ v6.1 — dòng gợi ý từ lịch sử: món anh/chị hay gọi + món tương tự (cùng nhóm, chưa từng gọi) */
  _historyRows() {
    const empty = { rows: [] };
    try {
      const u = typeof API !== 'undefined' ? API.users.getCurrent() : null;
      if (!u) return empty;
      const orders = (API.orders.getByUser(u.id) || []).filter(o => o.status !== 'cancelled' && Array.isArray(o.items) && o.items.length);
      if (!orders.length) return empty;
      const freq = {};
      orders.forEach(o => (o.items || []).forEach(it => { freq[it.itemId] = (freq[it.itemId] || 0) + (it.qty || 1); }));
      const topIds = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
      const all = this._items();
      const history = topIds.map(id => all.find(x => x.m.id === id && x.m.inStock)).filter(Boolean);
      const seen = new Set(history.map(x => x.m.id));
      const cats = new Set(history.map(x => x.m.categoryId));
      const similar = all.filter(x => cats.has(x.m.categoryId) && !seen.has(x.m.id) && x.m.inStock)
        .sort((a, b) => (b.m.badge ? 1 : 0) - (a.m.badge ? 1 : 0))
        .slice(0, 2);
      return {
        rows: [
          ...history.map(x => ({ x, s: 100, matched: 1, _reason: 'món anh/chị quen gọi ✅' })),
          ...similar.map(x => ({ x, s: 40, matched: 0, _reason: 'tương tự món anh/chị hay dùng ✨' }))
        ]
      };
    } catch (e) { return empty; }
  },
  _tokMatch(q, t) {
    if (q.raw === t.raw) return true; if (!q.plain) return false; if (q.norm === t.norm) return true;
    return q.norm.length >= 5 && t.norm.length >= 5 && this._lev1(q.norm, t.norm);
  },

  /* ⚡ FIX: fullMatch flag */
  _findItems(raw) {
    const midMatches = raw.match(/\bM\d{3}\b/gi);
    if (midMatches) {
      const items = midMatches.map(id => { const m = API.menu.getById(id.toUpperCase()); return m ? { m, tags: this._tagsOf(m), toks: this._tok(m.name) } : null; }).filter(Boolean);
      if (items.length > 0) { items.generic = false; return items; }
    }
    const cleaned = this.norm(raw);
    const isSearchIntent = /\b(tim|co|cho minh|minh muon)\s+(mon|do uong|nuoc)\s+([a-z0-9 ]{2,25})/.test(cleaned) && !/\b(menu|cho|ban|ngoi|khong|gi|nao)\b/.test(cleaned.split(' ').slice(-3).join(' '));
    if (isSearchIntent) {
      const kw = cleaned.replace(/\b(tim|co|cho minh|minh|toi|muon|can|xem|giup|mon|do uong|nuoc)\b/g, '').trim();
      if (kw && kw.length >= 2) {
        const allMenu = API.menu.getAll();
        const exactItems = allMenu.filter(m => this.norm(m.name) === kw || this.norm(m.name).includes(' ' + kw + ' ') || this.norm(m.name).startsWith(kw + ' '));
        if (exactItems.length === 0) { const empty = []; empty.generic = false; empty._searchMissed = kw; return empty; }
        const exactList = exactItems.map(m => ({ m, tags: this._tagsOf(m), toks: this._tok(m.name) }));
        exactList._isExactSearch = true; return exactList;
      }
    }
    const cleanKw = this.norm(raw).replace(/\b(tim|co|cho minh|minh|toi|muon|can|xem|giup|mon|do uong|nuoc)\s*/g, '').trim();
    let q = this._tok(cleanKw || raw);
    const all = this._items();
    const out = []; let onlyGeneric = true;
    for (let round = 0; round < 3; round++) {
      const scored = [];
      all.forEach(it => {
        if (out.includes(it)) return;
        let overlap = 0, strong = 0;
        it.toks.forEach(t => { if (q.some(w => this._tokMatch(w, t))) { overlap++; if (!this.GENERIC.has(t.norm)) strong++; } });
        const fullMatch = overlap === it.toks.length && it.toks.length >= 2;
        if (strong >= 1 || overlap >= 2) scored.push({ it, overlap, strong, fullMatch });
      });
      if (!scored.length) break;
      const best = Math.max(...scored.map(s => s.overlap));
      const group = scored.filter(s => s.overlap === best);
      group.forEach(g => { out.push(g.it); if (g.strong > 0 || g.fullMatch) onlyGeneric = false; });
      q = q.filter(w => !group.some(g => g.it.toks.some(t => this._tokMatch(w, t))));
      if (out.length >= 6) break;
    }
    out.generic = out.length > 0 && onlyGeneric;
    return out;
  },

  /* ⚡ parseSeat — ĐẦY ĐỦ 8 preference */
  parseSeat(raw) {
    const n = this.norm(raw);
    const S = { zone: null, floor: null, size: null, view: false, quiet: false, group: false, outdoor: false, projector: false, outlet: false, date: null, time: null, timeOfDay: null, desc: [], signals: 0 };
    const sig = l => { S.signals++; if (l) S.desc.push(l); };

    if (/\b(hom nay|toi nay|chieu nay|sang nay)\b/.test(n)) S.date = 'Hôm nay';
    else if (/\b(ngay mai|toi mai|sang mai|chieu mai)\b/.test(n)) S.date = 'Ngày mai';
    else if (/\b(ngay mot|toi mot)\b/.test(n)) S.date = 'Ngày mốt';
    else if (/\b(thu 2|thu 3|thu 4|thu 5|thu 6|thu 7|chu nhat)\b/.test(n)) S.date = raw.match(/\b(thu 2|thu 3|thu 4|thu 5|thu 6|thu 7|chu nhat)\b/)[0];

    if (/\b(sang|sáng)\b/.test(n)) S.timeOfDay = 'sáng';
    else if (/\b(trua|trưa)\b/.test(n)) S.timeOfDay = 'trưa';
    else if (/\b(chieu|chiều)\b/.test(n)) S.timeOfDay = 'chiều';
    else if (/\b(toi|tối)\b/.test(n)) S.timeOfDay = 'tối';

    const timeMatch = n.match(/\b(\d{1,2})\s*(?::|h|gio)\s*(\d{2})?\b/) || n.match(/\b(\d{1,2})\s+(\d{2})\b/);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      let m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (/toi|chieu/.test(n) && h < 12) h += 12;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) S.time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    if (/\b(yen tinh|im lang|it on|tap trung|hoc bai|lam bai|on thi|doc sach|deadline|lam viec|hoc)\b/.test(n)) { S.quiet = true; sig('yên tĩnh'); }
    if (/\b(nhom|hop|team|sinh nhat|tiec|ban be dong|liên hoan)\b/.test(n)) { S.group = true; sig('họp nhóm'); }
    if (/\b(view|ngam|chup anh|check in|song ao|cua so|hoang hon)\b/.test(n)) { S.view = true; sig('có view đẹp'); }
    if (/\b(ngoai troi|san thuong|tang thuong|thoang|gio mat|view thanh pho)\b/.test(n)) { S.outdoor = true; sig('ngoài trời'); }
    if (/\b(may chieu|thuyet trinh|present)\b/.test(n)) { S.projector = true; sig('có máy chiếu'); }
    if (/\b(o cam|sac|cam dien)\b/.test(n)) { S.outlet = true; }

    const fl = n.match(/\b(tang tret|lau 1|lau 2|tang thuong|san thuong)\b/);
    if (fl) {
      S.floor = /tret/.test(fl[1]) ? 'F1' : fl[1] === 'lau 1' ? 'F2' : fl[1] === 'lau 2' ? 'F3' : 'F4';
      sig(null);
      S.desc.push({ F1: 'tầng trệt', F2: 'Lầu 1', F3: 'Lầu 2', F4: 'tầng thượng' }[S.floor]);
    }

    let m = n.match(/\b(\d{1,2})\s*(nguoi|ban|ng|nguoi lon)\b/);
    if (m) S.size = parseInt(m[1], 10);
    else {
      m = n.match(/\b(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s+nguoi\b/);
      if (m && /\bnguoi\b/.test(n) && !/\bmuoi\s+nguoi\b.*\bmuoi\b/.test(n)) S.size = this.NUMW[m[1]];
    }
    if (S.size) { sig(`cho ${S.size} người`); if (S.size >= 5) S.group = true; }

    return S;
  },

  _seatRows(S, exclude = []) {
    const rows = [];
    API.seats.getAll().forEach(seat => {
      if (seat.status !== 'available' || exclude.includes(seat.id)) return;
      if (S.size && seat.capacity < S.size) return;
      if (S.floor && seat.floorId !== S.floor) return;
      let sc = 0;
      const d = this.norm(seat.description || '');
      if (S.quiet) sc += (seat.zone === 'quiet' ? 4 : seat.floorId === 'F2' ? 3 : -1);
      if (S.group) sc += (seat.zone === 'group' ? 4 : 0);
      if (S.outdoor) sc += (seat.floorId === 'F4' ? 4 : -2);
      if (S.view) sc += (seat.zone === 'window' ? 3 : 0) + (/view/.test(d) ? 2 : 0);
      if (S.projector) sc += (/may chieu/.test(d) ? 5 : -3);
      if (S.outlet && /(o cam|ke sach|goc)/.test(d)) sc += 2;
      if (S.size) sc -= (seat.capacity - S.size) * 0.6; else sc -= Math.abs(seat.capacity - 2) * 0.2;
      if (S.quiet && /(o cam|ke sach|goc)/.test(d)) sc += 1;
      rows.push({ seat, s: sc });
    });
    return rows.sort((a, b) => b.s - a.s || a.seat.id.localeCompare(b.seat.id, 'vi', { numeric: true }));
  },

  /* ⚡ _seatOverview — có set ctx khi list seats */
  _seatOverview() {
    const avail = API.seats.getAvailable();
    if (!avail.length) return 'Dạ hiện quán đã hết chỗ. Anh/chị thông cảm nhé! 😔';
    const byFloor = {};
    avail.forEach(s => { byFloor[s.floorId] = (byFloor[s.floorId] || 0) + 1; });
    const lines = Object.entries(byFloor).map(([fid, count]) => {
      const floor = API.floors.getById(fid);
      return `• ${floor ? floor.name : fid}: ${count} chỗ`;
    });
    this.ctx = { kind: 'seat', prefs: {}, shown: avail.slice(0, 6).map(s => s.id), ts: Date.now(), sid: this._currentSid() };
    return `Dạ còn tổng cộng ${avail.length} chỗ trống:\n${lines.join('\n')}\n\nAnh/chị muốn ngồi khu vực nào ạ? (yên tĩnh / cửa sổ / nhóm / ngoài trời)`;
  },

  /* ⚡ _seatReply — set ctx để booking modal prefill */
  _seatReply(S, raw, exclude = []) {
    if (S.size && S.size > 8) {
      return `Dạ nhóm ${S.size} người em chưa xếp được trực tiếp (phòng lớn nhất 8 người). Anh/chị gọi hotline ${KB.store.hotline} nhé.`;
    }
    let rows = this._seatRows(S, exclude);
    const good = rows.filter(r => r.s > -1.5);
    let relaxed = false;
    if (good.length) rows = good; else if (rows.length) relaxed = true;
    if (!rows.length) {
      const total = API.seats.getAvailable().length;
      return `Dạ hiện chưa có chỗ trống khớp ${S.desc.join(', ') || 'yêu cầu'}. ${total ? `Quán còn ${total} chỗ ở khu vực khác.` : 'Hiện quán đã hết chỗ.'}`;
    }
    const top = rows.slice(0, 3);
    const lines = top.map(r => {
      const f = API.floors.getById(r.seat.floorId);
      return `• Bàn ${r.seat.id} – ${f ? f.name : r.seat.floorId}, ${r.seat.capacity} người${r.seat.description ? ' (' + r.seat.description + ')' : ''}`;
    });
    this.ctx = { kind: 'seat', prefs: S, shown: top.map(r => r.seat.id), ts: Date.now(), dateISO: '', time: S.time || '', guests: S.size || '', sid: this._currentSid() };
    const need = S.desc.filter(d => typeof d === 'string').join(', ');
    const head = relaxed
      ? `Dạ hiện không có chỗ khớp đầy đủ yêu cầu (${need}). Gợi ý gần nhất:`
      : `Dạ em tìm được ${rows.length} chỗ phù hợp${need ? ' với ' + need : ''}, gợi ý:`;
    return `${head}\n${lines.join('\n')}\n\nAnh/chị vào mục "Đặt chỗ" để giữ bàn nhé.`;
  },

  /* ⚡ FIX: itemRecency khai báo đúng scope */
  _scoreDrinks(P, exclude = []) {
    const itemRecency = {};
    const items = this._items().filter(x => x.m.inStock && !exclude.includes(x.m.id));
    const maxP = Math.max(1, ...items.map(x => x.m.price));
    const out = [];
    const u = API.users.getCurrent();
    const rejected = (u && typeof UserMemory !== 'undefined') ? (UserMemory.getRejected ? UserMemory.getRejected(u.id) : new Set()) : new Set();
    if (u) {
      const recent = API.orders.getByUser(u.id).filter(o => o.status !== 'cancelled' && o.step >= 4).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
      recent.forEach(o => {
        const daysAgo = (Date.now() - new Date(o.createdAt)) / 86400000;
        (o.items || []).forEach(it => { if (itemRecency[it.itemId] === undefined || itemRecency[it.itemId] > daysAgo) itemRecency[it.itemId] = daysAgo; });
      });
    }
    items.forEach(x => {
      if (rejected.has(x.m.id)) return;
      const tg = x.tags;
      /* ⚡ FIX Bánh Flan: dessert flag quyết định có filter 'banh' hay không */
      if (P.dessert ? !tg.includes('banh') : tg.includes('banh')) return;
      if (P.noCoffee && tg.includes('cafe')) return;
      if (P.noCaf && tg.includes('cafein')) return;
      if (P.maxPrice && x.m.price > P.maxPrice) return;
      if (P.cats.length && !P.cats.includes(x.m.categoryId)) return;
      if (P.temp === 'hot' && !tg.includes('nong')) return;
      if (P.temp === 'cold' && tg.includes('nong')) return;
      let s = 0, matched = 0;
      P.pos.forEach(k => { if (tg.includes(k)) { s += 3; matched++; } });
      if (P.pos.size && !matched) return;
      P.neg.forEach(k => { if (tg.includes(k)) s -= 6; });
      if (P.neg.has('ngot')) { if (tg.includes('itngot')) s += 3; else if (!tg.includes('ngot')) s += 1; }
      if (P.neg.has('ngot') && tg.includes('ngot')) return;
      if (P.pos.has('tinhtao') && tg.includes('cafein')) s += 1;
      if (P.cheap) s += (1 - x.m.price / maxP) * 3;
      if (P.popular) {
        if (x.m.badge && /(hot|bán chạy|best|signature|mới)/i.test(x.m.badge)) s += 10;
        else if (x.m.badge) s += 4;
        else return;
      }
      if (P.fresh) { if (/mới/i.test(x.m.badge || '')) s += 6; else return; }
      if (x.m.badge) s += 0.4;
      if (itemRecency[x.m.id] !== undefined) {
        const d = itemRecency[x.m.id];
        s += d < 1 ? -8 : d < 3 ? -5 : d < 7 ? -2 : d < 14 ? -0.5 : 0;
      }
      out.push({ x, s, matched });
    });
    return out.sort((a, b) => b.s - a.s || a.x.m.price - b.x.m.price);
  },

  /* ⚡ exposed — fix G12 */
  _compare(items) {
    const a = items[0], b = items[1];
    const wa = a.tags.filter(k => LB_WORDS[k]).slice(0, 3).map(k => LB_WORDS[k]).join(', ') || 'đang cập nhật';
    const wb = b.tags.filter(k => LB_WORDS[k]).slice(0, 3).map(k => LB_WORDS[k]).join(', ') || 'đang cập nhật';
    const diff = a.m.price - b.m.price;
    const cmp = diff === 0 ? 'Hai món cùng giá.' : `${diff > 0 ? b.m.name : a.m.name} rẻ hơn ${this._vnd(Math.abs(diff))}.`;
    return this._r('compare', `Dạ em so sánh giúp anh/chị:\n• ${a.m.name} – ${this._vnd(a.m.price)} (${wa})\n• ${b.m.name} – ${this._vnd(b.m.price)} (${wb})\n\n${cmp}`, 0.9);
  },

  _price(items, n, raw) {
    if (items.generic || items.length > 4) return null;
    const lines = items.map(i => `• ${i.m.name} – ${this._vnd(i.m.price)}${i.m.inStock ? '' : ' (tạm hết hàng)'}`);
    this.ctx = { kind: 'drink', prefs: this.parsePrefs(''), shown: items.map(i => i.m.id), minPrice: Math.min(...items.map(i => i.m.price)), ts: Date.now(), sid: this._currentSid() };
    return this._r('price', `Dạ giá như sau ạ:\n${lines.join('\n')}`, 0.9);
  },
  _stock(items) {
    return this._r('stock', `Dạ tình trạng:\n${items.slice(0, 4).map(i => `• ${i.m.name}: ${i.m.inStock ? 'còn hàng' : 'tạm hết'}`).join('\n')}`, 0.9);
  },
  _info(items) {
    return this._r('info', `Dạ em giới thiệu:\n${items.slice(0, 3).map(i => `• ${i.m.name} – ${this._vnd(i.m.price)}`).join('\n')}`, 0.85);
  },
  _extreme(raw, n) {
    const cheap = /\bre nhat\b|\bthap nhat\b/.test(n);
    let rows = this._items().filter(x => x.m.inStock);
    rows.sort((a, b) => cheap ? a.m.price - b.m.price : b.m.price - a.m.price);
    if (!rows.length) return null;
    const top = rows.slice(0, 3);
    return this._r('extreme', `Dạ ${cheap ? 'rẻ nhất' : 'cao cấp nhất'}:\n${top.map(r => `• ${r.m.name} – ${this._vnd(r.m.price)}`).join('\n')}`, 0.9);
  },

  _why(x, P) {
    const ws = [];
    P.pos.forEach(k => { if (x.tags.includes(k) && LB_WORDS[k]) ws.push(LB_WORDS[k]); });
    if (P.neg.has('ngot') && x.tags.includes('itngot')) ws.push('ít ngọt');
    if (P.temp === 'hot' && x.tags.includes('nong')) ws.push('dùng nóng');
    if (x.m.badge) ws.push(x.m.badge.toLowerCase());
    if (!ws.length) x.tags.filter(k => LB_WORDS[k]).slice(0, 2).forEach(k => ws.push(LB_WORDS[k]));
    return [...new Set(ws)].slice(0, 3).join(', ');
  },

  _describe(P) { return P.desc.length ? P.desc.join(', ') : ''; },

  _drinkReply(P, rows, raw, intro) {
    const top = rows.slice(0, 3);
    const d = this._describe(P);
    const head = intro || (d ? `Dạ em chọn giúp anh/chị ${top.length} món hợp nhất với yêu cầu (${d}):` : `Dạ anh/chị thử ${top.length === 1 ? 'món này' : 'những món này'} nhé:`);
    let title;
    if (intro && /lịch sử/i.test(intro)) title = 'Theo lịch sử của anh/chị';
    else if (intro && /thêm/i.test(intro)) title = 'Gợi ý thêm';
    else if (intro && /bán chạy|hot/i.test(intro)) title = 'Món bán chạy';
    else if (intro && /tâm trạng|xoa dịu/i.test(intro)) title = 'Xoa dịu tâm trạng';
    else if (intro) title = 'Gợi ý';
    else if (d) title = `Phù hợp: ${d}`;
    else title = 'Gợi ý cho bạn';
    const reasons = {};
    top.forEach(r => { reasons[r.x.m.id] = r._reason || this._why(r.x, P) || ''; });
    this.ctx = { kind: 'drink', prefs: P, shown: top.map(r => r.x.m.id), reasons, minPrice: Math.min(...top.map(r => r.x.m.price)), ts: Date.now(), sid: this._currentSid(), title: title };
    const items = top.map(r => ({ id: r.x.m.id, name: r.x.m.name, price: r.x.m.price, inStock: r.x.m.inStock, badge: r.x.m.badge, reason: reasons[r.x.m.id] }));
    return this._r('drink', head, 0.9, { recommendationData: { title, items, source: 'local', mood: 'normal' } });
  },

  parsePrefs(raw) {
    const rawPlain = !/[^\x00-\x7F]/.test(raw);
    let t = this.norm(raw).replace(/sua chua/g, 'suachua');
    const P = { pos: new Set(), neg: new Set(), cats: [], temp: null, maxPrice: null, cheap: false, popular: false, fresh: false, noCoffee: false, noCaf: false, dessert: false, desc: [], signals: 0 };
    const take = re => { if (re.test(t)) { t = t.replace(re, ' '); return true; } return false; };
    const sig = (label) => { P.signals++; if (label) P.desc.push(label); };

    if (/\b(khong caffeine|khong cafein|ko caffeine|ko cafein|mat ngu|de ngu|khong ngu duoc|kho ngu|dau da day|da day|buon non|say xe)\b/.test(t)) {
      P.noCaf = true; P.noCoffee = true; sig('không caffeine / dễ tiêu');
      t = t.replace(/\b(khong caffeine|khong cafein|ko caffeine|ko cafein|mat ngu|de ngu|khong ngu duoc|kho ngu|dau da day|da day|buon non|say xe)\b/g, '');
    }
    if (/\b(tieu duong|dai thao duong)\b/.test(t)) {
      P.neg.add('ngot'); sig('ít đường / tiểu đường');
      t = t.replace(/\b(tieu duong|dai thao duong)\b/g, '');
    }
    if (/\b(nguoi moi|moi uong|chua quen|moi tap|lan dau)\b/.test(t) && /\b(ca phe|cafe|coffee)\b/.test(t)) {
      P.cats = ['coffee']; P.pos = new Set(['ngot', 'beo']); P.neg = new Set(['dang']); sig('cà phê dễ uống');
      t = t.replace(/\b(nguoi moi|moi uong|chua quen|moi tap|lan dau|ca phe|cafe|coffee)\b/g, '');
    }
    if (/đỡ\s+ngọt/.test(raw)) t = t.replace(/\bdo ngot\b/, 'it ngot'); else t = t.replace(/\bdo ngot\b/g, 'dongot');
    if (/đỡ\s+béo/.test(raw)) t = t.replace(/\bdo beo\b/, 'it beo'); else t = t.replace(/\bdo beo\b/g, 'dobeo');
    if (take(/\b(khong|ko|it|bot|dung|han che)\s+(co\s+|qua\s+|bi\s+|that\s+)?ngot\b|\bngot\s+(it|thoi|vua)\b|\bkhong\s+duong\b/)) { P.neg.add('ngot'); sig('ít ngọt'); }
    if (take(/\b(khong|ko|it|bot|dung)\s+(qua\s+|bi\s+|that\s+)?beo\b/)) { P.neg.add('beo'); sig('không quá béo'); }
    if (/(không|ko|ít|bớt|đỡ)\s+(quá\s+|bị\s+)?đắng/.test(raw) || take(/\b(khong|ko|it|bot)\s+(qua\s+|bi\s+)?dang\b/)) { P.neg.add('dang'); sig('ít đắng'); }
    t = t.replace(/\bdongot\b/g, 'ngot').replace(/\bdobeo\b/g, 'beo');
    if (take(/\b(cho (be|con)|tre em|con nit|thieu nhi|kids?)\b/)) { P.noCaf = true; P.pos.add('ngot'); sig('phù hợp trẻ nhỏ'); }
    if (take(/\btroi (lanh|ret|mua)\b|\bam bung\b|\bcho am\b/)) { P.temp = 'hot'; sig('đồ nóng'); }
    else if (take(/\btroi (nong|oi|nang)\b|\bnong buc\b|\boi buc\b|\bnang nong\b/)) { P.temp = 'cold'; P.pos.add('giainhiet'); sig('giải nhiệt'); }
    else if (take(/\bnong\b/)) { P.temp = 'hot'; sig('đồ nóng'); }
    else if (/mát|lạnh|giải nhiệt|giải khát|đá lạnh|tươi mát/.test(raw) || take(/\b(lanh|da lanh|giai nhiet|giai khat|tuoi mat|co da)\b/) || (rawPlain && take(/\bmat\b/))) { P.temp = 'cold'; P.pos.add('giainhiet'); sig('mát lạnh'); }
    if (/ngậy/.test(raw) || take(/\bbeo\b|\bnhieu sua\b/)) { P.pos.add('beo'); sig('béo ngậy'); }
    if (take(/\bngot\b/)) { P.pos.add('ngot'); sig('ngọt'); }
    if (/đắng/.test(raw) || take(/\bvi dang\b|\bdam da\b|\bdam dac\b/)) { P.pos.add('dang'); sig('đậm vị'); }
    if (take(/\bchua\b/)) { P.pos.add('chua'); sig('chua thanh'); }
    if (take(/\bthanh (mat|nhe|dam)\b|\bnhe nhang\b|\bde uong\b/)) { P.pos.add('thanh'); sig('thanh nhẹ'); }
    if (take(/\b(trai cay|hoa qua|vitamin|healthy|detox)\b/)) { P.pos.add('traicay'); sig('trái cây'); }
    if (take(/\btinh (tao|ngu|nguoi)\b|\bbuon ngu\b|\bthuc khuya\b|\bdeadline\b|\bon thi\b|\bhoc bai\b|\bcan (nang luong|tinh)\b|\bmet moi\b|\bdam hon\b|\bmanh hon\b/)) { P.pos.add('tinhtao'); sig('tỉnh táo'); }
    if (/trà/.test(raw) || /\buong tra\b|\bmon tra\b|\bdo tra\b|\btra (gi|nao|ngon)\b/.test(t)) { P.cats.push('tea'); sig('trà'); }
    if (!P.noCoffee && take(/\b(ca phe|cafe|coffee)\b/)) { P.cats.push('coffee'); sig('cà phê'); }
    if (take(/\bsinh to\b/)) { P.cats.push('smoothie'); sig('sinh tố'); }
    if (take(/\bnuoc ep\b/)) { P.cats.push('juice'); sig('nước ép'); }
    if (take(/\bsoda\b/)) { P.cats.push('soda'); sig('soda'); }
    if (take(/\bda xay\b/)) { P.cats.push('other'); sig('đá xay'); }
    if (take(/\b(banh|an vat|flan|trang mieng)\b/)) { P.dessert = true; sig('tráng miệng'); }
    let mb = t.match(/\b(duoi|toi da|khong qua|max|tam|khoang|ngan sach)\s*(\d{1,3})(?:\s?(?:k|nghin|ngan|000))?\b/) || t.match(/<\s*(\d{1,3})(?:\s?(?:k|nghin|ngan|000))?/);
    if (mb) {
      const num = parseInt(mb[mb.length === 3 ? 2 : 1], 10);
      const kind = mb.length === 3 ? mb[1] : '<';
      const v = num < 1000 ? num * 1000 : num;
      P.maxPrice = /tam|khoang/.test(kind) ? Math.round(v * 1.1) : v;
      sig('dưới ' + this._vnd(P.maxPrice));
    }
    if (take(/\b(re|tiet kiem|binh dan|sinh vien|it tien|gia mem)\b/)) { P.cheap = true; sig('giá mềm'); }
    if (take(/\b(ban chay|best ?seller|hot|pho bien|nhieu nguoi (uong|goi|thich)|noi bat|signature|ua chuong|ban chay nhat)\b/)) { P.popular = true; sig('được chọn nhiều'); }
    if (take(/\bmon moi\b|\bmoi ra\b|\bco (gi|mon nao) moi\b|\bdo uong moi\b|\bthuc uong moi\b|\bdoc la\b|\bla mieng\b/)) { P.fresh = true; sig('món mới'); }
    P.cue = /\b(goi y|nen uong|uong gi|mon nao|co mon|muon uong|tu van|de xuat|chon (giup|cho)|recommend|thich|cho minh|uong duoc|nen (goi|chon)|can (mon|uong|nuoc|do)|muon (mon|do|nuoc)|tim (mon|do|nuoc)|co (do|nuoc|mon) nao)\b/.test(this.norm(raw));
    return P;
  },

  /* ⚡ backward-compat stubs cho regression test */
  _handleBookingFlow(S, raw) {
    const curSid = this._currentSid();
    this.bookingDraft = this.bookingDraft || { sid: curSid };
    if (this.bookingDraft.sid !== curSid) this.bookingDraft.sid = curSid;
    return { intent: 'booking', text: '', confidence: 0.95 };
  },

  /* ⚡ GET SMART GREETING: lời chào đầu-session dạng thẻ interactive
     (main.js đã gọi hàm này từ lâu nhưng trước đây hàm chưa tồn tại → dead code,
      khách chỉ thấy chào text khô khan). Trả chuỗi có [UI_WELCOME] để UICards.appendTo render chip. */
  getSmartGreeting() {
    try {
      const hour = new Date().getHours();
      let hello = 'Chào buổi sáng';
      if (hour >= 11 && hour < 14) hello = 'Chào buổi trưa';
      else if (hour >= 14 && hour < 18) hello = 'Chào buổi chiều';
      else if (hour >= 18) hello = 'Chào buổi tối';
      const user = (typeof API !== 'undefined' && API.users && API.users.getCurrent) ? API.users.getCurrent() : null;
      const options = [
        { label: '📖 Xem menu', prompt: 'menu có gì' },
        { label: '🪑 Đặt bàn', prompt: 'đặt bàn' },
        { label: '🎁 Khuyến mãi', prompt: 'khuyến mãi hôm nay' }
      ];
      const top = (typeof API !== 'undefined' && API.menu && API.menu.getAvailable)
        ? (API.menu.getAvailable() || []).filter(m => m && m.badge).slice(0, 2) : [];
      top.forEach(m => options.push({ label: '🔥 ' + m.name, itemId: m.id }));
      if (options.length < 4) options.push({ label: '🔥 Món bán chạy', prompt: 'món bán chạy' });
      const payload = { title: 'Em giúp được gì ngay hôm nay?', options: options.slice(0, 5) };
      return `${hello} ${user && user.name ? user.name : 'anh/chị'}! 👋\nGọi món, đặt bàn, thanh toán hay tra đơn — cứ nhắn trong khung chat này là em lo hết ạ.\n[UI_WELCOME]${JSON.stringify(payload)}[/UI_WELCOME]`;
    } catch (e) { return ''; }
  }
};

/* ============================================================ */

const LBHandlers = {
  pickFromContext(raw, n) {
    const m = n.match(/\b(lay|chon|goi|dat|mua|lay mon|chon mon)\s*(so\s*)?(\d|dau|thu 1|thu 2|thu 3|cuoi)\b/);
    if (!m || !LocalBrain.ctx || LocalBrain.ctx.kind !== 'drink') return null;
    const word = m[3]; let idx = 0;
    if (word === '2' || word === 'thu 2') idx = 1; else if (word === '3' || word === 'thu 3') idx = 2; else if (word === 'cuoi') idx = LocalBrain.ctx.shown.length - 1;
    const itemId = LocalBrain.ctx.shown[idx]; const item = itemId && API.menu.getById(itemId);
    if (!item) return null;
    if (typeof quickOrder === 'function') quickOrder(itemId);
    return { intent: 'action', text: `Dạ em đã thêm **${item.name}** vào giỏ hàng cho anh/chị ạ!`, confidence: 0.95 };
  },

  editNote(raw, n) {
    if (!/\b(it|bot|khong|nhieu|them)\s+(da|duong|sua|kem)\b/.test(n)) return null;
    const cart = API.cart.get();
    if (!cart.length) return { intent: 'action', text: 'Dạ giỏ hàng trống, anh/chị chọn món trước nhé!', confidence: 0.95 };
    const last = cart[cart.length - 1];
    last.note = (last.note || '') + (last.note ? ', ' : '') + raw;
    API.cart.set(cart);
    if (typeof updateUserArea === 'function') updateUserArea();
    return { intent: 'action', text: `Dạ em đã ghi chú **"${raw}"** cho món **${last.name}** ạ!`, confidence: 0.95 };
  },

  /* ⚡ NEW — wire vào chain */
  multiOrder(raw, n) {
    if (/\b(goi y|tu van|de xuat|lich su|dua tren|hay mua|da mua|quen thuoc)\b/.test(n)) return null;
    const items = LocalBrain._findItems(raw);
    if (!items || items.length < 1 || items.generic) return null;
    const isOrderIntent = /\b(mua|lay|goi|them|dat)\b/.test(n) || (/\b(uong|an)\b/.test(n) && !/\b(gi|nao|khong|ko|goi y|phu hop)\b/.test(n));
    if (!isOrderIntent) return null;
    const added = []; const failed = [];
    items.forEach(i => {
      if (!i.generic && i.m.inStock) {
        try {
          API.cart.add({ itemId: i.m.id, name: i.m.name, price: i.m.price, img: i.m.img, size: 'M', toppings: [] });
          added.push(`**${i.m.name}**`);
        } catch (e) { failed.push(i.m.name); }
      } else if (!i.generic && !i.m.inStock) { failed.push(i.m.name); }
    });
    if (added.length > 0) {
      if (typeof updateUserArea === 'function') updateUserArea();
      if (typeof showToast === 'function') showToast(`✓ Đã thêm ${added.length} món vào giỏ`, '#2E7D32');
      let msg = `Dạ em đã thêm vào giỏ hàng cho anh/chị: ${added.join(' và ')}.`;
      if (failed.length) msg += `\n⚠️ Các món đã hết hàng: ${failed.join(', ')}.`;
      msg += `\n\n🛒 Anh/chị có muốn thanh toán luôn không?`;
      return LocalBrain._r('action', msg, 0.95);
    }
    return null;
  },

  /* ⚡ NEW — wire vào chain, FIX filter Bánh Flan */
  medicalRecommend(raw, n) {
    // ⚡ FIX #12: bổ sung "mang thai" + "không uống được cafein" + "tránh cafein"
    if (/\b(dau da day|kho ngu|mat ngu|buon non|say xe|mang thai|khong uong duoc cafein|tranh cafein)\b/.test(n)) {
      const items = API.menu.getAvailable()
        .filter(m => {
          const tags = LocalBrain._tagsOf(m);
          return !tags.includes('cafein') && !tags.includes('cafe');
        })
        .slice(0, 3)
        .map(m => ({ id: m.id, name: m.name, price: m.price, inStock: true, badge: m.badge, reason: 'Không cafein, dễ tiêu' }));
      if (items.length) {
        return LocalBrain._r('drink', `Dạ các món không chứa cafein phù hợp cho anh/chị:`, 0.95, {
          recommendationData: { title: 'Không cafein', items, source: 'local', mood: 'normal' }
        });
      }
    }
    if (/\b(tieu duong|dai thao duong)\b/.test(n)) {
      const items = API.menu.getAvailable()
        .filter(m => {
          const tags = LocalBrain._tagsOf(m);
          return (tags.includes('itngot') || tags.includes('thanh') || tags.includes('chua')) && !tags.includes('banh');
        })
        .slice(0, 3)
        .map(m => ({ id: m.id, name: m.name, price: m.price, inStock: true, badge: m.badge, reason: 'Ít ngọt, tốt cho sức khỏe' }));
      if (items.length) {
        return LocalBrain._r('drink', `Dạ các món ít ngọt phù hợp cho anh/chị:`, 0.95, {
          recommendationData: { title: 'Ít đường', items, source: 'local', mood: 'normal' }
        });
      }
    }
    return null;
  },

  seatQuery(raw, n) {
    const seatCue = /\b(cho (ngoi|nao|tot|dep|yen|trong)|con cho|ngoi (dau|o)|co (cho|ban)|ban nao|phong (hop|nhom)|khu (nao|vuc)|dat cho|tim cho|can cho|muon ngoi)\b/.test(n) ||
                    (/\b(cho|ban|phong)\b/.test(n) && /\b(nguoi|yen tinh|view|ngoai troi|cua so|may chieu)\b/.test(n));
    if (!seatCue) {
      if (/\bco o cam\b|\bo cam (khong|ko)\b|\bsac (dien thoai|laptop|pin)\b/.test(n)) {
        return { intent: 'outlet', text: 'Dạ quán có ổ cắm điện tại mọi bàn ạ.', confidence: 0.85 };
      }
      return null;
    }
    const S = LocalBrain.parseSeat(raw);
    if (S.signals === 0) return { intent: 'seat', text: LocalBrain._seatOverview(), confidence: 0.8 };
    return { intent: 'seat', text: LocalBrain._seatReply(S, raw), confidence: 0.85 };
  },

  itemQuery(raw, n) {
    const found = LocalBrain._findItems(raw);
    const hasItem = found.length && !found.generic;

    if (found._searchMissed) {
      const kw = found._searchMissed;
      const sug = API.menu.getAll().filter(m => m.inStock && LocalBrain.norm(m.name).includes(kw.split(' ')[0])).slice(0, 3);
      let reply = `Dạ CAPPAN hiện không có món "${kw}" ạ.`;
      if (sug.length) reply += `\nAnh/chị tham khảo:\n${sug.map(m => `• ${m.name} – ${LocalBrain._vnd(m.price)}`).join('\n')}`;
      return LocalBrain._r('drink', reply, 0.9, {
        recommendationData: {
          title: `Không có "${kw}"`,
          items: sug.map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge, reason: 'Món tương tự' })),
          source: 'local', mood: 'normal'
        }
      });
    }

    if (found._isExactSearch && hasItem) {
      const top = found.slice(0, 3);
      const reasons = {};
      top.forEach(r => { reasons[r.m.id] = 'Khớp tên món'; });
      LocalBrain.ctx = { kind: 'drink', prefs: LocalBrain.parsePrefs(''), shown: top.map(r => r.m.id), reasons, minPrice: Math.min(...top.map(r => r.m.price)), ts: Date.now(), sid: LocalBrain._currentSid() };
      return LocalBrain._r('drink', `Dạ em tìm thấy ${top.length} món khớp:`, 0.95, {
        recommendationData: { title: 'Kết quả tìm kiếm', items: top.map(r => ({ id: r.m.id, name: r.m.name, price: r.m.price, inStock: r.m.inStock, badge: r.m.badge, reason: 'Khớp tên món' })), source: 'local', mood: 'normal' }
      });
    }

    if (/\b(re|dat) nhat\b|\bgia (thap|cao) nhat\b/.test(n)) {
      const ext = LocalBrain._extreme(raw, n);
      if (ext) return ext;
    }

    if (found.length >= 2 && found.length <= 3 && !found.generic && /\b(so sanh|khac (gi|nhau)|hay la|vs|nen chon|cai nao|hon|tot hon|ngon hon)\b/.test(n)) {
      return LocalBrain._compare(found);
    }

    if (/\b(gia|bao nhieu|nhieu tien|bao tien|may k|nghin|gia sao|gia ca)\b/.test(n)) {
      if (hasItem) {
        const priceRes = LocalBrain._price(found, n, raw);
        if (priceRes) return priceRes;
      } else {
        const P = LocalBrain.parsePrefs(raw);
        if (P.cats.length) {
          const catItems = API.menu.getAll().filter(m => P.cats.includes(m.categoryId) && m.inStock);
          if (catItems.length > 0) {
            const prices = catItems.map(m => m.price);
            const cat = API.categories.getById(P.cats[0]);
            return LocalBrain._r('price', `Dạ ${cat ? cat.name.replace(/^\S+\s/, '') : 'nhóm này'} có giá từ ${LocalBrain._vnd(Math.min(...prices))} đến ${LocalBrain._vnd(Math.max(...prices))} ạ.`, 0.85);
          }
        }
      }
    }

    if (hasItem && /\b(con (hang|khong|mon|ko)|het (chua|hang|roi|khong)|co (ban|khong|ko))\b/.test(n)) {
      return LocalBrain._stock(found);
    }

    if (hasItem && /\b(la gi|co gi|vi (the nao|ra sao|gi)|ngon (khong|ko)|nhu the nao|mo ta|nhu nao)\b/.test(n)) {
      return LocalBrain._info(found);
    }

    return null;
  },

  drinkRecommend(raw, n) {
    const P = LocalBrain.parsePrefs(raw);
    const generic = /\b(goi y|nen uong|uong gi|mon nao ngon|mon ngon|nen goi|nen chon)\b/.test(n) || (/\b(tu van|de xuat|chon giup|chon cho)\b/.test(n) && /\b(uong|mon|nuoc|do uong|thuc uong|ly)\b/.test(n));
    if (P.signals === 0 && !generic) return null;
    if (P.signals === 0 && generic) {
      /* ⚡ v6.1 — GỢI Ý PERSONAL: ưu tiên lịch sử mua hàng của khách, lặp lại món quen hoặc món tương tự */
      const h = LocalBrain._historyRows();
      if (h.rows.length) {
        return LocalBrain._drinkReply(P, h.rows, raw, 'Dạ dựa vào **lịch sử mua hàng** của anh/chị, em gợi ý những món này ạ:');
      }
      const rows = LocalBrain._scoreDrinks({ ...P, popular: true });
      if (!rows.length) return null;
      return LocalBrain._drinkReply(P, rows, raw, 'Dạ đây là những món được nhiều khách chọn ạ:');
    }
    const rows = LocalBrain._scoreDrinks(P);
    if (!rows.length) return { intent: 'drink', text: `Dạ em chưa tìm thấy món khớp "${LocalBrain._describe(P)}".`, confidence: 0.5 };
    return LocalBrain._drinkReply(P, rows, raw);
  }
};

/* ⚡ LocalBrain.answer — 7 handler chain + emotional delegation */
LocalBrain.answer = function(input, opts = {}) {
  try {
    const raw = String(input || '').trim();
    if (!raw || raw.length > 300) return null;
    const n = this.norm(raw);

    /* Emotional delegation — G17a/G17b */
    if (typeof EmotionalHandler !== 'undefined' && EmotionalHandler.canHandle(raw)) {
      const r = EmotionalHandler.handle(raw);
      const out = { intent: r.intent, text: r.text, confidence: r.confidence };
      if (r.recommendationData) out.recommendationData = r.recommendationData;
      else if (r.cards) {
        const m = r.cards.match(/\[UI_MENU\]([\s\S]*?)\[\/UI_MENU\]/);
        if (m) { try { out.recommendationData = JSON.parse(m[1]); } catch {} }
      }
      return out;
    }

    /* Guards — nhường cho LLM */
    if (/\b(diem tich luy|diem thuong|bao nhieu diem)\b/.test(n)) return null;
    if (/\b(cho|ban|booking)\s+(toi|minh|em)\b/.test(n)) return null;
    if (/\b(toi|minh)\s+(dang|da)\s+(dat|dung|ngoi)\b/.test(n)) return null;
    if (/\b(ca lam viec|ca cua (toi|minh)|lich ca)\b/.test(n)) return null;
    if (/\b(doi|sua|cap nhat|huy|thay the|hoan doi)\s+(booking|dat cho|dat ban|cho|ban)\b/.test(n)) return null;
    if (/\b(cong thuc|recipe|nguyen lieu|pha che)\b/.test(n)) return null;

    if (/\b(di ung|allergy)\b/.test(n)) {
      return this._r('allergy', `Dạ về dị ứng hoặc sức khỏe, em chưa có thông tin thành phần đầy đủ. Anh/chị vui lòng báo trực tiếp nhân viên hoặc gọi hotline ${KB.store.hotline} nhé.`, 0.95);
    }

    const handlers = [
      ['pickFromContext',  () => LBHandlers.pickFromContext(raw, n)],
      ['editNote',         () => LBHandlers.editNote(raw, n)],
      ['multiOrder',       () => LBHandlers.multiOrder(raw, n)],
      ['medicalRecommend', () => LBHandlers.medicalRecommend(raw, n)],
      ['seatQuery',        () => LBHandlers.seatQuery(raw, n)],
      ['itemQuery',        () => LBHandlers.itemQuery(raw, n)],
      ['drinkRecommend',   () => LBHandlers.drinkRecommend(raw, n)],
    ];
    for (const [name, fn] of handlers) {
      try {
        const result = fn();
        if (result) { result._handler = name; return result; }
      } catch (err) { console.warn(`[LocalBrain.handler.${name}] lỗi:`, err); }
    }
    return null;
  } catch (e) {
    console.warn('[LocalBrain.answer] lỗi toàn cục:', e);
    return null;
  }
};

/* ============================================================ */

const GroupMemory = {
  KEY: 'cappan_group_memory', _cache: null,
  _load() { if (this._cache) return this._cache; try { this._cache = JSON.parse(sessionStorage.getItem(this.KEY) || '{}'); } catch { this._cache = {}; } if (!this._cache.members) this._cache.members = []; if (!this._cache.generalPrefs) this._cache.generalPrefs = []; if (!this._cache.notes) this._cache.notes = []; return this._cache; },
  _save() { try { sessionStorage.setItem(this.KEY, JSON.stringify(this._cache || {})); } catch (e) {} },
  setSize(n) { const d = this._load(); d.size = Math.max(0, Number(n) || 0); this._save(); },
  getSize() { return this._load().size || 0; },
  addMember(name, prefs) { if (!name) return; const d = this._load(); const key = String(name).trim().toLowerCase(); const existing = d.members.find(m => m.name.toLowerCase() === key); if (existing) existing.prefs = [...new Set([...(existing.prefs || []), ...(prefs || [])])]; else d.members.push({ name: String(name).trim(), prefs: prefs || [], addedAt: Date.now() }); this._save(); },
  addGeneralPref(pref) { if (!pref) return; const d = this._load(); if (!d.generalPrefs.includes(pref)) d.generalPrefs.push(pref); this._save(); },
  addNote(note) { if (!note) return; const d = this._load(); if (!d.notes.includes(note)) d.notes.push(note); this._save(); },
  getMembers() { return this._load().members || []; }, getGeneralPrefs() { return this._load().generalPrefs || []; }, getNotes() { return this._load().notes || []; },
  getSummary() { const d = this._load(); return { size: d.size || 0, members: d.members || [], generalPrefs: d.generalPrefs || [], notes: d.notes || [] }; },
  hasData() { const d = this._load(); return (d.size > 0) || (d.members && d.members.length > 0) || (d.generalPrefs && d.generalPrefs.length > 0) || (d.notes && d.notes.length > 0); },
  clear() { this._cache = { members: [], generalPrefs: [], notes: [] }; try { sessionStorage.removeItem(this.KEY); } catch (e) {} },
  formatSummary() { const s = this.getSummary(); if (!s.size && !s.members.length && !s.generalPrefs.length && !s.notes.length) return ''; const parts = []; if (s.size) parts.push(`👥 ${s.size} người`); if (s.members.length) parts.push(`Sở thích riêng:\n${s.members.map(m => `• ${m.name}: ${(m.prefs || []).join(', ')}`).join('\n')}`); if (s.generalPrefs.length) { const countMap = {}; s.generalPrefs.forEach(p => { countMap[p] = (countMap[p] || 0) + 1; }); parts.push(`Sở thích chung: ${Object.entries(countMap).map(([p, c]) => `${c}× ${p}`).join(', ')}`); } if (s.notes.length) parts.push(`Ghi chú: ${s.notes.join('; ')}`); return parts.join('\n'); }
};
window.GroupMemory = GroupMemory;