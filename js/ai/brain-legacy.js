/* ============================================================
   AI BRAIN LEGACY — BỘ NÃO DỰ PHÒNG (RULE-BASED)
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
    } catch (e) {
      return fallback;
    }
  },

  _strict: false,
  tryReply(input) {
    this._strict = true;
    try { return this.reply(input) || null; }
    finally { this._strict = false; }
  },

  reply(input) {
    const text = input.toLowerCase().trim();
    const user = API.users.getCurrent();
    const isStaff = user && user.role === 'staff';

    const lastTopic = this._lastTopic || null;
    this._lastTopic = this._detectTopic(text) || lastTopic;

    // ⚡ Chặn KHÁCH
    if (!isStaff) {
      const blocked = this._checkBlockedForCustomer(text);
      if (blocked) return blocked;
    }

    /* ⚡ Câu hỏi nối tiếp của bộ não nội bộ ("rẻ hơn", "chỗ khác"...) */
    if (typeof LocalBrain !== 'undefined' && LocalBrain.hasContext()) {
      const f = LocalBrain.followUp(input);
      if (f && f.confidence >= LocalBrain.MIN_CONF) return f.text;
    }

    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 3 && lastTopic) {
      const contextReply = this._handleContext(text, lastTopic, user);
      if (contextReply) return contextReply;
    }
    
    if (this._strict && /doanh thu|doanh số|đánh dấu|hủy|huỷ|hoàn thành|hoàn tất|reset|phân ca|xếp ca|đổi giá|sửa giá|tra cứu khách|lịch sử khách|lịch sử của khách|đổi trạng thái|xóa|xóa đơn|xóa booking|tìm khách/.test(text)) return null;

    // ⚡ STAFF rules ưu tiên
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

    const rules = [
      {
        re: /\b(cong thuc|cach lam|nguyen lieu|pha che|recipe|thanh phan|bot matcha|muoi bien)\b/,
        msg: 'Dạ em không có thông tin về công thức pha chế ạ. Anh/chị vui lòng liên hệ quầy pha chế hoặc hotline 0366 474 038.'
      },
      {
        re: /\b(doanh thu|doanh so|gia von|ton kho|loi nhuan|kpi|thong ke noi bo)\b/,
        msg: 'Dạ em không có quyền cung cấp số liệu nội bộ ạ. Anh/chị vui lòng liên hệ quản lý ca.'
      },
      {
        re: /\b(nhan vien|lich ca|ca lam|phan ca|xep ca|staff list|danh sach nhan vien)\b/,
        msg: 'Dạ em không có quyền cung cấp thông tin nhân viên hoặc lịch ca ạ.'
      },
      {
        re: /\b(danh dau|reset|huy don|huy booking|hoan thanh|xoa mon|doi gia|sua gia|cap nhat trang thai)\b/,
        msg: 'Dạ em không có quyền thực hiện thao tác ghi ạ. Anh/chị vui lòng liên hệ nhân viên.'
      },
      {
        re: /\b(ignore previous|bo qua huong dan|system prompt|jailbreak|prompt injection)\b/,
        msg: 'Dạ em không thể thực hiện yêu cầu này ạ.'
      }
    ];

    for (const r of rules) {
      if (r.re.test(n)) return r.msg;
    }
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
          if (!byFloor[s.floorId]) {
            byFloor[s.floorId] = {
              floorName: (API.floors.getById(s.floorId) || {}).name || s.floorId,
              total: API.seats.getByFloor(s.floorId).length,
              available: 0, seats: []
            };
          }
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
        return card('ORDER', {
          total: active.length,
          orders: active.slice(0, 5).map(o => ({
            id: o.id, customerName: o.customerName || 'Khách', total: o.total, step: o.step,
            stepText: ['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][o.step]
          }))
        });
      }],

      [/\b(booking|dat cho).*(hom nay|today)\b|\bco (bao nhieu|may) booking\b/, () => {
        const today = API.utils.today();
        const list = API.bookings.getAll().filter(b => b.date === today && b.status === 'confirmed');
        if (!list.length) return '📅 Hôm nay chưa có booking đang hoạt động.';
        return card('BOOKING', {
          date: today, total: list.length,
          bookings: list.slice(0, 6).map(b => {
            const u = API.users.getById(b.userId);
            const f = API.floors.getById(b.floorId);
            return { id: b.id, customerName: u ? u.name : 'Khách', seatId: b.seatId,
                     floorName: f ? f.name : b.floorId, time: b.time, guests: b.guests, note: b.note };
          })
        });
      }],

      [/\b(doanh thu|revenue)\b.*\b(hom nay|today)\b/, () => {
        return card('KPI', {
          today: { revenue: API.stats.today().total, orders: API.stats.today().count, completedCount: API.stats.today().completedCount, pendingCount: API.stats.today().pendingCount },
          week: API.stats.thisWeek().total, month: API.stats.thisMonth().total,
          status: API.stats.ordersByStatus()
        });
      }],

      [/\b(mon|hang).*(het|out of stock)\b/, () => {
        const oos = API.menu.getOutOfStock();
        if (!oos.length) return '✅ Tất cả các món đều còn hàng.';
        return card('OOS', { count: oos.length, items: oos.map(m => ({ id: m.id, name: m.name })) });
      }]
    ];

    for (const [re, build] of rules) {
      if (re.test(n)) { try { return build(); } catch (e) { return null; } }
    }
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
      const zoneMap = {
        'yên tĩnh': 'quiet', 'học': 'quiet', 'làm việc': 'quiet',
        'cửa sổ': 'window', 'view': 'window',
        'nhóm': 'group', 'họp': 'group',
        'trung tâm': 'center'
      };
      for (const [kw, zone] of Object.entries(zoneMap)) {
        if (text.includes(kw)) return this._replySeatsByZone(zone, kw);
      }
    }

    if (topic === 'menu') {
      const catMap = {
        'cà phê': 'coffee', 'coffee': 'coffee',
        'trà': 'tea', 'tea': 'tea',
        'sinh tố': 'smoothie', 'smoothie': 'smoothie',
        'nước ép': 'juice', 'juice': 'juice',
        'soda': 'soda', 'đá xay': 'soda',
        'khác': 'other'
      };
      for (const [kw, catId] of Object.entries(catMap)) {
        if (text.includes(kw)) return this._replyMenuByCategory(catId);
      }
    }

    return null;
  },

  _replySeatsByZone(zone, zoneName) {
    const filtered = API.seats.getAvailable().filter(s => s.zone === zone);
    if (filtered.length === 0) {
      return `Dạ hiện tại khu vực "${zoneName}" đã hết chỗ. Bạn có muốn thử khu vực khác không?`;
    }
    const list = filtered.map(s =>
      `• ${s.id} (${s.capacity} người) – ${API.floors.getById(s.floorId).name}`
    ).join('\n');
    return `Dạ còn ${filtered.length} chỗ ở khu vực ${zoneName}:\n${list}\n\nBạn vào mục "Đặt chỗ" để chọn nhé!`;
  },

    _replyMenuByCategory(catId) {
    const cat = API.categories.getById(catId);
    if (!cat) return null;
    const items = API.menu.getByCategory(catId);
    
    // ⚡ Trả về thẻ UI_MENU (Tự động có nút "+ Thêm" cho từng món)
    const data = {
      title: `${cat.name} (${items.length} món)`,
      total: items.length,
      items: items.map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge }))
    };
    return `[UI_MENU]${JSON.stringify(data)}[/UI_MENU]`;
  },

  _checkGreeting(text, user) {
    const greetings = ['chào', 'hello', 'hi', 'xin chào', 'alo'];
    if (!greetings.some(g => text.includes(g))) return null;
    if (text.split(' ').length > 4) return null;

    const hour = new Date().getHours();
    let timeGreet = 'Xin chào';
    if (hour < 11) timeGreet = 'Chào buổi sáng';
    else if (hour < 14) timeGreet = 'Chào buổi trưa';
    else if (hour < 18) timeGreet = 'Chào buổi chiều';
    else timeGreet = 'Chào buổi tối';

    if (user) {
      return `${timeGreet} ${user.name}! 👋\nTôi có thể giúp gì cho bạn hôm nay?`;
    }
    return `${timeGreet}! 👋 Tôi là trợ lý ảo CAPPAN.\nBạn có thể hỏi tôi về menu, chỗ ngồi, giờ mở cửa...`;
  },

  _checkLocal(input) {
    if (typeof LocalBrain === 'undefined') return null;
    const r = LocalBrain.answer(input);
    return (r && r.confidence >= LocalBrain.MIN_CONF) ? r.text : null;
  },

  _checkOutOfStock(text) {
    const keys = ['hết', 'còn món', 'còn gì', 'còn không', 'hết hàng'];
    if (!keys.some(k => text.includes(k))) return null;

    const out = API.menu.getOutOfStock();
    const avail = API.menu.getAvailable();

    if (out.length === 0) {
      return `Dạ quán vẫn còn đầy đủ ${avail.length} món ạ! Bạn muốn uống gì?`;
    }

    const list = out.map(m => `• ${m.name}`).join('\n');
    return `Hiện tại quán đã HẾT các món sau:\n${list}\n\nCòn lại ${avail.length} món khác đang phục vụ ạ!`;
  },

  _checkSeats(text) {
    if (/cách.*(đặt|book)|hướng dẫn|làm sao/.test(text)) return null;
    if (/^(còn chỗ không|hết chỗ chưa|còn bàn không|trống không|có chỗ trống không)\??$/.test(text.trim())) return null;

    const zoneOnly = {
      'yên tĩnh': 'quiet', 'cửa sổ': 'window', 'nhóm': 'group', 'trung tâm': 'center'
    };
    const cleanText = text.trim();
    for (const [kw, zone] of Object.entries(zoneOnly)) {
      if (cleanText === kw || cleanText === kw + '?') {
        return this._replySeatsByZone(zone, kw);
      }
    }
    const keys = ['chỗ', 'bàn', 'ngồi', 'trống', 'khu vực'];
    if (!keys.some(k => text.includes(k))) return null;

    this._lastTopic = 'seat';
    const zones = {
      'yên tĩnh': 'quiet', 'học': 'quiet', 'làm việc': 'quiet',
      'cửa sổ': 'window', 'view': 'window', 'đẹp': 'window',
      'nhóm': 'group', 'họp': 'group', 'trung tâm': 'center'
    };
    for (const [kw, zone] of Object.entries(zones)) {
      if (text.includes(kw)) return this._replySeatsByZone(zone, kw);
    }
    const allAvailable = API.seats.getAvailable();
    if (allAvailable.length === 0) return 'Dạ hiện tại quán đã hết chỗ. Bạn thông cảm nhé! 😔';

    const byFloor = {};
    allAvailable.forEach(s => { byFloor[s.floorId] = (byFloor[s.floorId] || 0) + 1; });
    let reply = `Dạ còn tổng cộng ${allAvailable.length} chỗ trống:\n`;
    Object.keys(byFloor).forEach(fId => {
      reply += `• ${API.floors.getById(fId).name}: ${byFloor[fId]} chỗ\n`;
    });
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
    
    // ⚡ Trả về thẻ UI_CATALOG
    const data = {
      totalItems: items.length,
      categories: cats.map(c => {
        const catItems = items.filter(m => m.categoryId === c.id);
        return {
          id: c.id,
          name: c.name,
          count: catItems.length,
          items: catItems.slice(0, 2).map(m => ({ id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge }))
        };
      }).filter(c => c.count > 0)
    };
    return `[UI_CATALOG]${JSON.stringify(data)}[/UI_CATALOG]`;
  },

    _checkPrice(text) {
    // ⚡ Dùng normVN để bỏ dấu, chặn mọi thể loại "mã giảm giá"
    const n = (typeof normVN === 'function') ? normVN(text) : String(text || '').toLowerCase();
    if (/\b(ma giam|khuyen mai|voucher|coupon|ma km|giam gia|sale)\b/.test(n)) return null;

    const keys = ['giá', 'bao nhiêu', 'mắc không', 'đắt không'];
    if (!keys.some(k => n.includes(k) || text.includes(k))) return null;

    const items = API.menu.getAll();
    const min = Math.min(...items.map(i => i.price));
    const max = Math.max(...items.map(i => i.price));

    const found = items.find(i => text.includes(i.name.toLowerCase()));
    if (found) {
      return `${found.name} có giá ${API.utils.formatVND(found.price)} ạ!`;
    }

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

    if (open) {
      return `🕐 Quán đang MỞ CỬA ạ!\nGiờ hoạt động: ${hoursText}.`;
    }
    return `🕐 Hiện tại quán đã ĐÓNG CỬA.\nGiờ hoạt động: ${hoursText}. Hẹn gặp bạn ngày mai!`;
  },

  _checkAddress(text) {
    if (/địa chỉ\s+(giao|nhận|của (tôi|mình|em))/i.test(text)) return null;
    return null;
  },

  _checkWifi(text) {
    return null;
  },

  _checkBookingHelp(text) {
    const howToKeys = ['cách đặt chỗ', 'làm sao đặt', 'đặt chỗ thế nào',
                       'hướng dẫn đặt', 'book chỗ sao', 'đặt bàn thế nào',
                       'cách book', 'làm sao book'];
    if (!howToKeys.some(k => text.includes(k))) return null;

    this._lastTopic = 'booking';
    return `🪑 Để đặt chỗ, bạn làm theo 4 bước:\n1. Vào mục "Đặt chỗ" trên menu\n2. Chọn tầng bạn muốn ngồi\n3. Click vào chỗ màu XANH\n4. Điền thông tin và xác nhận\n\nBạn muốn ngồi tầng nào? (trệt / lầu 1 / lầu 2 / thượng)`;
  },

  _checkOrderHelp(text) {
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
    floors.forEach(f => {
      reply += `• ${f.name} — ${f.description}\n`;
    });
    reply += '\nBạn muốn ngồi tầng nào ạ?';
    return reply;
  },

  _checkParking(text) {
    const keys = ['đậu xe', 'gửi xe', 'parking', 'bãi xe', 'để xe'];
    if (!keys.some(k => text.includes(k))) return null;
    const parking = this._kb('store.policies.parking', 'Miễn phí');
    return `🅿️ CAPPAN có bãi giữ xe ${parking.toLowerCase()} ngay phía sau quán.\nBạn cứ yên tâm mang xe đến nhé!`;
  },

  _checkVegetarian(text) {
    const keys = ['món chay', 'đồ chay', 'ăn chay', 'chay'];
    if (!keys.some(k => text.includes(k))) return null;
    return '🥗 Hiện tại CAPPAN chưa có menu chay riêng, nhưng có một số món phù hợp:\n• Sinh tố Bơ\n• Sinh tố Xoài\n• Nước ép Cam\n• Trà Sen Vàng\n\nBạn muốn thử món nào không ạ?';
  },

  _checkPeakHours(text) {
    const keys = ['đông nhất', 'cao điểm', 'đông khách', 'vắng nhất'];
    if (!keys.some(k => text.includes(k))) return null;
    return '📊 Quán thường ĐÔNG NHẤT vào:\n• 8:00 – 10:00 (giờ đi làm)\n• 14:00 – 16:00 (giờ xế chiều)\n• 19:00 – 21:00 (giờ tối)\n\nNếu bạn muốn yên tĩnh, nên đến lúc 7:00 hoặc sau 16:00 nhé!';
  },

  _checkChangeSeat(text) {
    const keys = ['đổi chỗ', 'đổi bàn', 'thay đổi chỗ', 'chuyển chỗ'];
    if (!keys.some(k => text.includes(k))) return null;
    const hotline = this._kb('store.hotline', '0366 474 038');
    return `🔄 Bạn có thể đổi chỗ bằng cách:\n1. Vào "Tài khoản" → tab "Lịch sử đặt chỗ"\n2. Bấm "Hủy" ở chỗ cũ\n3. Vào "Đặt chỗ" → chọn chỗ mới\n\nHoặc gọi hotline: ${hotline} để được hỗ trợ nhanh nhé!`;
  },

  _checkBulkOrder(text) {
    const keys = ['tiệc', 'sinh nhật', 'sự kiện', 'đặt nhiều', 'số lượng lớn', '20 người', '30 người'];
    if (!keys.some(k => text.includes(k))) return null;
    const hotline = this._kb('store.hotline', '0366 474 038');
    return `🎉 CAPPAN có dịch vụ đặt tiệc riêng!\n\nVới đoàn đông (trên 10 người), bạn vui lòng:\n• Gọi hotline: ${hotline}\n• Hoặc để lại tin nhắn ở mục "Liên hệ"\n\nChúng tôi sẽ tư vấn menu và sắp xếp không gian phù hợp nhất!`;
  },

  _checkFAQ(text) {
    if (typeof KB === 'undefined' || !Array.isArray(KB.faq)) return null;

    let bestMatch = null, bestScore = 0;
    KB.faq.forEach(f => {
      if (!f.keywords) return;
      const score = f.keywords.filter(k => text.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = f;
      }
    });

    if (bestMatch && bestScore >= 1) {
      return bestMatch.answer;
    }
    return null;
  },

    _checkPromotions(text) {
    const n = (typeof normVN === 'function') ? normVN(text) : String(text || '').toLowerCase();
    
    // ⚡ Nhận diện mọi biến thể có dấu hoặc không dấu
    if (!/\b(ma giam|khuyen mai|voucher|coupon|ma km|giam gia|sale)\b/.test(n)) return null;

    const today = API.utils.today();
    const active = API.promotions.getActive(today);
    if (active.length === 0) return 'Dạ hiện tại quán chưa có chương trình khuyến mãi nào ạ.';

    // Tạo dữ liệu để vẽ Thẻ UI_PROMO
    const data = active.map(p => ({
      code: p.code,
      description: p.description || p.name,
      discount: p.discount,
      minOrder: p.minOrder,
      validTo: p.endDate
    }));

    return `[UI_PROMO]${JSON.stringify(data)}[/UI_PROMO]`;
  },

  _checkMyAccount(text, user) {
    const keys = ['tài khoản', 'đơn hàng', 'lịch sử', 'đặt chỗ của tôi'];
    if (!keys.some(k => text.includes(k))) return null;

    if (!user) {
      return '🔒 Bạn cần đăng nhập để xem thông tin tài khoản.\nClick "Đăng nhập" ở góc phải trên nhé!';
    }

    const bookings = API.bookings.getByUser(user.id).filter(b => b.status === 'confirmed');
    const orders = API.orders.getByUser(user.id).filter(o => o.step < 4);

    let reply = `👤 Tài khoản: ${user.name}\n`;
    reply += `📅 Đặt chỗ đang hoạt động: ${bookings.length}\n`;
    reply += `📦 Đơn hàng đang xử lý: ${orders.length}\n\n`;
    reply += 'Vào mục "Tài khoản" để xem chi tiết nhé!';
    return reply;
  },

  _checkThanks(text) {
    const keys = ['cảm ơn', 'thanks', 'thank you', 'cám ơn'];
    if (!keys.some(k => text.includes(k))) return null;

    const replies = [
      '😊 Rất vui được giúp bạn!',
      '🙌 Không có gì ạ! Hẹn gặp bạn tại quán.',
      '☕ Cảm ơn bạn đã quan tâm CAPPAN!',
      '😄 Vui lòng phục vụ bạn!'
    ];
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
      if (score > bestScore) {
        bestScore = score;
        bestMatch = m;
      }
    });

    if (bestMatch && bestScore >= 2) {
      return `Bạn đang hỏi về ${bestMatch.name} phải không? Món này giá ${API.utils.formatVND(bestMatch.price)}. Bạn muốn đặt không?`;
    }

    const catKeywords = {
      'cà phê': 'coffee', 'coffee': 'coffee',
      'trà': 'tea',
      'sinh tố': 'smoothie',
      'nước ép': 'juice',
      'soda': 'soda'
    };
    for (const [kw, catId] of Object.entries(catKeywords)) {
      if (text.includes(kw)) return this._replyMenuByCategory(catId);
    }

    const replies = [
      '🤔 Câu này hơi khó với tôi. Bạn thử hỏi cụ thể hơn nhé!\n\nVí dụ:\n• "Còn chỗ yên tĩnh không?"\n• "Trà đào giá bao nhiêu?"\n• "Cách đặt chỗ thế nào?"',
      '😅 Tôi chưa hiểu rõ. Bạn có thể hỏi về:\n• Menu và giá\n• Chỗ ngồi (yên tĩnh / cửa sổ / nhóm)\n• Giờ mở cửa, địa chỉ, wifi\n• Cách đặt chỗ / đặt nước',
      '🤖 Tôi mới chỉ là trợ lý ảo đơn giản. Bạn thử hỏi:\n• "Menu có gì?"\n• "Còn chỗ không?"\n• "Giờ mở cửa?"'
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }
};



