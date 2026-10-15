/* ============================================================
   AI BRAIN v3.4 — TRỢ LÝ CAPPAN (FINAL CLEAN)
   - Stream + tool_calls trong CÙNG 1 API call
   - SSE parser chuẩn (event boundary \n\n)
   - Multi-key + Multi-model với retry logic
   - Cache thông minh (chỉ data tĩnh)
   - Đọc KB tập trung
   - Fallback: LLM lỗi → AIBrainLegacy
============================================================ */

/* ============================================================
   1. AI CONFIG — MULTI-KEY + MULTI-MODEL
============================================================ */

const AI_KEYS = [
  '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',  // Key còn quota
  'gsk_37bCrnsjWchutcoQ31lLWGdyb3FYioBSpglvPH2ov65qvzCqeLinN',  // Key chưa dùng
  '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'   // Key đã hết
];

const AI_MODELS = [
  { name: 'openai/gpt-oss-20b',     maxTokens: 400 },
  { name: 'openai/gpt-oss-120b',    maxTokens: 300 },
  { name: 'qwen/qwen3.8-27b',       maxTokens: 300 }
];

const AI_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  temperature: 0.4,
  timeoutMs: 15000,

  _keyIndex: 0,
  _modelIndex: 0,

  getCurrentKey() {
    return AI_KEYS[this._keyIndex % AI_KEYS.length];
  },

  getCurrentModel() {
    return AI_MODELS[this._modelIndex % AI_MODELS.length];
  },

  rotateKey() {
    this._keyIndex = (this._keyIndex + 1) % AI_KEYS.length;
  },

  rotateModel() {
    this._modelIndex = (this._modelIndex + 1) % AI_MODELS.length;
  },

  reset() {
    this._keyIndex = 0;
    this._modelIndex = 0;
  }
};

/* ============================================================
   2. CACHE THÔNG MINH — CHỈ CACHE DATA TĨNH
============================================================ */

const STATIC_PATTERNS = [
  'wifi', 'mật khẩu', 'địa chỉ', 'ở đâu', 'đường',
  'giờ mở cửa', 'mấy giờ', 'đóng cửa', 'hotline', 'điện thoại',
  'email', 'đậu xe', 'gửi xe', 'bãi xe', 'parking', 'tiện ích',
  'app', 'ứng dụng', 'tuyển dụng', 'xin việc',
  'chủ quán', 'sáng lập', 'thành lập', 'chi nhánh',
  'chay', 'ăn chay', 'giao hàng', 'ship',
  'thú cưng', 'pet', 'hút thuốc', 'thuốc lá',
  'đặt tiệc', 'sinh nhật', 'sự kiện'
];

function isCacheable(input) {
  const text = input.toLowerCase().trim();
  return STATIC_PATTERNS.some(p => text.includes(p));
}

const ResponseCache = {
  STORAGE_KEY: 'cappan_ai_cache',
  TTL: 24 * 60 * 60 * 1000,

  _load() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
    } catch { return {}; }
  },

  _save(cache) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('[Cache] Không lưu được:', e);
    }
  },

  _normalize(input) {
    return input.toLowerCase().trim().replace(/\s+/g, ' ');
  },

  _hashKey(input, role) {
    return `${role}::${this._normalize(input)}`;
  },

  get(input, role) {
    const cache = this._load();
    const key = this._hashKey(input, role);
    const entry = cache[key];

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.TTL) {
      delete cache[key];
      this._save(cache);
      return null;
    }

    console.log(`📦 Cache HIT: "${input.slice(0, 40)}..."`);
    return entry.response;
  },

  set(input, role, response) {
    const cache = this._load();
    const key = this._hashKey(input, role);

    cache[key] = {
      response,
      timestamp: Date.now()
    };

    this._save(cache);
  },

  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ Cache đã xóa');
  },

  size() {
    return Object.keys(this._load()).length;
  }
};

/* ============================================================
   3. HELPER — Đọc KB an toàn
============================================================ */

function kbGet(path, fallback = '') {
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
}

/* ============================================================
   4. AI_CONFIRM_TOOLS
============================================================ */

const AI_CONFIRM_TOOLS = [
  'mark_out_of_stock',
  'mark_in_stock',
  'reset_seats_by_floor',
  'reset_all_seats',
  'cancel_order',
  'complete_order',
  'cancel_booking',
  'complete_booking'
];

/* ============================================================
   5. SYSTEM PROMPTS
============================================================ */

