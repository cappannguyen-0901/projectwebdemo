/* ============================================================
   AI BRAIN LEGACY — BỘ NÃO DỰ PHÒNG (RULE-BASED)
   Dùng khi LLM (brain.js) lỗi/timeout
   - Đọc KB tập trung
   - Có rule FAQ + Promotions
   - Có _checkStaffQueries cho staff
============================================================ */

const AIBrainLegacy = {

  _lastTopic: null,

  /* ----------------------------------------------------------
     HELPER — đọc KB an toàn
  ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     HÀM CHÍNH
  ---------------------------------------------------------- */
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

    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 3 && lastTopic) {
      const contextReply = this._handleContext(text, lastTopic, user);
      if (contextReply) return contextReply;
    }

    // ⚡ STAFF rules ưu tiên
    if (isStaff) {
      const staffReply = this._checkStaffQueries(text);
      if (staffReply) return staffReply;
    }

    return this._checkBookingHelp(text)
        || this._checkOrderHelp(text)
        || this._checkGreeting(text, user)
        || this._checkOutOfStock(text)
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

  /* ----------------------------------------------------------
     CHẶN KHÁCH
  ---------------------------------------------------------- */
  _checkBlockedForCustomer(text) {
    const recipeKeys = [
      'công thức', 'recipe', 'cách làm', 'cách pha', 'pha chế',
      'nguyên liệu', 'tỉ lệ', 'định lượng', 'bí quyết', 'bí mật'
    ];
    const drinkKeywords = [
      'cà phê', 'trà', 'sinh tố', 'smoothie', 'nước ép', 'soda',
      'matcha', 'latte', 'espresso', 'cappuccino', 'bạc xỉu',
      'mocha', 'frappe', 'đá xay', 'trà sữa', 'trà đào'
    ];
    if (recipeKeys.some(k => text.includes(k)) &&
        drinkKeywords.some(k => text.includes(k))) {
      return `Dạ em không có thông tin về công thức ạ, anh/chị vui lòng liên hệ quầy pha chế hoặc hotline ${this._kb('store.hotline', '0366 474 038')} để được hỗ trợ.`;
    }

    const internalKeys = [
      'nhân viên', 'lịch ca', 'ca làm', 'phân ca', 'dashboard',
      'doanh thu', 'lợi nhuận', 'tồn kho', 'giá vốn',
      'staff', 'admin', 'quản lý menu', 'thống kê'
    ];
    if (internalKeys.some(k => text.includes(k))) {
      return `Dạ thông tin này em không có ạ. Anh/chị vui lòng liên hệ hotline ${this._kb('store.hotline', '0366 474 038')} để được hỗ trợ.`;
    }

    return null;
  },

  /* ----------------------------------------------------------
     PHÁT HIỆN CHỦ ĐỀ
  ---------------------------------------------------------- */
  _detectTopic(text) {
    if (/chỗ|bàn|ngồi|khu vực/.test(text)) return 'seat';
    if (/menu|thực đơn|đồ uống|món/.test(text)) return 'menu';
    if (/đặt chỗ|đặt bàn/.test(text)) return 'booking';
    if (/đặt nước|order|giao hàng/.test(text)) return 'order';
    if (/giá|bao nhiêu/.test(text)) return 'price';
    return null;
  },

  /* ----------------------------------------------------------
     XỬ LÝ CÂU NGẮN THEO CONTEXT
  ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     TRẢ LỜI CHỖ THEO ZONE
  ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     TRẢ LỜI MENU THEO NHÓM
  ---------------------------------------------------------- */
  _replyMenuByCategory(catId) {
    const cat = API.categories.getById(catId);
    if (!cat) return null;
    const items = API.menu.getByCategory(catId);
    const list = items.map(m => `• ${m.name} – ${API.utils.formatVND(m.price)}`).join('\n');
    return `${cat.name} có ${items.length} món:\n${list}`;
  },

  /* ============================================================
     ⚡ STAFF QUERIES — chỉ match khi role=staff
  ============================================================ */
  _checkStaffQueries(text) {
    /* 1. CÔNG THỨC — ưu tiên cao nhất */
    const recipeMatch = text.match(/(?:công thức|cách làm|cách pha|recipe)\s+(.+)/);
    if (recipeMatch) {
      let drinkName = recipeMatch[1].trim().replace(/\?+$/, '').trim();
      const items = API.menu.getAll();

      // Exact match
      let item = items.find(m => m.name.toLowerCase() === drinkName.toLowerCase());
      // Includes
      if (!item) item = items.find(m => m.name.toLowerCase().includes(drinkName.toLowerCase()));
      // Ngược lại
      if (!item) {
        item = items.find(m => drinkName.toLowerCase().includes(m.name.toLowerCase()));
      }
      // Fuzzy theo từ
      if (!item) {
        const words = drinkName.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
        let bestMatch = null, bestScore = 0;
        items.forEach(m => {
          const nameLower = m.name.toLowerCase();
          const score = words.filter(w => nameLower.includes(w)).length;
          if (score > bestScore) { bestScore = score; bestMatch = m; }
        });
        if (bestScore >= 2) item = bestMatch;
      }

      if (!item) {
        return `Dạ em không tìm thấy món "${drinkName}". Anh/chị thử lại với tên khác nhé.`;
      }

      if (typeof SEED_RECIPES !== 'undefined' && SEED_RECIPES[item.id]) {
        const r = SEED_RECIPES[item.id];
        return `📖 Công thức ${item.name} (${r.size || 'chuẩn'}):\n\n` +
               `🥄 Nguyên liệu:\n${r.ingredients.map(i => '• ' + i).join('\n')}\n\n` +
               `👨‍🍳 Cách làm:\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` +
               (r.note ? `\n\n💡 Ghi chú: ${r.note}` : '');
      }
      return `Dạ món "${item.name}" chưa có dữ liệu công thức.`;
    }

    /* 2. CA LÀM VIỆC */
    if (/ca\s*(sáng|chiều|tối)|ca làm|shift|các ca/.test(text)) {
      const shifts = API.shifts.getAll();
      const list = shifts.map(s => `• ${s.name}: ${s.start} – ${s.end}`).join('\n');
      return `⏰ Quán có ${shifts.length} ca:\n${list}`;
    }

    /* 3. NHÂN VIÊN */
    if (/danh sách nhân viên|nhân viên quán|list nhân viên|nhân viên gồm/.test(text)) {
      const staff = API.staff.getAll();
      const list = staff.map(s => `• ${s.name} (${s.role})`).join('\n');
      return `📋 Quán có ${staff.length} nhân viên:\n${list}`;
    }

    /* 4. ĐƠN ĐANG XỬ LÝ */
    if (/đơn đang xử lý|đơn chưa xong|đơn nào đang|order đang/.test(text)) {
      const orders = API.orders.getAll().filter(o => o.step < 4);
      if (orders.length === 0) return `✅ Hiện không có đơn nào đang xử lý.`;
      const list = orders.map(o =>
        `• #${o.id} — ${o.customerName || 'Khách'} — ${API.utils.formatVND(o.total)} (bước ${o.step + 1}/5)`
      ).join('\n');
      return `📦 Có ${orders.length} đơn đang xử lý:\n${list}`;
    }

    /* 5. BOOKING HÔM NAY */
    if (/booking hôm nay|đặt chỗ hôm nay|booking nào/.test(text)) {
      const today = API.utils.today();
      const bookings = API.bookings.getAll()
        .filter(b => b.date === today && b.status === 'confirmed');
      if (bookings.length === 0) return `✅ Hôm nay chưa có booking nào.`;
      const list = bookings.map(b => {
        const u = API.users.getById(b.userId);
        const floor = API.floors.getById(b.floorId);
        return `• ${b.id} — ${u ? u.name : 'Khách'} — ${b.seatId} (${floor ? floor.name : b.floorId}) — ${b.time}`;
      }).join('\n');
      return `🪑 Hôm nay có ${bookings.length} booking:\n${list}`;
    }

    /* 6. CHỖ TRỐNG */
    if (/còn bao nhiêu chỗ|chỗ trống|tình trạng chỗ/.test(text)) {
      const available = API.seats.getAvailable();
      const total = API.seats.getAll().length;
      return `🪑 Còn ${available.length}/${total} chỗ trống trên toàn quán.`;
    }

    return null;
  },

  /* ============================================================
     1. CHÀO HỎI
  ============================================================ */
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

  /* ============================================================
     2. MÓN HẾT HÀNG
  ============================================================ */
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

  /* ============================================================
     3. CHỖ NGỒI
  ============================================================ */
  _checkSeats(text) {
    if (/cách.*(đặt|book)|hướng dẫn|làm sao/.test(text)) return null;
    // ⚡ Nếu câu CHỈ có 1 từ zone keyword → match luôn
  const zoneOnly = {
    'yên tĩnh': 'quiet',
    'cửa sổ': 'window',
    'nhóm': 'group',
    'trung tâm': 'center'
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
      'nhóm': 'group', 'họp': 'group',
      'trung tâm': 'center'
    };

    for (const [kw, zone] of Object.entries(zones)) {
      if (text.includes(kw)) return this._replySeatsByZone(zone, kw);
    }

    const allAvailable = API.seats.getAvailable();
    if (allAvailable.length === 0) {
      return 'Dạ hiện tại quán đã hết chỗ. Bạn thông cảm nhé! 😔';
    }

    const byFloor = {};
    allAvailable.forEach(s => {
      if (!byFloor[s.floorId]) byFloor[s.floorId] = 0;
      byFloor[s.floorId]++;
    });

    let reply = `Dạ còn tổng cộng ${allAvailable.length} chỗ trống:\n`;
    Object.keys(byFloor).forEach(fId => {
      const floor = API.floors.getById(fId);
      reply += `• ${floor.name}: ${byFloor[fId]} chỗ\n`;
    });

    reply += '\nBạn muốn ngồi khu vực nào? (yên tĩnh / cửa sổ / nhóm / ngoài trời)';
    return reply;
  },

  /* ============================================================
     4. MENU
  ============================================================ */
  _checkMenu(text) {
    const keys = ['menu', 'thực đơn', 'có gì', 'đồ uống', 'uống gì', 'món gì'];
    if (!keys.some(k => text.includes(k))) return null;

    this._lastTopic = 'menu';

    const cats = API.categories.getAll();
    const total = API.menu.getAll().length;

    let reply = `Dạ CAPPAN có ${total} món chia làm ${cats.length} nhóm:\n`;
    cats.forEach(c => {
      const count = API.menu.getByCategory(c.id).length;
      reply += `• ${c.name} (${count} món)\n`;
    });
    reply += '\nBạn muốn uống nhóm nào ạ?';
    return reply;
  },

  /* ============================================================
     5. GIÁ CẢ
  ============================================================ */
  _checkPrice(text) {
    const keys = ['giá', 'bao nhiêu', 'mắc không', 'đắt không'];
    if (!keys.some(k => text.includes(k))) return null;

    const items = API.menu.getAll();
    const min = Math.min(...items.map(i => i.price));
    const max = Math.max(...items.map(i => i.price));

    const found = items.find(i => text.includes(i.name.toLowerCase()));
    if (found) {
      return `${found.name} có giá ${API.utils.formatVND(found.price)} ạ!`;
    }

    return `Dạ đồ uống CAPPAN dao động từ ${API.utils.formatVND(min)} đến ${API.utils.formatVND(max)}. Bạn muốn hỏi giá món nào cụ thể không?`;
  },

  /* ============================================================
     6. GIỜ MỞ CỬA
  ============================================================ */
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

  /* ============================================================
     7. ĐỊA CHỈ
  ============================================================ */
  _checkAddress(text) {
    const keys = ['địa chỉ', 'ở đâu', 'đường nào', 'chỗ nào', 'vị trí'];
    if (!keys.some(k => text.includes(k))) return null;
    const address = this._kb('store.address', 'Công viên Gia Định, Q. Gò Vấp');
    return `📍 CAPPAN ở ${address}.\nBạn có thể xem bản đồ ở trang "Liên hệ" nhé!`;
  },

  /* ============================================================
     8. WIFI
  ============================================================ */
  _checkWifi(text) {
    if (!text.includes('wifi') && !text.includes('mật khẩu')) return null;
    const name = this._kb('store.wifi.name', 'CAPPAN_Free');
    const pass = this._kb('store.wifi.password', 'cappannguyen');
    return `📶 Wifi miễn phí cho khách:\n• Tên: ${name}\n• Mật khẩu: ${pass}`;
  },

  /* ============================================================
     9. HƯỚNG DẪN ĐẶT CHỖ
  ============================================================ */
  _checkBookingHelp(text) {
    const howToKeys = ['cách đặt chỗ', 'làm sao đặt', 'đặt chỗ thế nào',
                       'hướng dẫn đặt', 'book chỗ sao', 'đặt bàn thế nào',
                       'cách book', 'làm sao book'];
    if (!howToKeys.some(k => text.includes(k))) return null;

    this._lastTopic = 'booking';
    return `🪑 Để đặt chỗ, bạn làm theo 4 bước:\n1. Vào mục "Đặt chỗ" trên menu\n2. Chọn tầng bạn muốn ngồi\n3. Click vào chỗ màu XANH\n4. Điền thông tin và xác nhận\n\nBạn muốn ngồi tầng nào? (trệt / lầu 1 / lầu 2 / thượng)`;
  },

  /* ============================================================
     10. HƯỚNG DẪN ĐẶT NƯỚC
  ============================================================ */
  _checkOrderHelp(text) {
    const keys = ['đặt nước', 'đặt món', 'order', 'giao hàng', 'ship'];
    if (!keys.some(k => text.includes(k))) return null;

    this._lastTopic = 'order';
    return `🥤 Để đặt nước, bạn làm theo 4 bước:\n1. Vào mục "Đặt nước"\n2. Chọn món → "+ Thêm vào giỏ"\n3. Vào "Giỏ hàng" để kiểm tra\n4. Điền địa chỉ → "Đặt hàng ngay"\n\nSau đó bạn có thể theo dõi shipper ở mục "Theo dõi đơn" nhé!`;
  },

  /* ============================================================
     11. CÁC TẦNG
  ============================================================ */
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

  /* ============================================================
     12. BÃI ĐẬU XE
  ============================================================ */
  _checkParking(text) {
    const keys = ['đậu xe', 'gửi xe', 'parking', 'bãi xe', 'để xe'];
    if (!keys.some(k => text.includes(k))) return null;
    const parking = this._kb('store.policies.parking', 'Miễn phí');
    return `🅿️ CAPPAN có bãi giữ xe ${parking.toLowerCase()} ngay phía sau quán.\nBạn cứ yên tâm mang xe đến nhé!`;
  },

  /* ============================================================
     13. MÓN CHAY
  ============================================================ */
  _checkVegetarian(text) {
    const keys = ['món chay', 'đồ chay', 'ăn chay', 'chay'];
    if (!keys.some(k => text.includes(k))) return null;
    return '🥗 Hiện tại CAPPAN chưa có menu chay riêng, nhưng có một số món phù hợp:\n• Sinh tố Bơ\n• Sinh tố Xoài\n• Nước ép Cam\n• Trà Sen Vàng\n\nBạn muốn thử món nào không ạ?';
  },

  /* ============================================================
     14. GIỜ CAO ĐIỂM
  ============================================================ */
  _checkPeakHours(text) {
    const keys = ['đông nhất', 'cao điểm', 'đông khách', 'vắng nhất'];
    if (!keys.some(k => text.includes(k))) return null;
    return '📊 Quán thường ĐÔNG NHẤT vào:\n• 8:00 – 10:00 (giờ đi làm)\n• 14:00 – 16:00 (giờ xế chiều)\n• 19:00 – 21:00 (giờ tối)\n\nNếu bạn muốn yên tĩnh, nên đến lúc 7:00 hoặc sau 16:00 nhé!';
  },

  /* ============================================================
     15. ĐỔI CHỖ
  ============================================================ */
  _checkChangeSeat(text) {
    const keys = ['đổi chỗ', 'đổi bàn', 'thay đổi chỗ', 'chuyển chỗ'];
    if (!keys.some(k => text.includes(k))) return null;
    const hotline = this._kb('store.hotline', '0366 474 038');
    return `🔄 Bạn có thể đổi chỗ bằng cách:\n1. Vào "Tài khoản" → tab "Lịch sử đặt chỗ"\n2. Bấm "Hủy" ở chỗ cũ\n3. Vào "Đặt chỗ" → chọn chỗ mới\n\nHoặc gọi hotline: ${hotline} để được hỗ trợ nhanh nhé!`;
  },

  /* ============================================================
     16. ĐẶT TIỆC
  ============================================================ */
  _checkBulkOrder(text) {
    const keys = ['tiệc', 'sinh nhật', 'sự kiện', 'đặt nhiều', 'số lượng lớn', '20 người', '30 người'];
    if (!keys.some(k => text.includes(k))) return null;
    const hotline = this._kb('store.hotline', '0366 474 038');
    return `🎉 CAPPAN có dịch vụ đặt tiệc riêng!\n\nVới đoàn đông (trên 10 người), bạn vui lòng:\n• Gọi hotline: ${hotline}\n• Hoặc để lại tin nhắn ở mục "Liên hệ"\n\nChúng tôi sẽ tư vấn menu và sắp xếp không gian phù hợp nhất!`;
  },

  /* ============================================================
     17. FAQ (từ KB)
  ============================================================ */
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

  /* ============================================================
     18. PROMOTIONS (từ KB)
  ============================================================ */
  _checkPromotions(text) {
    const keys = ['khuyến mãi', 'giảm giá', 'mã giảm', 'voucher', 'promo', 'coupon'];
    if (!keys.some(k => text.includes(k))) return null;

    if (typeof SEED_PROMOTIONS === 'undefined') {
      return 'Dạ hiện tại quán chưa có chương trình khuyến mãi ạ.';
    }

    const active = SEED_PROMOTIONS.filter(p => p.active);
    if (active.length === 0) {
      return 'Dạ hiện tại quán chưa có khuyến mãi ạ.';
    }

    const list = active.map(p =>
      `• ${p.code} — ${p.description}`
    ).join('\n');

    return `🎁 CAPPAN đang có ${active.length} mã khuyến mãi:\n${list}`;
  },

  /* ============================================================
     19. TÀI KHOẢN
  ============================================================ */
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

  /* ============================================================
     20. CẢM ƠN
  ============================================================ */
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

  /* ============================================================
     21. FALLBACK — không nhầm món
  ============================================================ */
  _fallback(text) {
    const items = API.menu.getAll();

    // ⚡ Tìm món theo điểm số khớp từ
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

    // Chỉ match nếu >= 2 từ khớp
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