/* ============================================================
   LOCAL BRAIN — bộ não nội bộ (KHÔNG cần key, KHÔNG tốn quota)
============================================================ */

const LB_TAGS = {
  M001: ['cafe', 'cafein', 'tinhtao', 'dang', 'ngot'],
  M002: ['cafe', 'cafein', 'beo', 'ngot'],
  M003: ['cafe', 'cafein', 'beo', 'nong'],
  M004: ['cafe', 'cafein', 'beo', 'nong'],
  M005: ['cafe', 'cafein', 'tinhtao', 'dang', 'nong', 'itngot'],
  M006: ['cafe', 'cafein', 'tinhtao', 'beo', 'dang', 'man'],
  M101: ['cafein', 'traicay', 'chua', 'thanh', 'giainhiet'],
  M102: ['cafein', 'beo', 'dang'],
  M103: ['cafein', 'beo', 'thanh'],
  M104: ['cafein', 'nong', 'ngot', 'thanh'],
  M201: ['traicay', 'beo', 'ngot'],
  M202: ['traicay', 'ngot', 'giainhiet'],
  M203: ['traicay', 'ngot', 'chua', 'giainhiet'],
  M204: ['traicay', 'chua', 'ngot', 'giainhiet'],
  M301: ['traicay', 'chua', 'thanh', 'giainhiet', 'itngot'],
  M302: ['traicay', 'thanh', 'itngot'],
  M303: ['traicay', 'thanh', 'giainhiet', 'itngot'],
  M401: ['chua', 'giainhiet', 'thanh', 'itngot'],
  M402: ['chua', 'traicay', 'giainhiet', 'thanh'],
  M403: ['cafe', 'cafein', 'tinhtao', 'beo', 'ngot', 'giainhiet'],
  M404: ['cafein', 'beo', 'ngot', 'giainhiet'],
  M501: ['cafe', 'cafein', 'chua', 'beo', 'ngot'],
  M502: ['nong', 'beo', 'ngot'],
  M503: ['banh', 'beo', 'ngot']
};