const AI_PROMPTS = {
  staff: `Bạn là "CAPPAN Assistant" — trợ lý nội bộ quán cà phê CAPPAN. Hỗ trợ NHÂN VIÊN trong ca.

BIẾT: chỗ ngồi realtime, đơn hàng, booking, nhân viên, ca làm việc, công thức pha chế, tồn kho.
QUYỀN GHI (cần xác nhận): đánh dấu hết hàng, reset chỗ, hủy đơn/booking, đánh dấu hoàn thành.

⚡ QUY TẮC BẮT BUỘC:
1. Câu hỏi dữ liệu (chỗ, đơn, booking, nhân viên) → LUÔN gọi tool. KHÔNG bịa số.
2. Câu hỏi CÔNG THỨC (VD: "công thức cà phê sữa đá") → BẮT BUỘC gọi tool get_recipe. KHÔNG nhầm món. KHÔNG bịa.
3. Câu hỏi CA LÀM (VD: "ca sáng mấy giờ") → BẮT BUỘC gọi tool get_shift_schedule.
   KHÔNG trả lời giờ mở cửa quán (đó là câu hỏi khác).
4. Câu hỏi WIFI/ĐỊA CHỈ/GIỜ/HOTLINE → gọi get_store_info.
5. Hành động ghi → gọi tool, hệ thống sẽ hỏi xác nhận.
6. TUYỆT ĐỐI KHÔNG trả lời rỗng. Nếu không có dữ liệu → nói rõ "em không có thông tin".

⚡ QUY TẮC ĐẶC BIỆT:
- Khi NV hỏi "menu X" / "món X" → gọi tool "search_menu"
- Khi NV hỏi "công thức X" / "cách làm X" → gọi tool "get_recipe"
- Khi NV hỏi món hot / bán chạy → gọi "get_menu", lọc món có "badge"
- Khi NV hỏi so sánh 2 món → gọi "get_menu", so sánh giá + mô tả
- Khi NV hỏi ĐƠN / BOOKING mà tool trả hasOrders:false → "Hiện tại không có đơn/booking nào"

Phong cách: ngắn gọn, xưng "em" gọi "anh/chị".
ĐỊNH DẠNG: KHÔNG Markdown. Danh sách dùng "•". Xuống dòng rõ. Tối đa 3-4 dòng/đoạn.`,

  customer: `Bạn là "CAPPAN Bot" — nhân viên phục vụ ảo của quán cà phê CAPPAN.
Bạn đang trò chuyện với KHÁCH HÀNG.

Bạn CHỈ ĐƯỢC PHÉP:
- Giới thiệu menu, giá, mô tả món
- Tư vấn chọn món
- Cho biết chỗ TRỐNG cụ thể: mã bàn, khu vực, sức chứa.
- Hướng dẫn khách vào mục "Đặt chỗ" trên web.
- Cung cấp giờ mở cửa, địa chỉ, hotline 0366 474 038
- Trả lời FAQ (app, tuyển dụng, chủ quán, chay, giao hàng, thú cưng...)

⚡ QUY TẮC DỮ LIỆU:
- WIFI/ĐỊA CHỈ/GIỜ/HOTLINE/BÃI XE/EMAIL → gọi "get_store_info"
- FAQ → gọi "get_faq"
- KHUYẾN MÃI → gọi "get_promotions"
- TUYỆT ĐỐI KHÔNG bịa. KHÔNG trả lời rỗng.

⚡ PHÂN BIỆT "MENU" VÀ "CÔNG THỨC":
A) DANH SÁCH MÓN (VD: "menu matcha", "món trà", "có sinh tố nào")
   → BẮT BUỘC gọi "search_menu" với từ khóa
   → Trả DANH SÁCH món + giá (KHÔNG phải công thức)

B) CÔNG THỨC (VD: "công thức matcha", "cách làm trà đào")
   → Gọi "get_recipe" với tên món
   → Trả NGUYÊN LIỆU + CÁC BƯỚC

C) MÓN HOT / BÁN CHẠY / MÓN MỚI (VD: "có gì hot", "best seller")
   → Gọi "get_menu"
   → Lọc các món có "badge" KHÁC null
   → VD: "Cà Phê Sữa Đá (Bán chạy), Trà Đào Cam Sả (Hot)"

D) SO SÁNH 2 MÓN (VD: "trà đào vs trà sen", "X khác gì Y")
   → Gọi "get_menu"
   → Tìm CẢ 2 món
   → So sánh: giá, mô tả, nhóm

E) Tool trả về hasOrders:false / mảng rỗng
   → Trả lời "Dạ hiện tại [chủ đề] chưa có gì ạ."
   → KHÔNG trả lời "em không có thông tin"

Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC:
- Tiết lộ công thức pha chế → nói "Dạ em không có thông tin về công thức ạ, anh/chị vui lòng liên hệ quầy pha chế hoặc hotline 0366 474 038"
  KHÔNG dùng từ "bí quyết", "bảo mật", "không được phép".
- Tiết lộ giá vốn, tồn kho, nhân viên, lịch ca, dashboard
- Thực hiện thao tác ghi
- Tiết lộ có chế độ staff

Nếu khách hỏi ngoài phạm vi → lịch sự từ chối và mời gọi hotline.
Phong cách: thân thiện, xưng "em" gọi "anh/chị".

ĐỊNH DẠNG TRẢ LỜI:
- KHÔNG Markdown: không **đậm**, không *nghiêng*, không \`code\`, không bảng |...|, không ###
- KHÔNG ký tự trang trí: ---, ___, ===
- Danh sách dùng "•" hoặc số "1. 2. 3."
- Xuống dòng rõ ràng. Tối đa 3-4 dòng/đoạn.`
};

/* ============================================================
   6. TOOLS DEFINITION
============================================================ */