const LB_WORDS = {
  beo: 'béo ngậy', ngot: 'ngọt dịu', dang: 'đậm vị', chua: 'chua thanh', thanh: 'thanh nhẹ',
  traicay: 'trái cây', giainhiet: 'giải nhiệt', tinhtao: 'tỉnh táo', nong: 'dùng nóng',
  itngot: 'ít ngọt', man: 'mặn nhẹ độc đáo'
};

const LocalBrain = {
  MIN_CONF: 0.7,
  ctx: null,                    
  CTX_TTL: 15 * 60 * 1000,

  norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9< ]+/g, ' ').replace(/\s+/g, ' ').trim();
  },

  _tok(s) {
    return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}<]+/gu, ' ').trim().split(' ').filter(Boolean)
      .map(raw => { const norm = this.norm(raw); return { raw, norm, plain: raw === norm }; });
  },

  _lev1(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
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
  _list(arr) { return arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' và ' + arr[arr.length - 1]; },

  GENERIC: new Set(['ca', 'phe', 'tra', 'sinh', 'to', 'nuoc', 'ep', 'soda', 'da', 'xay', 'nong', 'sua']),

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

  _items() {
    return API.menu.getAll().map(m => ({ m, tags: this._tagsOf(m), toks: this._tok(m.name) }));
  },

  _tokMatch(q, t) {
    if (q.raw === t.raw) return true;
    if (!q.plain) return false;
    if (q.norm === t.norm) return true;
    return q.norm.length >= 5 && t.norm.length >= 5 && this._lev1(q.norm, t.norm);
  },

  _findItems(raw) {
    let q = this._tok(raw);
    const all = this._items();
    const out = [];
    let onlyGeneric = true;
    for (let round = 0; round < 3; round++) {
      const scored = [];
      all.forEach(it => {
        if (out.includes(it)) return;
        let overlap = 0, strong = 0;
        it.toks.forEach(t => {
          if (q.some(w => this._tokMatch(w, t))) { overlap++; if (!this.GENERIC.has(t.norm)) strong++; }
        });
        if (strong >= 1 || overlap >= 2) scored.push({ it, overlap, strong });
      });
      if (!scored.length) break;
      const best = Math.max(...scored.map(s => s.overlap));
      const group = scored.filter(s => s.overlap === best);
      group.forEach(g => { out.push(g.it); if (g.strong > 0) onlyGeneric = false; });
      q = q.filter(w => !group.some(g => g.it.toks.some(t => this._tokMatch(w, t))));
      if (out.length >= 6) break;
    }
    out.generic = out.length > 0 && onlyGeneric;
    return out;
  },

  parsePrefs(raw) {
    const rawPlain = !/[^\x00-\x7F]/.test(raw);                      
    let t = this.norm(raw).replace(/sua chua/g, 'suachua');
    const P = { pos: new Set(), neg: new Set(), cats: [], temp: null, maxPrice: null, cheap: false,
                popular: false, fresh: false, noCoffee: false, noCaf: false, dessert: false, desc: [], signals: 0 };
    const take = re => { if (re.test(t)) { t = t.replace(re, ' '); return true; } return false; };
    const sig = (label) => { P.signals++; if (label) P.desc.push(label); };

    if (/đỡ\s+ngọt/.test(raw)) t = t.replace(/\bdo ngot\b/, 'it ngot');
    else t = t.replace(/\bdo ngot\b/g, 'dongot');
    if (/đỡ\s+béo/.test(raw)) t = t.replace(/\bdo beo\b/, 'it beo'); else t = t.replace(/\bdo beo\b/g, 'dobeo');
    if (take(/\b(khong|ko|it|bot|dung|han che)\s+(co\s+|qua\s+|bi\s+|that\s+)?ngot\b|\bngot\s+(it|thoi|vua)\b|\bkhong\s+duong\b/)) { P.neg.add('ngot'); sig('ít ngọt'); }
    if (take(/\b(khong|ko|it|bot|dung)\s+(qua\s+|bi\s+|that\s+)?beo\b/)) { P.neg.add('beo'); sig('không quá béo'); }
    if (/(không|ko|ít|bớt|đỡ)\s+(quá\s+|bị\s+)?đắng/.test(raw) || take(/\b(khong|ko|it|bot)\s+(qua\s+|bi\s+)?dang\b/)) { P.neg.add('dang'); sig('ít đắng'); }
    t = t.replace(/\bdongot\b/g, 'ngot').replace(/\bdobeo\b/g, 'beo');
    if (take(/\b(mat ngu|de ngu|ngu ngon|khong caffeine|khong cafein|ko caffeine|kieng caffeine|tranh caffeine)\b/)) { P.noCaf = true; sig('không caffeine'); }
    if (take(/\b(khong|ko|bo|tranh|kieng|han che|dung)\s+(uong\s+)?(duoc\s+)?(ca phe|cafe|coffee)\b/)) { P.noCoffee = true; sig('không cà phê'); }
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
    if (take(/\b(ban chay|best ?seller|hot|pho bien|nhieu nguoi (uong|goi|thich)|noi bat|signature|ua chuong)\b/)) { P.popular = true; sig('được chọn nhiều'); }
    if (take(/\bmon moi\b|\bmoi ra\b|\bco (gi|mon nao) moi\b|\bdo uong moi\b|\bthuc uong moi\b|\bdoc la\b|\bla mieng\b/)) { P.fresh = true; sig('món mới'); }

    P.cue = /\b(goi y|nen uong|uong gi|mon nao|co mon|muon uong|tu van|de xuat|chon (giup|cho)|recommend|thich|cho minh|uong duoc|nen (goi|chon)|can (mon|uong|nuoc|do)|muon (mon|do|nuoc)|tim (mon|do|nuoc)|co (do|nuoc|mon) nao)\b/.test(this.norm(raw));
    return P;
  },

  _scoreDrinks(P, exclude = []) {
    const items = this._items().filter(x => x.m.inStock && !exclude.includes(x.m.id));
    const maxP = Math.max(1, ...items.map(x => x.m.price));
    const out = [];
    items.forEach(x => {
      const tg = x.tags;
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
      if (P.popular && x.m.badge) s += 3;
      if (P.fresh) { if (/mới/i.test(x.m.badge || '')) s += 6; else return; }
      if (x.m.badge) s += 0.4;
      out.push({ x, s, matched });
    });
    return out.sort((a, b) => b.s - a.s || a.x.m.price - b.x.m.price);
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
    const lines = top.map(r => `• ${r.x.m.name} – ${this._vnd(r.x.m.price)}${this._why(r.x, P) ? ' (' + this._why(r.x, P) + ')' : ''}`);
    const d = this._describe(P);
    const head = intro || (d ? this._pick([
      `Dạ với nhu cầu (${d}), em gợi ý:`,
      `Dạ em chọn giúp anh/chị ${top.length === 1 ? 'món' : top.length + ' món'} hợp nhất với yêu cầu (${d}):`
    ], raw) : `Dạ anh/chị thử ${top.length === 1 ? 'món này' : 'những món này'} nhé:`);
    this.ctx = { kind: 'drink', prefs: P, shown: top.map(r => r.x.m.id), minPrice: Math.min(...top.map(r => r.x.m.price)), ts: Date.now() };
    return `${head}\n${lines.join('\n')}\n\nAnh/chị có thể đặt ở mục "Đặt nước" ạ.`;
  },

  FLOORS: { tret: 'F1', 'lau 1': 'F2', 'lau 2': 'F3', thuong: 'F4' },
  NUMW: { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 },

    parseSeat(raw) {
    const n = this.norm(raw);
    const S = { zone: null, floor: null, size: null, view: false, quiet: false, group: false, outdoor: false,
                projector: false, outlet: false, date: null, time: null, desc: [], signals: 0 };
    const sig = l => { S.signals++; if (l) S.desc.push(l); };

    // ⚡ 1. Nhận diện Ngày
    if (/\b(hom nay|toi nay|chieu nay|sang nay)\b/.test(n)) S.date = 'Hôm nay';
    else if (/\b(ngay mai|toi mai|sang mai|chieu mai)\b/.test(n)) S.date = 'Ngày mai';
    else if (/\b(ngay mot|toi mot)\b/.test(n)) S.date = 'Ngày mốt';
    else if (/\b(thu 2|thu 3|thu 4|thu 5|thu 6|thu 7|chu nhat)\b/.test(n)) S.date = raw.match(/\b(thu 2|thu 3|thu 4|thu 5|thu 6|thu 7|chu nhat)\b/)[0];
    if (/\b(sang|sáng)\b/.test(n)) S.timeOfDay = 'sáng';
    else if (/\b(trua|trưa)\b/.test(n)) S.timeOfDay = 'trưa';
    else if (/\b(chieu|chiều)\b/.test(n)) S.timeOfDay = 'chiều';
    else if (/\b(toi|tối)\b/.test(n)) S.timeOfDay = 'tối';

    // ⚡ 2. Nhận diện Giờ (19:30, 19h, 7 gio toi, 19 30)
    const timeMatch = n.match(/\b(\d{1,2})\s*(?::|h|gio)\s*(\d{2})?\b/) || n.match(/\b(\d{1,2})\s+(\d{2})\b/);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      let m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (/toi|chieu/.test(n) && h < 12) h += 12;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        S.time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }

    // ⚡ 3. Nhận diện Số người & Khu vực
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
      let s = 0;
      const d = this.norm(seat.description || '');
      if (S.quiet) s += (seat.zone === 'quiet' ? 4 : seat.floorId === 'F2' ? 3 : -1);
      if (S.group) s += (seat.zone === 'group' ? 4 : 0);
      if (S.outdoor) s += (seat.floorId === 'F4' ? 4 : -2);
      if (S.view) s += (seat.zone === 'window' ? 3 : 0) + (/view/.test(d) ? 2 : 0);
      if (S.projector) s += (/may chieu/.test(d) ? 5 : -3);
      if (S.size) s -= (seat.capacity - S.size) * 0.6;
      else s -= Math.abs(seat.capacity - 2) * 0.2;
      if (S.quiet && /(o cam|ke sach|goc)/.test(d)) s += 1;
      rows.push({ seat, s });
    });
    return rows.sort((a, b) => b.s - a.s || a.seat.id.localeCompare(b.seat.id, 'vi', { numeric: true }));
  },

  _seatReply(S, raw, exclude = []) {
    if (S.size && S.size > 8) {
      return `Dạ nhóm ${S.size} người em chưa xếp được trực tiếp trên hệ thống (phòng lớn nhất chứa 8 người). Anh/chị gọi hotline ${KB.store.hotline} để quán ghép bàn hoặc tư vấn đặt tiệc riêng nhé.`;
    }
    let rows = this._seatRows(S, exclude);
    const good = rows.filter(r => r.s > -1.5);
    let relaxed = false;
    if (good.length) rows = good; else if (rows.length) relaxed = true;
    if (!rows.length) {
      const total = API.seats.getAvailable().length;
      return `Dạ hiện chưa có chỗ trống khớp ${S.desc.join(', ') || 'yêu cầu'}. ${total ? `Quán còn ${total} chỗ ở khu vực khác, anh/chị xem ở mục "Đặt chỗ" nhé.` : 'Hiện quán đã hết chỗ, anh/chị thông cảm giúp em ạ.'}`;
    }
    const top = rows.slice(0, 3);
    const lines = top.map(r => {
      const f = API.floors.getById(r.seat.floorId);
      return `• Bàn ${r.seat.id} – ${f ? f.name : r.seat.floorId}, ${r.seat.capacity} người${r.seat.description ? ' (' + r.seat.description + ')' : ''}`;
    });
    this.ctx = { kind: 'seat', prefs: S, shown: top.map(r => r.seat.id), ts: Date.now() };
    const need = S.desc.filter(d => typeof d === 'string').join(', ');
    const head = relaxed
      ? `Dạ hiện không còn chỗ trống khớp đầy đủ yêu cầu (${need}). Em gợi ý các chỗ gần nhất, anh/chị cân nhắc nhé:`
      : `Dạ em tìm được ${rows.length} chỗ trống ${need ? 'phù hợp ' + need : 'cho anh/chị'}, gợi ý:`;
    const note = S.outlet ? `\n\nQuán có ổ cắm điện tại mọi bàn ạ.` : '';
    return `${head}\n${lines.join('\n')}${note}\n\nĐây là tình trạng hiện tại. Anh/chị vào mục "Đặt chỗ" để giữ bàn theo ngày giờ mong muốn nhé.`;
  },
    _handleBookingFlow(S, raw) {
    this.bookingDraft = this.bookingDraft || {};
    // Cập nhật thông tin mới nhất vào nháp
    if (S.size) this.bookingDraft.size = S.size;
    if (S.date) this.bookingDraft.date = S.date;
    if (S.time) this.bookingDraft.time = S.time;
    if (S.floor) this.bookingDraft.floor = S.floor;
    if (S.timeOfDay) this.bookingDraft.timeOfDay = S.timeOfDay;
    
    const d = this.bookingDraft;

    // 1. Thiếu Số người
    if (!d.size) {
      return this._r('booking', 'Dạ anh/chị muốn đặt bàn cho bao nhiêu người ạ?', 0.95);
    }

    // 2. Thiếu Ngày
    if (!d.date) {
      return this._r('booking', `Dạ bàn cho ${d.size} người. Anh/chị muốn đặt vào ngày nào ạ? (VD: hôm nay, ngày mai, thứ 7...)`, 0.95);
    }

    // 3. Thiếu Giờ (Trường hợp phổ biến nhất)
        if (!d.time) {
      // ⚡ Gợi ý giờ thông minh dựa trên buổi khách đã chọn
      let timeHint = "(VD: 19:30, 8h tối...)"; // Mặc định là tối
      if (d.timeOfDay === 'sáng') timeHint = "(VD: 08:00, 9h sáng...)";
      else if (d.timeOfDay === 'trưa') timeHint = "(VD: 11:30, 12h trưa...)";
      else if (d.timeOfDay === 'chiều') timeHint = "(VD: 14:00, 3h chiều...)";
      
      return this._r('booking', `Dạ đặt bàn ${d.size} người vào ${d.date.toLowerCase()}. Anh/chị dự định đến lúc mấy giờ ạ? ${timeHint}`, 0.95);
    }

    // 4. Đã đủ thông tin -> Chốt đơn
    const S_full = { ...S, size: d.size, date: d.date, time: d.time, floor: d.floor };
    this.bookingDraft = null; // Xóa nháp
    
    // Gọi logic tìm bàn
    let rows = this._seatRows(S_full);
    if (!rows.length) {
      return this._r('seat', `Dạ hiện tại chưa có bàn nào trống cho ${d.size} người vào lúc ${d.time} ${d.date.toLowerCase()} ạ. Anh/chị thông cảm!`, 0.9);
    }

    const top = rows.slice(0, 3);
    const lines = top.map(r => {
      const f = API.floors.getById(r.seat.floorId);
      return `• Bàn ${r.seat.id} – ${f ? f.name : r.seat.floorId}, ${r.seat.capacity} người`;
    });

    this.ctx = { kind: 'seat', prefs: S_full, shown: top.map(r => r.seat.id), ts: Date.now() };
    
    const summary = `Dạ em đã ghi nhận đặt bàn **${d.size} người** vào **${d.time} ${d.date.toLowerCase()}**. Đây là các gợi ý cho anh/chị:`;
    const note = `\n\n💡 Lưu ý: Hệ thống của em chỉ đang xem chỗ trống hiện tại. Để chắc chắn giữ bàn cho ${d.date.toLowerCase()}, anh/chị hãy bấm vào nút "Đặt chỗ ngay" bên dưới nhé!`;
    
    return this._r('seat', `${summary}\n${lines.join('\n')}${note}`, 0.95);
  },

    answer(input, opts = {}) {
    try {
      const raw = String(input || '').trim();
      if (!raw || raw.length > 300) return null;
      const n = this.norm(raw);

      // ⚡ NẾU ĐANG TRONG LUỒNG HỎI ĐÁP ĐẶT BÀN (Đã có nháp)
      if (this.bookingDraft) {
        const isCancelling = /\b(huy|thoi|khong can|reset)\b/.test(n);
        if (isCancelling) {
          this.bookingDraft = null;
          return this._r('cancel', 'Dạ em đã hủy yêu cầu đặt bàn. Anh/chị cần hỗ trợ gì khác không?', 0.95);
        }

        const S_new = this.parseSeat(raw);
        // Nếu câu trả lời chứa thông tin mới (số người, giờ, ngày) -> Cập nhật tiếp
        if (S_new.size || S_new.time || S_new.date) {
          return this._handleBookingFlow(S_new, raw);
        }
        
        // Nếu user nói câu gì đó lan man, có thể họ đổi ý. 
        // Ta kiểm tra xem câu này có rơi vào intent khác không, nếu không thì nhắc lại.
        // Nhưng để đơn giản, ta cứ nhắc họ trả lời câu hỏi.
        if (n.split(' ').length <= 3) {
          const d = this.bookingDraft;
          const missing = !d.size ? 'số người' : !d.date ? 'ngày' : 'giờ';
          return this._r('booking', `Dạ em vẫn đang chờ thông tin **${missing}** để đặt bàn cho anh/chị ạ.`, 0.9);
        } else {
          this.bookingDraft = null; // Reset nếu user hỏi vấn đề khác
        }
      }

      // Các câu hỏi bị cấm
      if (/\b(cach|huong dan|lam sao|the nao)\b.*\b(dat|book|thanh toan|dang ky|dang nhap)\b/.test(n)) return null;
      if (/\b(cong thuc|cach lam|nguyen lieu|pha che|ton kho|gia von|doanh thu|don hang|nhan vien|lich ca|booking)\b/.test(n)) return null;
      if (/\b(dau xe|do xe|gui xe|bai xe|bai do|parking|xe may|o to|mat khau|tai khoan|dang nhap|dang ky)\b/.test(n)) return null;

      if (/\b(di ung|allergy|allergic|tieu duong|dai thao duong|mang thai|co thai|huyet ap|benh)\b/.test(n)) {
        return this._r('allergy', `Dạ về dị ứng hoặc tình trạng sức khỏe, em chưa có thông tin thành phần đầy đủ để khẳng định món nào an toàn ạ. Anh/chị vui lòng báo trực tiếp với nhân viên tại quầy hoặc gọi hotline ${KB.store.hotline} để được kiểm tra kỹ nhé.`, 0.95);
      }

      const fu = this.followUp(raw);
      if (fu) return fu;

      if (/\b(re|dat) nhat\b|\bgia (thap|cao) nhat\b/.test(n)) return this._extreme(raw, n);

      const found = this._findItems(raw);

      if (found.length >= 2 && found.length <= 3 && !found.generic && /\b(so sanh|khac (gi|nhau)|hay la|hay|vs|nen chon|va|voi)\b/.test(n)) {
        return this._compare(found);
      }

      if (found.length && /\b(gia|bao nhieu|nhieu tien|bao tien|may k|nghin|gia sao|gia ca)\b/.test(n)) return this._price(found, n, raw);

      if (found.length && !found.generic && /\b(con (hang|khong|mon|ko)|het (chua|hang|roi|khong)|co (ban|khong|ko))\b/.test(n)) return this._stock(found);
      if (found.length && !found.generic && /\b(la gi|co gi|vi (the nao|ra sao|gi)|ngon (khong|ko)|nhu the nao|mo ta|nhu nao)\b/.test(n)) return this._info(found);

      // =========================================================================
      // ⚡ LUỒNG ĐẶT BÀN (BOOKING INTENT)
      // =========================================================================
      const isBookingIntent = /\b(dat ban|dat cho|book ban|book cho|giu ban|giu cho)\b/.test(n);
      const seatCue = /\b(cho (ngoi|nao|tot|dep|yen|trong)|con cho|ngoi (dau|o)|co (cho|ban)|ban nao|phong (hop|nhom)|khu (nao|vuc)|dat cho|tim cho|can cho|muon ngoi|cho (de |hoc|lam))\b/.test(n)
        || (/\b(cho|ban|phong)\b/.test(n) && /\b(nguoi|yen tinh|view|ngoai troi|cua so|may chieu)\b/.test(n));
      
      if (isBookingIntent || (seatCue || (found.length === 0 && /\b(o cam|ngoai troi|san thuong|chup anh)\b/.test(n) && !/\buong\b/.test(n)))) {
        const S = this.parseSeat(raw);
        
        // Nếu là lệnh đặt bàn -> Đi vào luồng hỏi đáp
        if (isBookingIntent) {
          return this._handleBookingFlow(S, raw);
        }

        // Nếu chỉ hỏi tình trạng chỗ thông thường
        if (S.signals === 0 && !/\bcon cho\b|\bcon ban\b|\bco cho\b/.test(n)) return null;
        if (S.signals === 0) return this._r('seat', this._seatOverview(), 0.8);
        if (S.outlet && !S.quiet && !S.view && !S.group && !S.outdoor && S.signals === 0) return null;
        return this._r('seat', this._seatReply(S, raw), 0.85);
      }

      if (/\bco o cam\b|\bo cam (khong|ko)\b|\bsac (dien thoai|laptop|pin)\b/.test(n)) {
        return this._r('outlet', `Dạ quán có ổ cắm điện tại mọi bàn, anh/chị yên tâm sạc laptop hoặc điện thoại ạ.`, 0.85);
      }

      const P = this.parsePrefs(raw);
      const generic = /\b(goi y|nen uong|uong gi|mon nao ngon|mon ngon|nen goi|nen chon)\b/.test(n)
        || (/\b(tu van|de xuat|chon giup|chon cho)\b/.test(n) && /\b(uong|mon|nuoc|do uong|thuc uong|ly)\b/.test(n));
      if (P.signals === 0 && !generic) return null;
      if (P.signals === 0 && generic) {
        const rows = this._scoreDrinks({ ...P, popular: true });
        if (!rows.length) return null;
        return this._r('drink', this._drinkReply(P, rows, raw, 'Dạ đây là những món được nhiều khách chọn ạ:') + `\nNếu anh/chị cho em biết thích vị gì (béo, chua, ít ngọt...), em chọn kỹ hơn nhé.`, 0.7);
      }

      let rows = this._scoreDrinks(P);
      if (!rows.length) {
        const relaxed = { ...P, maxPrice: null, cheap: false, popular: false };
        const r2 = this._scoreDrinks(relaxed);
        if (P.maxPrice && r2.length) {
          const cheapest = r2.slice().sort((a, b) => a.x.m.price - b.x.m.price)[0];
          return this._r('drink', `Dạ hiện chưa có món khớp ${this._describe(P)}. Món gần nhất là ${cheapest.x.m.name} giá ${this._vnd(cheapest.x.m.price)} ạ.`, 0.75);
        }
        return this._r('drink', `Dạ em chưa tìm thấy món khớp hoàn toàn ${this._describe(P)}. Anh/chị cho em biết thêm khẩu vị (béo, chua, ít ngọt, nóng/lạnh...) để em chọn lại nhé.`, 0.5);
      }
      const conf = P.cue ? (P.signals >= 2 ? 0.9 : 0.85) : (P.signals >= 2 ? 0.8 : 0.6);
      return this._r('drink', this._drinkReply(P, rows, raw), conf);
    } catch (e) {
      console.warn('[LocalBrain] lỗi, bỏ qua:', e);
      return null;
    }
  },

  _r(intent, text, confidence) { return { intent, text, confidence }; },

  hasContext() { return !!(this.ctx && Date.now() - this.ctx.ts < this.CTX_TTL); },
  reset() { this.ctx = null; },

  _extreme(raw, n) {
    const cheap = /\bre nhat\b|\bthap nhat\b/.test(n);
    const P = this.parsePrefs(raw);
    P.cheap = false; P.popular = false;
    let rows = this._items().filter(x => x.m.inStock && (!P.cats.length || P.cats.includes(x.m.categoryId)) && (!P.noCoffee || !x.tags.includes('cafe')));
    if (!/\b(banh|flan|an vat)\b/.test(n)) rows = rows.filter(x => !x.tags.includes('banh'));
    rows.sort((a, b) => cheap ? a.m.price - b.m.price : b.m.price - a.m.price);
    if (!rows.length) return null;
    const top = rows.slice(0, 3);
    this.ctx = { kind: 'drink', prefs: P, shown: top.map(r => r.m.id), minPrice: Math.min(...top.map(r => r.m.price)), ts: Date.now() };
    return this._r('extreme', `Dạ ${cheap ? 'các món giá mềm nhất' : 'các món giá cao nhất'} hiện nay:\n${top.map(r => `• ${r.m.name} – ${this._vnd(r.m.price)}`).join('\n')}`, 0.9);
  },

  _compare(items) {
    const a = items[0], b = items[1];
    const wa = a.tags.filter(k => LB_WORDS[k]).slice(0, 3).map(k => LB_WORDS[k]).join(', ') || 'đang cập nhật';
    const wb = b.tags.filter(k => LB_WORDS[k]).slice(0, 3).map(k => LB_WORDS[k]).join(', ') || 'đang cập nhật';
    const diff = a.m.price - b.m.price;
    const cmp = diff === 0 ? 'Hai món cùng giá.' : `${diff > 0 ? b.m.name : a.m.name} rẻ hơn ${this._vnd(Math.abs(diff))}.`;
    return this._r('compare', `Dạ em so sánh giúp anh/chị:\n• ${a.m.name} – ${this._vnd(a.m.price)} (${wa})\n• ${b.m.name} – ${this._vnd(b.m.price)} (${wb})\n\n${cmp}`, 0.9);
  },

  _price(items, n, raw) {
    if (items.generic || items.length > 4) {
      const P = this.parsePrefs(raw || '');
      const cats = P.cats.length ? P.cats : [...new Set(items.map(i => i.m.categoryId))];
      if (cats.length === 1) {
        const ps = this._items().filter(i => i.m.categoryId === cats[0] && i.m.inStock).map(i => i.m.price);
        const c = API.categories.getById(cats[0]);
        if (ps.length) return this._r('price', `Dạ nhóm ${c ? c.name.replace(/^\S+\s/, '') : 'này'} có giá từ ${this._vnd(Math.min(...ps))} đến ${this._vnd(Math.max(...ps))} ạ. Anh/chị muốn em gợi ý món cụ thể không?`, 0.8);
      }
      return null;
    }
    const lines = items.map(i => `• ${i.m.name} – ${this._vnd(i.m.price)}${i.m.inStock ? '' : ' (tạm hết hàng)'}`);
    this.ctx = { kind: 'drink', prefs: this.parsePrefs(''), shown: items.map(i => i.m.id), minPrice: Math.min(...items.map(i => i.m.price)), ts: Date.now() };
    return this._r('price', `Dạ giá như sau ạ:\n${lines.join('\n')}`, 0.9);
  },

  _stock(items) {
    const lines = items.slice(0, 4).map(i => `• ${i.m.name}: ${i.m.inStock ? 'còn hàng' : 'tạm hết hàng'}`);
    return this._r('stock', `Dạ tình trạng hiện tại:\n${lines.join('\n')}`, 0.9);
  },

  _info(items) {
    const lines = items.slice(0, 3).map(i => {
      const w = i.tags.filter(k => LB_WORDS[k]).slice(0, 3).map(k => LB_WORDS[k]).join(', ');
      return `• ${i.m.name} – ${this._vnd(i.m.price)}${i.m.description ? '. ' + i.m.description : ''}${w ? ' (vị ' + w + ')' : ''}`;
    });
    return this._r('info', `Dạ em giới thiệu ạ:\n${lines.join('\n')}`, 0.85);
  },

  _seatOverview() {
    const avail = API.seats.getAvailable();
    if (!avail.length) return 'Dạ hiện quán đã hết chỗ, anh/chị thông cảm giúp em ạ.';
    const by = {};
    avail.forEach(s => { by[s.floorId] = (by[s.floorId] || 0) + 1; });
    const lines = Object.keys(by).map(f => `• ${API.floors.getById(f).name}: ${by[f]} chỗ`);
    return `Dạ hiện còn ${avail.length} chỗ trống:\n${lines.join('\n')}\n\nAnh/chị cho em biết cần yên tĩnh, họp nhóm hay có view, em gợi ý bàn cụ thể nhé.`;
  },

  followUp(raw) {
    if (!this.hasContext()) return null;
    const n = this.norm(raw);
    if (n.split(' ').length > 10) return null;
    const c = this.ctx;

    if (c.kind === 'drink') {
      const P = { ...c.prefs, pos: new Set(c.prefs.pos), neg: new Set(c.prefs.neg), signals: c.prefs.signals };
      let exclude = [], changed = false;
      if (/\bre hon\b|\bre nua\b|\bgia thap hon\b|\bit tien hon\b/.test(n)) { P.maxPrice = c.minPrice - 1000; changed = true; }
      else if (/\bngot hon\b/.test(n)) { P.pos.add('ngot'); P.neg.delete('ngot'); exclude = c.shown; changed = true; }
      else if (/\b(it ngot hon|bot ngot)\b/.test(n)) { P.neg.add('ngot'); P.pos.delete('ngot'); exclude = c.shown; changed = true; }
      else if (/\b(dam hon|manh hon)\b/.test(n)) { P.pos.add('tinhtao'); exclude = c.shown; changed = true; }
      else if (/\bnhe hon\b/.test(n)) { P.pos.add('thanh'); exclude = c.shown; changed = true; }
      else if (/\bbeo hon\b/.test(n)) { P.pos.add('beo'); exclude = c.shown; changed = true; }
      else if (/\bkhac\b|\bnua\b|\bcon (mon|cai|gi)\b|\bgoi y them\b/.test(n)) { exclude = c.shown; changed = true; }
      if (!changed) return null;
      const rows = this._scoreDrinks(P, exclude);
      if (!rows.length) {
        return this._r('followup', P.maxPrice && /\bre\b/.test(n)
          ? `Dạ hiện chưa có món nào rẻ hơn ${this._vnd(c.minPrice)} khớp yêu cầu của anh/chị ạ.`
          : `Dạ em chưa tìm thêm được món nào khớp nữa ạ. Anh/chị thử nới yêu cầu giúp em nhé.`, 0.8);
      }
      return this._r('followup', this._drinkReply(P, rows, raw, 'Dạ em gợi ý thêm ạ:'), 0.85);
    }

    if (c.kind === 'seat') {
      const S = { ...c.prefs };
      let exclude = [];
      if (/\bkhac\b|\bnua\b|\bcon (cho|ban)\b/.test(n)) exclude = c.shown;
      else if (/\b(tang|lau) khac\b/.test(n)) {
        exclude = API.seats.getAll().filter(s => c.shown.some(id => (API.seats.getById(id) || {}).floorId === s.floorId)).map(s => s.id);
      }
      else if (/\b(\d{1,2}) nguoi\b/.test(n)) { S.size = parseInt(n.match(/\b(\d{1,2}) nguoi\b/)[1], 10); }
      else return null;
      return this._r('followup', this._seatReply(S, raw, exclude), 0.85);
    }
    return null;
  }
};