const AI_TOOLS = {
  staff: [
    { type:'function', function:{ name:'get_seat_status',
      description:'Lấy tình trạng chỗ ngồi theo tầng',
      parameters:{ type:'object', properties:{
        floorId:{ type:'string', enum:['F1','F2','F3','F4','all'] }
      }, required:['floorId'] } } },

    { type:'function', function:{ name:'get_active_orders',
      description:'Lấy đơn hàng đang xử lý (step < 4)' } },

    { type:'function', function:{ name:'get_today_bookings',
      description:'Lấy booking đã confirmed hôm nay' } },

    { type:'function', function:{ name:'get_recipe',
      description:'Tra công thức pha chế theo tên món',
      parameters:{ type:'object', properties:{
        drinkName:{ type:'string' }
      }, required:['drinkName'] } } },

    { type:'function', function:{ name:'get_staff_list',
      description:'Danh sách nhân viên quán' } },

    { type:'function', function:{ name:'get_shift_schedule',
      description:'Lịch phân ca làm việc' } },

    { type:'function', function:{ name:'mark_out_of_stock',
      description:'Đánh dấu một món đã hết hàng',
      parameters:{ type:'object', properties:{
        itemId:{ type:'string', description:'Mã món, ví dụ M001' }
      }, required:['itemId'] } } },

    { type:'function', function:{ name:'mark_in_stock',
      description:'Đánh dấu một món đã CÒN HÀNG trở lại',
      parameters:{ type:'object', properties:{
        itemId:{ type:'string', description:'Mã món, ví dụ M001' }
      }, required:['itemId'] } } },

    { type:'function', function:{ name:'reset_seats_by_floor',
      description:'Reset toàn bộ chỗ ngồi của MỘT tầng về trạng thái trống.',
      parameters:{ type:'object', properties:{
        floorId:{ type:'string', enum:['F1','F2','F3','F4'] }
      }, required:['floorId'] } } },

    { type:'function', function:{ name:'reset_all_seats',
      description:'Reset TOÀN BỘ chỗ ngồi của quán về trạng thái trống.' } },

    { type:'function', function:{ name:'cancel_order',
      description:'Hủy một đơn hàng theo mã đơn',
      parameters:{ type:'object', properties:{
        orderId:{ type:'string', description:'Mã đơn, ví dụ OD1234' }
      }, required:['orderId'] } } },

    { type:'function', function:{ name:'complete_order',
      description:'Đánh dấu một đơn hàng đã giao xong (step = 4)',
      parameters:{ type:'object', properties:{
        orderId:{ type:'string' }
      }, required:['orderId'] } } },

    { type:'function', function:{ name:'cancel_booking',
      description:'Hủy một booking đặt chỗ theo mã booking',
      parameters:{ type:'object', properties:{
        bookingId:{ type:'string', description:'Mã booking, ví dụ BK1234' }
      }, required:['bookingId'] } } },

    { type:'function', function:{ name:'complete_booking',
      description:'Đánh dấu một booking đã hoàn thành',
      parameters:{ type:'object', properties:{
        bookingId:{ type:'string' }
      }, required:['bookingId'] } } },

    { type:'function', function:{ name:'get_faq',
      description:'Tìm câu trả lời FAQ theo câu hỏi',
      parameters:{ type:'object', properties:{
        query:{ type:'string' }
      }, required:['query'] } } },

    { type:'function', function:{ name:'get_promotions',
      description:'Lấy danh sách mã khuyến mãi đang có hiệu lực' } },

    { type:'function', function:{ name:'search_menu',
      description:'TÌM MÓN theo từ khóa trong TÊN món. Trả về DANH SÁCH món (KHÔNG phải công thức).',
      parameters:{ type:'object', properties:{
        keyword:{ type:'string', description:'VD: matcha, trà, sinh tố' }
      }, required:['keyword'] } } },

    /* --- BỔ SUNG QUẢN LÝ DOANH THU & ĐƠN HÀNG --- */
    { 
      type: 'function', 
      function: { 
        name: 'get_revenue_stats',
        description: 'Lấy thống kê doanh thu hôm nay, tuần này, tháng này và tổng số đơn hàng' 
      } 
    },
    { 
      type: 'function', 
      function: { 
        name: 'get_all_orders',
        description: 'Lấy danh sách tất cả đơn hàng trong hệ thống (cả đang xử lý lẫn đã hoàn thành/hủy)' 
      } 
    },
    { 
      type: 'function', 
      function: { 
        name: 'release_single_seat',
        description: 'Giải phóng / reset một chỗ ngồi đơn lẻ về trạng thái trống (ví dụ reset bàn B8)',
        parameters: { 
          type: 'object', 
          properties: {
            seatId: { type: 'string', description: 'Mã ghế, ví dụ B8, A1' }
          }, 
          required: ['seatId'] 
        } 
      } 
    },
    { 
      type: 'function', 
      function: { 
        name: 'get_out_of_stock_items',
        description: 'Lấy danh sách các món hiện đang HẾT HÀNG trong menu' 
      } 
    },
    { 
      type: 'function', 
      function: { 
        name: 'assign_staff_to_shift',
        description: 'Xếp một nhân viên vào ca làm việc trong ngày',
        parameters: { 
          type: 'object', 
          properties: {
            date: { type: 'string', description: 'Ngày định dạng YYYY-MM-DD, ví dụ 2026-10-15' },
            shiftId: { type: 'string', enum: ['morning', 'afternoon', 'evening'], description: 'Mã ca: morning, afternoon, hoặc evening' },
            staffId: { type: 'string', description: 'Mã nhân viên, ví dụ S001' }
          }, 
          required: ['date', 'shiftId', 'staffId'] 
        } 
      } 
    },
    { 
      type: 'function', 
      function: { 
        name: 'search_customer_history',
        description: 'Tra cứu thông tin khách hàng, lịch sử đặt chỗ và đơn hàng theo số điện thoại hoặc tên',
        parameters: { 
          type: 'object', 
          properties: {
            keyword: { type: 'string', description: 'Số điện thoại hoặc tên khách hàng cần tìm' }
          }, 
          required: ['keyword'] 
        } 
      } 
    }
  ],

  customer: [
    { type:'function', function:{ name:'get_menu',
      description:'Lấy menu đầy đủ: tên món, giá, nhóm, còn hàng' } },

    { type:'function', function:{ name:'get_seat_status',
      description:'Lấy tình trạng chỗ ngồi theo tầng. Trả về danh sách chỗ TRỐNG.',
      parameters:{ type:'object', properties:{
        floorId:{ type:'string', enum:['F1','F2','F3','F4','all'] },
        zone:{ type:'string', enum:['window','center','quiet','group','any'] },
        minCapacity:{ type:'number' }
      }, required:['floorId'] } } },

    { type:'function', function:{ name:'check_availability',
      description:'Kiểm tra quán còn chỗ hay hết. CHỈ trả true/false' } },

    { type:'function', function:{ name:'get_store_info',
      description:'Lấy thông tin quán: giờ, địa chỉ, hotline, WIFI, bãi xe, email. LUÔN gọi khi khách hỏi wifi, địa chỉ, giờ, hotline, đậu xe.' } },

    { type:'function', function:{ name:'get_faq',
      description:'Trả lời FAQ: app, tuyển dụng, chủ quán, chi nhánh, món chay, giao hàng, thú cưng, hút thuốc...',
      parameters:{ type:'object', properties:{
        query:{ type:'string' }
      }, required:['query'] } } },

    { type:'function', function:{ name:'get_promotions',
      description:'Lấy mã khuyến mãi đang có hiệu lực' } },

    { type:'function', function:{ name:'search_menu',
      description:'TÌM MÓN theo từ khóa trong TÊN món. Trả về DANH SÁCH món (KHÔNG phải công thức).',
      parameters:{ type:'object', properties:{
        keyword:{ type:'string', description:'VD: matcha, trà, sinh tố' }
      }, required:['keyword'] } } }
  ]
};

/* ============================================================
   7. TOOL EXECUTOR
============================================================ */

const AIToolExecutor = {
  async run(toolName, args, role) {
    const allowed = AI_TOOLS[role].map(t => t.function.name);
    if (!allowed.includes(toolName)) {
      return { error: `Tool "${toolName}" không được phép cho role "${role}"` };
    }

    if (typeof AI_CONFIRM_TOOLS !== 'undefined' && AI_CONFIRM_TOOLS.includes(toolName)) {
      console.log(`[AUDIT] ${new Date().toLocaleString('vi-VN')} — role=${role} — tool=${toolName}`, args);
    }

    try {
      switch (toolName) {
        /* ---------- THỐNG KÊ DOANH THU & ĐƠN HÀNG ---------- */
        case 'get_revenue_stats': {
          const today = API.stats.today();
          const week = API.stats.thisWeek();
          const month = API.stats.thisMonth();
          const statusCounts = API.stats.ordersByStatus();
          return {
            todayRevenue: today.total,
            todayOrdersCount: today.count,
            weekRevenue: week.total,
            monthRevenue: month.total,
            ordersStatus: statusCounts
          };
        }

        case 'get_all_orders': {
          const allOrders = API.orders.getAll();
          if (allOrders.length === 0) {
            return { hasOrders: false, message: 'Không có đơn hàng nào trong hệ thống.' };
          }
          return {
            hasOrders: true,
            totalCount: allOrders.length,
            orders: allOrders.map(o => ({
              id: o.id,
              customerName: o.customerName || 'Khách',
              total: o.total,
              status: o.status,
              step: o.step,
              createdAt: o.createdAt,
              items: o.items.map(i => `${i.name} x${i.qty}`)
            }))
          };
        }

        case 'release_single_seat': {
          const seatId = (args.seatId || '').toUpperCase().trim();
          const seat = API.seats.getById(seatId);
          if (!seat) {
            return { error: `Không tìm thấy ghế có mã "${seatId}" trong quán.` };
          }
          API.seats.release(seatId);
          API.seats.syncFromBookings();
          return { ok: true, seatId: seat.id, floorId: seat.floorId, message: `Đã reset ghế ${seat.id} về trạng thái trống.` };
        }

        case 'get_out_of_stock_items': {
          const outItems = API.menu.getOutOfStock();
          if (outItems.length === 0) {
            return { hasOut: false, message: 'Hiện tại tất cả các món trong menu đều còn hàng.' };
          }
          return {
            hasOut: true,
            count: outItems.length,
            items: outItems.map(m => ({ id: m.id, name: m.name, categoryId: m.categoryId }))
          };
        }

        case 'assign_staff_to_shift': {
          const { date, shiftId, staffId } = args;
          if (!date || !shiftId || !staffId) {
            return { error: 'Thiếu thông tin ngày, mã ca hoặc mã nhân viên.' };
          }
          const staff = API.staff.getById(staffId);
          if (!staff) return { error: `Không tìm thấy nhân viên có mã ${staffId}` };

          const success = API.shifts.addStaffToShift(date, shiftId, staffId);
          if (!success) {
            return { ok: false, message: `Nhân viên ${staff.name} (${staffId}) đã có trong ca này rồi.` };
          }
          return { 
            ok: true, 
            message: `Đã xếp nhân viên ${staff.name} vào ca ${shiftId} ngày ${date} thành công.` 
          };
        }

        case 'search_customer_history': {
          const kw = (args.keyword || '').toLowerCase().trim();
          if (!kw) return { error: 'Thiếu từ khóa tìm kiếm khách hàng.' };

          const users = API.users.getAll().filter(u => 
            u.role === 'customer' && (u.name.toLowerCase().includes(kw) || u.phone.includes(kw))
          );

          if (users.length === 0) {
            return { found: 0, message: `Không tìm thấy khách hàng nào khớp với "${kw}".` };
          }

          const results = users.map(u => {
            const bookings = API.bookings.getByUser(u.id);
            const orders = API.orders.getByUser(u.id);
            return {
              userId: u.id,
              name: u.name,
              phone: u.phone,
              noShowCount: u.noShowCount || 0,
              totalBookings: bookings.length,
              totalOrders: orders.length,
              recentBookings: bookings.slice(-3),
              recentOrders: orders.slice(-3)
            };
          });

          return { found: results.length, customers: results };
        }

        /* ---------- CÁC TOOLS CŨ ---------- */
        case 'get_seat_status': {
          const floorId = args.floorId || 'all';
          let seats = floorId === 'all'
            ? API.seats.getAll()
            : API.seats.getByFloor(floorId);

          if (args.zone && args.zone !== 'any') {
            seats = seats.filter(s => s.zone === args.zone);
          }
          if (args.minCapacity) {
            seats = seats.filter(s => s.capacity >= args.minCapacity);
          }

          const byFloor = {};
          seats.forEach(s => {
            if (!byFloor[s.floorId]) byFloor[s.floorId] = { total:0, available:0, seats:[] };
            byFloor[s.floorId].total++;
            if (s.status === 'available') {
              byFloor[s.floorId].available++;
              byFloor[s.floorId].seats.push({
                id: s.id, zone: s.zone, capacity: s.capacity, description: s.description
              });
            }
          });
          Object.keys(byFloor).forEach(fId => {
            const f = API.floors.getById(fId);
            byFloor[fId].floorName = f ? f.name : fId;
          });
          return byFloor;
        }

        case 'get_active_orders': {
          const orders = API.orders.getAll().filter(o => o.step < 4);
          if (orders.length === 0) {
            return {
              hasOrders: false,
              message: 'Hiện tại KHÔNG có đơn hàng nào đang xử lý. Tất cả đơn đã hoàn thành.'
            };
          }
          return {
            hasOrders: true,
            count: orders.length,
            orders: orders.map(o => ({
              id: o.id,
              customerName: o.customerName,
              total: o.total,
              status: o.status,
              step: o.step,
              stepText: ['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][o.step] || 'Không rõ',
              items: o.items.map(i => `${i.name} x${i.qty}`)
            }))
          };
        }

        case 'get_today_bookings': {
          const today = API.utils.today();
          const bookings = API.bookings.getAll()
            .filter(b => b.date === today && b.status === 'confirmed');

          if (bookings.length === 0) {
            return {
              hasBookings: false,
              message: 'Hôm nay CHƯA có booking nào đang hoạt động.'
            };
          }

          return {
            hasBookings: true,
            count: bookings.length,
            date: today,
            bookings: bookings.map(b => {
              const u = API.users.getById(b.userId);
              const floor = API.floors.getById(b.floorId);
              return {
                id: b.id,
                customerName: u ? u.name : 'Khách',
                seatId: b.seatId,
                floorName: floor ? floor.name : b.floorId,
                time: b.time,
                guests: b.guests,
                note: b.note
              };
            })
          };
        }

        case 'get_recipe': {
          const item = API.menu.getAll().find(m =>
            m.name.toLowerCase().includes(args.drinkName.toLowerCase())
          );
          if (!item) return { error: `Không tìm thấy món "${args.drinkName}"` };

          const recipe = (typeof SEED_RECIPES !== 'undefined' && SEED_RECIPES[item.id])
            || item.recipe || null;

          if (!recipe) {
            return { name: item.name, note: 'Chưa có dữ liệu công thức.' };
          }
          return { itemId: item.id, name: item.name, price: item.price, recipe };
        }

        case 'get_staff_list':
          return API.staff.getAll().map(s => ({ id:s.id, name:s.name, role:s.role }));

        case 'get_shift_schedule': {
          const shifts = API.shifts.getAll().map(s => ({
            id: s.id,
            name: s.name,
            start: s.start,
            end: s.end,
            timeRange: `${s.start} – ${s.end}`
          }));

          return {
            shifts: shifts,
            totalShifts: shifts.length,
            schedule: API.shifts.getSchedule()
          };
        }

        case 'mark_out_of_stock': {
          const item = API.menu.markOutOfStock(args.itemId);
          if (!item) return { error: `Không tìm thấy món ${args.itemId}` };
          return { ok:true, itemId:item.id, name:item.name };
        }

        case 'mark_in_stock': {
          const item = API.menu.markInStock(args.itemId);
          if (!item) return { error: `Không tìm thấy món ${args.itemId}` };
          return { ok: true, itemId: item.id, name: item.name, newStatus: 'in_stock' };
        }

        case 'reset_seats_by_floor': {
          API.seats.releaseByFloor(args.floorId);
          API.seats.syncFromBookings();
          const floor = API.floors.getById(args.floorId);
          const count = SEED_SEATS.filter(s => s.floorId === args.floorId).length;
          return { ok: true, floorId: args.floorId,
                   floorName: floor ? floor.name : args.floorId, releasedSeats: count };
        }

        case 'reset_all_seats': {
          API.seats.releaseAll();
          API.seats.syncFromBookings();
          return { ok: true, totalSeats: SEED_SEATS.length };
        }

        case 'cancel_order': {
          const order = API.orders.getById(args.orderId);
          if (!order) return { error: `Không tìm thấy đơn ${args.orderId}` };
          if (order.status === 'cancelled') return { error: `Đơn đã bị hủy trước đó` };

          const list = API.orders.getAll();
          const idx = list.findIndex(o => o.id === args.orderId);
          list[idx].status = 'cancelled';
          localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(list));
          return { ok: true, orderId: args.orderId };
        }

        case 'complete_order': {
          const order = API.orders.getById(args.orderId);
          if (!order) return { error: `Không tìm thấy đơn ${args.orderId}` };
          if (order.step >= 4) return { error: `Đơn đã hoàn thành trước đó` };
          API.orders.updateStep(args.orderId, 4);
          return { ok: true, orderId: args.orderId };
        }

        case 'cancel_booking': {
          const bk = API.bookings.getAll().find(b => b.id === args.bookingId);
          if (!bk) return { error: `Không tìm thấy booking ${args.bookingId}` };
          if (bk.status === 'cancelled') return { error: `Booking đã bị hủy trước đó` };
          API.bookings.cancel(args.bookingId);
          return { ok: true, bookingId: args.bookingId, seatId: bk.seatId };
        }

        case 'complete_booking': {
          const bk = API.bookings.getAll().find(b => b.id === args.bookingId);
          if (!bk) return { error: `Không tìm thấy booking ${args.bookingId}` };
          if (bk.status === 'completed') return { error: `Booking đã hoàn thành trước đó` };
          API.bookings.complete(args.bookingId);
          return { ok: true, bookingId: args.bookingId, seatId: bk.seatId };
        }

        case 'get_menu': {
          const cats = API.categories.getAll();
          const items = API.menu.getAll();
          return {
            categories: cats.map(c => ({
              id: c.id,
              name: c.name,
              items: items.filter(m => m.categoryId === c.id)
                .map(m => ({
                  name: m.name,
                  price: m.price,
                  inStock: m.inStock,
                  badge: m.badge || null,
                  description: m.description || ''
                }))
            }))
          };
        }

        case 'search_menu': {
          const kw = (args.keyword || '').toLowerCase().trim();
          if (!kw) return { error: 'Thiếu từ khóa tìm kiếm' };

          const items = API.menu.getAll();
          const cats = API.categories.getAll();

          const matchedCat = cats.find(c =>
            c.id.toLowerCase().includes(kw) ||
            c.name.toLowerCase().includes(kw)
          );

          let found = [];
          let searchType = '';

          if (matchedCat) {
            found = items.filter(m => m.categoryId === matchedCat.id);
            searchType = `category:${matchedCat.name}`;
          } else {
            found = items.filter(m => m.name.toLowerCase().includes(kw));
            searchType = `name:${kw}`;
          }

          if (found.length === 0) {
            found = items.filter(m => m.name.toLowerCase().includes(kw));
            searchType = `name-fallback:${kw}`;
          }

          if (found.length === 0) {
            return {
              found: 0,
              keyword: kw,
              message: `Không tìm thấy món nào có "${kw}" trong tên hoặc nhóm.`
            };
          }

          return {
            found: found.length,
            keyword: kw,
            searchType: searchType,
            items: found.map(m => ({
              id: m.id,
              name: m.name,
              price: m.price,
              inStock: m.inStock,
              badge: m.badge || null,
              categoryId: m.categoryId
            }))
          };
        }

        case 'check_availability':
          return { hasAvailable: API.seats.getAvailable().length > 0 };

        case 'get_store_info':
          return {
            name: typeof kbGet === 'function' ? kbGet('store.name', 'CAPPAN') : 'CAPPAN',
            fullName: typeof kbGet === 'function' ? kbGet('store.fullName', 'CAPPAN Coffee & More') : 'CAPPAN Coffee & More',
            slogan: typeof kbGet === 'function' ? kbGet('store.slogan', 'Coffee & More - Home Study') : 'Coffee & More - Home Study',
            address: typeof kbGet === 'function' ? kbGet('store.address', 'Công viên Gia Định, Q. Gò Vấp') : 'Công viên Gia Định, Q. Gò Vấp',
            hotline: typeof kbGet === 'function' ? kbGet('store.hotline', '0366 474 038') : '0366 474 038',
            email: typeof kbGet === 'function' ? kbGet('store.email', 'cappannguyen@gmail.com') : 'cappannguyen@gmail.com',
            hours: typeof kbGet === 'function' ? kbGet('store.hours', '07:00 - 22:30 hàng ngày') : '07:00 - 22:30 hàng ngày',
            wifi: typeof kbGet === 'function' ? kbGet('store.wifi', { name:'CAPPAN_Free', password:'cappannguyen' }) : { name:'CAPPAN_Free', password:'cappannguyen' },
            parking: typeof kbGet === 'function' ? kbGet('store.policies.parking', 'Miễn phí') : 'Miễn phí',
            amenities: typeof kbGet === 'function' ? kbGet('store.amenities', []) : []
          };

        case 'get_faq': {
          if (typeof KB === 'undefined' || !Array.isArray(KB.faq)) {
            return { error: 'FAQ chưa có dữ liệu' };
          }
          const query = (args.query || '').toLowerCase();
          let bestMatch = null;
          let bestScore = 0;

          KB.faq.forEach(f => {
            if (!f.keywords) return;
            const score = f.keywords.filter(k => query.includes(k)).length;
            if (score > bestScore) {
              bestScore = score;
              bestMatch = f;
            }
          });

          if (bestMatch && bestScore >= 1) {
            return {
              question: bestMatch.question,
              answer: bestMatch.answer
            };
          }
          return { error: 'Không tìm thấy FAQ phù hợp' };
        }

        case 'get_promotions': {
          if (typeof SEED_PROMOTIONS === 'undefined') {
            return { promotions: [], note: 'Chưa có dữ liệu khuyến mãi' };
          }
          return {
            promotions: SEED_PROMOTIONS
              .filter(p => p.active)
              .map(p => ({
                code: p.code,
                name: p.name,
                description: p.description,
                discount: p.discount,
                minOrder: p.minOrder,
                terms: p.terms
              }))
          };
        }

        default:
          return { error:`Tool "${toolName}" chưa implement.` };
      }
    } catch (e) {
      console.error('[AIToolExecutor]', e);
      return { error: e.message };
    }
  }
};

/* ============================================================
   8. AI BRAIN
============================================================ */

const AIBrain = {
  histories: {},
  _onPhaseChange: null,

  _getSessionId() {
    const u = API.users.getCurrent();
    return u ? `${u.role}_${u.id}` : 'guest';
  },

  _getRole() {
    return Auth.isStaff() ? 'staff' : 'customer';
  },

  _getHistory(sid, role) {
    if (!this.histories[sid]) {
      const saved = sessionStorage.getItem('cappan_history_' + sid);
      if (saved) {
        try {
          this.histories[sid] = JSON.parse(saved);
        } catch {
          this.histories[sid] = [{ role:'system', content: AI_PROMPTS[role] }];
        }
      } else {
        this.histories[sid] = [{ role:'system', content: AI_PROMPTS[role] }];
      }
    }
    return this.histories[sid];
  },

  _saveHistory(sid) {
    try {
      sessionStorage.setItem('cappan_history_' + sid, JSON.stringify(this.histories[sid]));
    } catch (e) {
      console.warn('[AIBrain] Không lưu được history:', e);
    }
  },

  _clearHistory(sid) {
    delete this.histories[sid];
    sessionStorage.removeItem('cappan_history_' + sid);
  },

  _trimHistory(sid) {
    const h = this.histories[sid];
    if (!h || h.length <= 11) return;

    const sys = h[0];
    let startIdx = h.length - 10;

    while (startIdx > 1 && h[startIdx].role === 'tool') {
      startIdx--;
    }
    while (startIdx > 1 && h[startIdx - 1].role === 'assistant'
           && h[startIdx - 1].tool_calls
           && h[startIdx - 1].tool_calls.length > 0) {
      startIdx--;
    }

    this.histories[sid] = [sys, ...h.slice(startIdx)];
  },

  /* ============================================================
     STREAM + TOOL_CALLS
  ============================================================ */
  async _callLLMStreamWithTools(messages, role, onChunk, _attempt = 0) {
    const MAX_ATTEMPTS = AI_KEYS.length + AI_MODELS.length;

    if (_attempt >= MAX_ATTEMPTS) {
      throw new Error('Đã thử hết tất cả API keys và models.');
    }

    const currentKey = AI_CONFIG.getCurrentKey();
    const currentModel = AI_CONFIG.getCurrentModel();

    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), AI_CONFIG.timeoutMs);

    try {
      const res = await fetch(AI_CONFIG.endpoint, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentKey}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          model: currentModel.name,
          messages,
          temperature: AI_CONFIG.temperature,
          max_tokens: currentModel.maxTokens,
          tools: AI_TOOLS[role],
          tool_choice: 'auto',
          stream: true
        })
      });

      /* ⚡ RETRY 429 */
      if (res.status === 429) {
        clearTimeout(timer);
        const errText = await res.text();
        console.warn(`⚠️ 429 Rate limit — key ${AI_CONFIG._keyIndex}, model ${currentModel.name}`);
        console.warn(`   Chi tiết: ${errText.slice(0, 200)}`);

        const nextAttempt = _attempt + 1;
        const maxKeyRotation = AI_KEYS.length;

        if (_attempt < maxKeyRotation - 1) {
          AI_CONFIG.rotateKey();
          console.log(`🔄 Xoay API key → index ${AI_CONFIG._keyIndex}`);
        } else {
          AI_CONFIG.reset();
          AI_CONFIG.rotateModel();
          console.log(`🔄 Xoay model → ${AI_CONFIG.getCurrentModel().name}`);
        }

        return this._callLLMStreamWithTools(messages, role, onChunk, nextAttempt);
      }

      /* ⚡ RETRY 5xx */
      if (res.status >= 500) {
        clearTimeout(timer);
        console.warn(`⚠️ ${res.status} Server error — xoay model`);
        AI_CONFIG.rotateModel();
        return this._callLLMStreamWithTools(messages, role, onChunk, _attempt + 1);
      }

      /* ⚡ RETRY 404 */
      if (res.status === 404) {
        clearTimeout(timer);
        console.warn(`⚠️ 404 Model không tồn tại: ${currentModel.name}`);
        AI_CONFIG.rotateModel();
        return this._callLLMStreamWithTools(messages, role, onChunk, _attempt + 1);
      }

      /* ⚡ Không phải lỗi retry được */
      if (!res.ok) {
        clearTimeout(timer);
        const errText = await res.text();
        throw new Error(`LLM ${res.status}: ${errText}`);
      }

      if (_attempt > 0) {
        console.log(`✅ Retry thành công — key ${AI_CONFIG._keyIndex}, model ${currentModel.name}`);
      }

      /* ⚡ PARSE SSE */
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';
      const toolCallsMap = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            let json;
            try { json = JSON.parse(data); }
            catch { continue; }

            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;

            if (typeof delta.content === 'string' && delta.content.length > 0) {
              fullContent += delta.content;
              if (typeof onChunk === 'function') onChunk(delta.content, fullContent);
            }

            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = (tc.index !== undefined) ? tc.index : 0;

                if (!toolCallsMap[idx]) {
                  toolCallsMap[idx] = {
                    id: '',
                    type: 'function',
                    function: { name: '', arguments: '' }
                  };
                }

                const slot = toolCallsMap[idx];
                if (tc.id) slot.id = tc.id;
                if (tc.type) slot.type = tc.type;

                if (tc.function) {
                  if (tc.function.name) slot.function.name += tc.function.name;
                  if (tc.function.arguments) slot.function.arguments += tc.function.arguments;
                }
              }
            }
          }
        }

        clearTimeout(timer);
        timer = setTimeout(() => ctrl.abort(), AI_CONFIG.timeoutMs);
      }

      clearTimeout(timer);

      // ⚡ Xử lý buffer sót
      if (buffer.trim()) {
        const lines = buffer.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              if (typeof onChunk === 'function') onChunk(delta.content, fullContent);
            }
          } catch {}
        }
      }

      const toolCalls = Object.values(toolCallsMap).filter(tc => tc.function.name);
      return { content: fullContent, toolCalls };

    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  },

  /* ============================================================
     STREAM REPLY
  ============================================================ */
  async streamReply(input, onChunk) {
    const role = this._getRole();
    const sid = this._getSessionId();

    const canCache = (role === 'customer') && isCacheable(input);

    if (canCache) {
      const cached = ResponseCache.get(input, role);
      if (cached) {
        if (onChunk) {
          const words = cached.message.split(' ');
          let partial = '';
          for (let i = 0; i < words.length; i++) {
            partial += (i > 0 ? ' ' : '') + words[i];
            onChunk(words[i], partial);
            await new Promise(r => setTimeout(r, 15));
          }
        }
        return cached;
      }
    }

    this._getHistory(sid, role);
    this.histories[sid].push({ role:'user', content: input });
    this._trimHistory(sid);

    try {
      const result = await this._callLLMStreamWithTools(
        this.histories[sid], role, onChunk
      );

      /* ============ CÓ TOOL_CALLS ============ */
      if (result.toolCalls && result.toolCalls.length > 0) {
        this.histories[sid].push({
          role: 'assistant',
          content: result.content || '',
          tool_calls: result.toolCalls
        });

        const dangerCall = result.toolCalls.find(c =>
          AI_CONFIRM_TOOLS.includes(c.function.name)
        );

        if (dangerCall) {
          let args = {};
          try { args = JSON.parse(dangerCall.function.arguments || '{}'); } catch {}
          this._saveHistory(sid);
          return {
            type: 'pending',
            toolName: dangerCall.function.name,
            toolCallId: dangerCall.id,
            args: args,
            message: this._buildConfirmMessage(dangerCall.function.name, args)
          };
        }

        for (const call of result.toolCalls) {
          let args = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
          const toolRes = await AIToolExecutor.run(call.function.name, args, role);
          this.histories[sid].push({
            role:'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolRes)
          });
        }

        if (typeof this._onPhaseChange === 'function') {
          this._onPhaseChange('stream2');
        }

        const followUp = await this._callLLMStreamWithTools(
          this.histories[sid], role, onChunk
        );
        const finalText = followUp.content || '';
        this.histories[sid].push({ role:'assistant', content: finalText });
        this._saveHistory(sid);
        return { type: 'text', message: finalText };
      }

      /* ============ CHỈ CÓ TEXT ============ */
      this.histories[sid].push({ role:'assistant', content: result.content });
      this._saveHistory(sid);

      const finalResult = { type: 'text', message: result.content };

      if (canCache && result.content) {
        ResponseCache.set(input, role, finalResult);
        console.log(`📦 Cache SAVED (static): "${input.slice(0, 40)}..."`);
      }

      return finalResult;

    } catch (e) {
      console.error('[AIBrain] streamReply lỗi:', e);
      if (typeof AIBrainLegacy !== 'undefined' && AIBrainLegacy.reply) {
        const fallback = AIBrainLegacy.reply(input);
        if (onChunk) onChunk(fallback, fallback);
        return { type: 'text', message: fallback };
      }
      const errMsg = 'Xin lỗi, em đang gặp sự cố kỹ thuật. Anh/chị thử lại giúp em nhé!';
      if (onChunk) onChunk(errMsg, errMsg);
      return { type: 'text', message: errMsg };
    }
  },

  async reply(input) {
    return this.streamReply(input, null);
  },

  /* ---------- CONFIRM ---------- */
  async confirmPending(toolName, toolCallId, args, onChunk) {
    const role = this._getRole();
    const sid = this._getSessionId();
    this._getHistory(sid, role);
    try {
      const result = await AIToolExecutor.run(toolName, args, role);
      this.histories[sid].push({
        role:'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify(result)
      });
      const followUp = await this._callLLMStreamWithTools(
        this.histories[sid], role, onChunk
      );
      const finalText = followUp.content || '';
      this.histories[sid].push({ role:'assistant', content: finalText });
      this._saveHistory(sid);
      return { type: 'text', message: finalText };
    } catch (e) {
      console.error('[AIBrain] confirmPending lỗi:', e);
      const errMsg = 'Xin lỗi, thao tác bị lỗi. Anh/chị thử lại nhé!';
      if (onChunk) onChunk(errMsg, errMsg);
      return { type: 'text', message: errMsg };
    }
  },

  /* ---------- CANCEL ---------- */
  cancelPending(reason = 'Anh/chị đã hủy thao tác ạ.') {
    const sid = this._getSessionId();
    const role = this._getRole();
    this._getHistory(sid, role);
    const h = this.histories[sid];

    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].role === 'assistant' && h[i].tool_calls && h[i].tool_calls.length > 0) {
        let j = i + 1;
        while (j < h.length && h[j].role === 'tool') {
          h.splice(j, 1);
        }
        h.splice(i, 1);
        break;
      }
    }

    h.push({ role: 'assistant', content: reason });
    this._saveHistory(sid);
    return { type: 'text', message: reason };
  },

  _buildConfirmMessage(toolName, args) {
    const map = {
      mark_out_of_stock: () => {
        const item = API.menu.getById(args.itemId);
        return `Em sẽ đánh dấu món ${item ? item.name : args.itemId} (${args.itemId}) là HẾT HÀNG.\nAnh/chị xác nhận?`;
      },
      mark_in_stock: () => {
        const item = API.menu.getById(args.itemId);
        return `Em sẽ đánh dấu món ${item ? item.name : args.itemId} (${args.itemId}) là CÒN HÀNG trở lại.\nAnh/chị xác nhận?`;
      },
      reset_seats_by_floor: () => {
        const floor = API.floors.getById(args.floorId);
        const count = SEED_SEATS.filter(s => s.floorId === args.floorId).length;
        return `⚠️ Em sẽ RESET toàn bộ ${count} chỗ ngồi của ${floor ? floor.name : args.floorId} về trạng thái trống.\nViệc này sẽ XÓA HẾT booking đang active ở tầng này.\nAnh/chị xác nhận?`;
      },
      reset_all_seats: () => {
        return `⚠️ CẢNH BÁO: Em sẽ RESET TOÀN BỘ ${SEED_SEATS.length} chỗ ngồi của quán.\nViệc này sẽ XÓA HẾT tất cả booking đang active.\nAnh/chị có chắc chắn muốn tiếp tục?`;
      },
      cancel_order: () => {
        const order = API.orders.getById(args.orderId);
        if (!order) return `Em sẽ hủy đơn ${args.orderId}. Anh/chị xác nhận?`;
        const items = order.items.map(i => `${i.name} x${i.qty}`).join(', ');
        return `⚠️ Em sẽ HỦY đơn hàng ${args.orderId}:\n• Khách: ${order.customerName || 'Không rõ'}\n• Món: ${items}\n• Tổng: ${API.utils.formatVND(order.total)}\nAnh/chị xác nhận?`;
      },
      complete_order: () => {
        const order = API.orders.getById(args.orderId);
        if (!order) return `Em sẽ đánh dấu đơn ${args.orderId} đã giao xong. Anh/chị xác nhận?`;
        return `Em sẽ đánh dấu đơn ${args.orderId} (${API.utils.formatVND(order.total)}) là ĐÃ GIAO.\nAnh/chị xác nhận?`;
      },
      cancel_booking: () => {
        const bk = API.bookings.getAll().find(b => b.id === args.bookingId);
        if (!bk) return `Em sẽ hủy booking ${args.bookingId}. Anh/chị xác nhận?`;
        const floor = API.floors.getById(bk.floorId);
        return `⚠️ Em sẽ HỦY booking ${args.bookingId}:\n• Chỗ: ${bk.seatId} (${floor ? floor.name : bk.floorId})\n• Ngày: ${bk.date} lúc ${bk.time}\n• Số khách: ${bk.guests}\nAnh/chị xác nhận?`;
      },
      complete_booking: () => {
        const bk = API.bookings.getAll().find(b => b.id === args.bookingId);
        if (!bk) return `Em sẽ đánh dấu booking ${args.bookingId} hoàn thành. Anh/chị xác nhận?`;
        return `Em sẽ đánh dấu booking ${args.bookingId} (chỗ ${bk.seatId}) là HOÀN THÀNH.\nGhế sẽ được giải phóng.\nAnh/chị xác nhận?`;
      }
    };

    return map[toolName]
      ? map[toolName]()
      : `Em sẽ thực hiện thao tác "${toolName}". Anh/chị xác nhận?`;
  }
};