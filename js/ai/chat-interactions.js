/* ============================================================
   CHAT INTERACTIONS v3.3 (CLEAN & FIXED)
   - Fix SyntaxError, xoá LIVE_ORDER trùng lặp.
   - Smart Intent (Scoring) cho đơn hàng, booking, điểm, voucher...
   - Live Order (Map + Shipper) chuẩn xác.
   - Fallback Protection (chống LLM bịa chuyện).
============================================================ */
(function () {
  'use strict';

  if (typeof AIBrain === 'undefined') {
    console.warn('[ChatInteractions] AIBrain chưa load — skip');
    return;
  }
  if (window.__CAPPAN_CHAT_INTERACTIONS__) return;

  /* ══════════════════════════════════════════════════════════
     FIX #1: Gán _getRole NGAY ĐẦU (tránh crash khi restore history)
  ══════════════════════════════════════════════════════════ */
  AIBrain._getRole = function () {
    try {
      const sid = this._getSessionId();
      if (sid.indexOf('staff_') === 0)    return 'staff';
      if (sid.indexOf('customer_') === 0) return 'customer';
      return 'guest';
    } catch (e) { return 'guest'; }
  };

  try {
    /* ═══════════════ HELPERS ═══════════════ */
    const _norm = (typeof LocalBrain !== 'undefined' && LocalBrain.norm)
      ? LocalBrain.norm.bind(LocalBrain)
      : (s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9< ]+/g, ' ').replace(/\s+/g, ' ').trim());

    const _needLogin = what => ({
      type: 'text',
      message: `Dạ để ${what}, anh/chị cần đăng nhập ạ.\n[UI_NEED_LOGIN]{}[/UI_NEED_LOGIN]`,
      source: 'interaction'
    });

    const _sanitize = s => typeof s === 'string'
      ? s.replace(/<\|[^|]*\|>/g, '').replace(/[ \t]{2,}/g, ' ').trim()
      : s;

    /* ⚡ FIX #16: ID đơn sinh ra dạng 'OD' + base36 (lowercase) */
    const _findOrder = id => {
      if (!id) return null;
      const key = String(id).toLowerCase();
      return (API.orders.getAll() || []).find(o => String(o.id).toLowerCase() === key) || null;
    };

    /* ═══════════════════════════════════════════════════════════
       ⚡ SMART INTENT: Chấm điểm thay vì Regex cứng nhắc
    ═══════════════════════════════════════════════════════════ */
    const _detectOrderIntent = (n) => {
      // ⚡ FIX: Loại trừ các câu liên quan đến đặt bàn/chỗ/booking ra khỏi logic đơn hàng
      if (/\b(dat ban|dat cho|dat ghe|dat cho ngoi|booking|giu ban|giu cho)\b/.test(n)) return null;
      // ⚡ FIX: "hủy đơn OD…", "đặt lại đơn OD…", "đánh giá đơn OD…" phải nhường cho
      // cancelMyOrder / reorder / rateOrder (trước đây bị orderStatus chiếm quyền vì default 'status')
      if (/\b(huy|thu hoi)\b/.test(n) || /\bdat lai\b/.test(n) || /\b(danh gia|rating)\b/.test(n)) return null;

      const listKeys = ['lich su', 'danh sach', 'tat ca', 'cac don', 'don cu', 'da dat', 'mua truoc', 'don gan nhat', 'xem tat ca'];
      const statusKeys = ['shipper', 'dang giao', 'dau', 'trang thai', 'den dau', 'sao', 'chua', 'kiem tra', 'tinh trang', 'giao hang', 'theo doi', 'dang o'];
      
      // ⚡ FIX: Chỉ nhận diện "đặt" khi đi kèm với "món" hoặc "nước", không nhận diện "đặt" đứng một mình
      const isOrder = /\b(don|order|mua|dat mon|dat nuoc)\b/.test(n);

      const hasList = listKeys.some(k => n.includes(k));
      const hasStatus = statusKeys.some(k => n.includes(k));

      if (isOrder && hasList) return 'list';
      if (isOrder && hasStatus) return 'status';
      if (isOrder) return 'status'; // Mặc định là xem trạng thái đơn mới nhất
      return null;
    };

    const _scoreIntent = (n, cfg) => {
      const strong = (cfg.strong || []).filter(k => n.includes(k)).length;
      const weak = (cfg.weak || []).filter(k => n.includes(k)).length;
      if (strong >= 1) return 'strong';
      if (weak >= 2) return 'weak';        
      if (weak === 1 && cfg.allowSingleWeak) return 'weak';
      return null;
    };

    /* ═══════════════ QR PRESETS ═══════════════ */
    const QR = {
      main: [
        { label: '🤖 Bạn làm được gì?', text: 'bạn làm được gì' },
        { label: '🍲 Gợi ý món', text: 'gợi ý món ngon' },
        { label: '🪑 Đặt bàn', text: 'đặt bàn' },
        { label: '📖 Menu', href: './menu.html' }
      ],
      menu: [
        { label: '☕ Cà phê', text: 'menu cà phê' },
        { label: '🍵 Trà', text: 'menu trà' },
        { label: '🥤 Sinh tố', text: 'menu sinh tố' },
        { label: '📖 Toàn bộ menu', href: './menu.html' }
      ],
      booking: [
        { label: '🪑 Đặt bàn ngay', text: 'đặt bàn' },
        { label: '📅 Booking của tôi', text: 'booking của tôi' },
        { label: '👥 Hủy bàn', text: 'hủy bàn' }
      ],
      order: [
        { label: '🛒 Giỏ hàng', href: './cart.html' },
        { label: '📦 Đơn của tôi', text: 'đơn của tôi' },
        { label: '🛵 Trạng thái đơn', text: 'đơn của tôi đang ở đâu' }
      ],
      health: [
        { label: '🚫 Không cafein', text: 'gợi ý món không cafein' },
        { label: '💚 Ít ngọt', text: 'gợi ý món ít ngọt' },
        { label: '🌿 Dịu nhẹ', text: 'gợi ý món dịu nhẹ' }
      ],
      store: [
        { label: '🗺 Chỉ đường', text: 'chỉ đường' },
        { label: '📞 Gọi quán', href: 'tel:0366444038' },
        { label: '🕐 Giờ mở cửa', text: 'giờ mở cửa' }
      ],
      staff: [
        { label: '📊 KPI hôm nay', text: 'doanh thu hôm nay' },
        { label: '📦 Đơn đang xử lý', text: 'đơn đang xử lý' },
        { label: '📅 Lịch ca', text: 'lịch ca hôm nay' },
        { label: '👥 Nhân viên', text: 'danh sách nhân viên' }
      ],
      fallback: [
        { label: '🤖 Bạn làm được gì?', text: 'bạn làm được gì' },
        { label: '📞 Hotline', href: 'tel:0366444038' },
        { label: '📖 Menu', href: './menu.html' }
      ]
    };

    const DEFAULT_QR = {
      healthFilter: QR.health,   recoByHistory: QR.main,
      orderStatus: QR.order,     bookingList: QR.booking,
      orderList: QR.order,       cartView: QR.order,
      cartEdit: QR.order,        itemDetail: QR.menu,
      compare: QR.menu,          menuByPrice: QR.menu,
      reorder: QR.order,         rateOrder: QR.order,
      cancelBooking: QR.booking, keepBooking: QR.booking,
      hotline: QR.store,         directions: QR.store,
      promoSearch: QR.order,     multiAdd: QR.order,
      cancelMyOrder: QR.order,
      points: [{ label: '🎁 Ưu đãi', text: 'voucher của tôi' }, { label: '📖 Menu', href: './menu.html' }],
      vouchers: QR.order,        myInfo: QR.main,
      kpi: QR.staff,             topItems: QR.staff,
      ordersByFilter: QR.staff,  orderDetail: QR.staff,
      bookingsToday: QR.staff,   recipe: QR.staff,
      customerLookup: QR.staff,  schedule: QR.staff,
      stock: QR.staff,           staffList: QR.staff
    };

    /* ═══════════════ GUARD CÂU HỎI KHÓ ═══════════════ */
    function difficultQuestions(text, n, role) {
      const raw = String(text || '').trim();

      if (raw.length > 400) {
        return { type: 'text', source: 'guard', quickReplies: QR.fallback,
          message: '📝 Dạ câu hỏi hơi dài, em chưa xử lý hết ạ. Anh/chị rút gọn giúp em nhé!' };
      }

      if (role === 'customer' && /\b(tôi là (chủ|quản lý|admin|nhân viên|staff)|toi la (chu|quan ly|admin|nhan vien))\b/i.test(n)) {
        return { type: 'text', source: 'guard',
          message: '🔒 Dạ em xin lỗi, tài khoản hiện tại của anh/chị là **khách hàng**, không có quyền truy cập chức năng quản trị ạ.\n\nNếu anh/chị là nhân viên, vui lòng đăng nhập tài khoản nhân viên để được cấp quyền ạ.',
          quickReplies: [{ label: '🔑 Đăng nhập', href: './login.html' }, { label: '📞 Hotline', href: 'tel:0366444038' }] };
      }

      if (/\b(model gì|ai model|gpt|claude|gemini|llm|api key|mã nguồn|source code|backend|database|framework|xây dựng bằng|tạo ra bạn|bạn dùng gì)\b/i.test(n)) {
        return { type: 'text', source: 'guard',
          message: '🤖 Dạ em là **trợ lý AI nội bộ của CAPPAN**, xây dựng trên nền tảng AI hiện đại để hỗ trợ đặt món & tra cứu thông tin ạ.\n\nChi tiết kỹ thuật em không tiện chia sẻ. Anh/chị quan tâm có thể liên hệ hotline ạ!',
          quickReplies: QR.store };
      }

      if (/\b(ignore|bỏ qua|bo qua|system prompt|jailbreak|password|mật khẩu admin|admin pass|developer mode|dan mode|reveal|hack|virus|malware)\b/i.test(n)) {
        return { type: 'text', source: 'guard',
          message: '🔒 Dạ em không xử lý được yêu cầu này ạ.\n\nAnh/chị vui lòng hỏi những câu liên quan đến menu, đặt bàn, đơn hàng hoặc thông tin quán giúp em nhé!',
          quickReplies: QR.fallback };
      }

      if (/\b(thời sự|chính trị|bầu cử|tôn giáo|tổng thống|chiến tranh|viết code|giải toán|lập trình|javascript|python|html|css|react|nodejs)\b/i.test(n)) {
        return { type: 'text', source: 'guard',
          message: '😅 Dạ em chỉ là trợ lý của quán cà phê, không rành lĩnh vực này ạ.\n\nNhưng em rất giỏi giúp anh/chị:\n• 🍲 Gợi ý món ngon\n• 🪑 Đặt bàn, đặt nước\n• 📦 Tra cứu đơn hàng\n• 🎁 Xem khuyến mãi',
          quickReplies: QR.main };
      }

      if (/\b(người yêu|ny|crush|yêu đương|yêu không|cưới|kết hôn|tình yêu|hẹn hò|tán gái|tán trai)\b/i.test(n)) {
        return { type: 'text', source: 'guard',
          message: '😅 Dạ em là trợ lý quán cà phê, không rành chuyện tình cảm ạ!\n\nNhưng em có thể giúp anh/chị:\n• Chọn món phù hợp tâm trạng\n• Đặt bàn hẹn hò\n• Gợi ý món cho 2 người',
          quickReplies: [
            { label: '💕 Đặt bàn 2 người', text: 'đặt bàn 2 người tối nay 19h' },
            { label: '🍲 Gợi ý món', text: 'gợi ý món' }
          ] };
      }

      if (/\b(người thật|real người|bạn là (ai|người|máy|bot)|chatbot|robot|bot thật|là ai)\b/i.test(n)) {
        return { type: 'text', source: 'guard',
          message: '🤖 Dạ em là **trợ lý AI** của quán ạ, không phải người thật. Em có thể nhầm, với việc quan trọng anh/chị vui lòng gọi hotline **0366 444 038** ạ!',
          quickReplies: QR.store };
      }

      if (/\b(doanh thu năm|năm ngoái|tháng trước|quý trước|tuần trước|hôm qua|doanh thu lịch sử)\b/i.test(n) && /\b(doanh thu|kpi|số liệu|báo cáo)\b/.test(n)) {
        if (role === 'staff') {
          return { type: 'text', source: 'guard',
            message: '📊 Dạ em chỉ có dữ liệu **hôm nay / tuần này / tháng này** ạ.\n\nAnh/chị xem chi tiết lịch sử tại trang Thống kê nhé:',
            quickReplies: [{ label: '📈 Mở Thống kê', href: './staff-stats.html' }] };
        }
        return { type: 'text', source: 'guard',
          message: '🔒 Dạ em không có quyền cấp số liệu doanh thu ạ. Anh/chị vui lòng liên hệ ban quản lý quán nhé!',
          quickReplies: QR.store };
      }

      if (/\b(chủ quán|founder|owner|sáng lập|ai tạo ra quán|ai mở quán|ông chủ|bà chủ)\b/i.test(n)) {
        return { type: 'text', source: 'guard',
          message: '🏪 Dạ em là trợ lý AI, không có thông tin cá nhân của ban quản lý quán ạ.\n\nAnh/chị vui lòng liên hệ hotline để biết thêm chi tiết ạ!',
          quickReplies: QR.store };
      }

      // ⚡ FIX: Bỏ dấu \ ở ., !, ? vì dùng flag /u
      if (/^[\u{1F300}-\u{1FAFF}\s.!?]+$/u.test(raw)) {
        return { type: 'text', source: 'guard',
          message: '👋 Dạ em chào anh/chị! Anh/chị cần em giúp gì không ạ?',
          quickReplies: QR.main };
      }

      return null;
    }

    /* ═══════════════ CAPABILITIES & ACK ═══════════════ */
    function capabilities(text, n, role) {
      if (!/\b(ban lam duoc gi|giup (duoc )?gi|lam duoc gi|chuc nang|co the lam gi|help|tro giup|hướng dẫn|huong dan)\b/.test(n)) return null;
      const isStaff = role === 'staff';
      const items = isStaff ? [
        '📊 **Xem KPI, doanh thu** hôm nay / tuần / tháng',
        '📦 **Quản lý đơn**: xem, tiến trình, hoàn tất, hủy',
        '📅 **Booking hôm nay**',
        '🧑 **Tra cứu khách hàng** theo SĐT',
        '📖 **Công thức pha chế** (chỉ nhân viên)',
        '👥 **Danh sách nhân viên**',
        '📅 **Lịch ca làm** hôm nay',
        '🍵 **Món hết hàng** — đánh dấu còn hàng'
      ] : [
        '🪑 **Đặt bàn** và quản lý booking',
        '🥤 **Đặt món**, xem giỏ, thanh toán',
        '📦 **Theo dõi đơn realtime** + bản đồ shipper',
        '🍲 **Gợi ý món** theo lịch sử / sức khỏe / tâm trạng',
        '🎁 **Điểm tích lũy & voucher**',
        '💚 **Tránh cafein** khi đau dạ dày / khó ngủ',
        '🏪 **Thông tin quán**: wifi, giờ mở, địa chỉ',
        '📞 **Gọi nhân viên** khi cần'
      ];
      return {
        type: 'text', source: 'interaction',
        message: `🤖 Dạ em là **trợ lý AI của CAPPAN**, có thể giúp anh/chị:\n\n${items.map(x => '• ' + x).join('\n')}\n\nAnh/chị muốn thử tính năng nào ạ?`,
        quickReplies: isStaff ? QR.staff : QR.main
      };
    }

    function acknowledgements(text) {
      // ⚡ Nếu đang có draft checkout chờ xác nhận → nhường cho confirmCheckout
      try {
        const sid = AIBrain._getSessionId();
        const draft = AIBrain._loadDrafts()[sid];
        if (draft && draft.kind === 'checkout' && draft.stage === 'confirm') return null;
      } catch (e) {}
      
      if (/^(cảm ơn|cam on|thanks|thank you|tks|ok|oke|okela|được|duoc|vâng|vang|ừ|u|uhm|dạ|da)\s*[.!?]?$/i.test(String(text).trim())) {
        return {
          type: 'text', source: 'interaction',
          message: '😊 Dạ không có gì ạ! Em luôn sẵn sàng hỗ trợ. Anh/chị cần gì khác không ạ?',
          quickReplies: QR.main
        };
      }
      return null;
    }

    /* ═══════════════ CAFEIN METADATA ═══════════════ */
    const CAFFEINE_MAP = {
      M001: 'strong', M005: 'strong', M006: 'strong',
      M002: 'light',  M003: 'light',  M004: 'light',
      M101: 'light',  M102: 'light',  M103: 'light', M104: 'light',
      M403: 'light',  M404: 'light',  M501: 'light'
    };
    const _cafeinLevel = id => CAFFEINE_MAP[id] || 'none';
    const _cafeinTag = id => {
      const lv = _cafeinLevel(id);
      return lv === 'strong' ? '☕ Cafein mạnh'
           : lv === 'light'  ? '🥛 Cafein nhẹ'
           : '🚫 Không cafein';
    };

    /* ═══════════════ RENDERER OVERRIDES ═══════════════ */
    if (typeof UICards !== 'undefined' && UICards.renderers) {

      UICards.renderers.LIVE_ORDER = function (d) {
        const steps = ['Chờ xử lý', 'Đang pha', 'Shipper lấy', 'Đang giao', 'Hoàn tất'];
        const step = Math.max(0, Math.min(4, Number(d.step) || 0));
        const cancelled = d.status === 'cancelled';
        const done = step >= 4 || cancelled;
        const live = step >= 2 && step < 4 && !cancelled;

        const coords = (typeof SHIPPER_DATA !== 'undefined' && SHIPPER_DATA.coords)
          ? SHIPPER_DATA.coords
          : ['10.812483,106.674875', '10.8100,106.6770', '10.8080,106.6800', '10.8050,106.6830', '10.8020,106.6860', '10.7990,106.6890'];
        const locations = (typeof SHIPPER_DATA !== 'undefined' && SHIPPER_DATA.locations)
          ? SHIPPER_DATA.locations
          : ['CAPPAN – Công viên Gia Định', 'Đang rời quán', 'Đường Hoàng Minh Giám', 'Gần ngã tư HMG – PVĐ', 'Đang đến bạn', 'Đã giao xong'];
        const shipperName  = (typeof SHIPPER_DATA !== 'undefined' && SHIPPER_DATA.name)  || 'Nguyễn Văn B';
        const shipperPhone = (typeof SHIPPER_DATA !== 'undefined' && SHIPPER_DATA.phone) || '0912 345 678';
        const coord = coords[step] || coords[0];
        const loc   = locations[step] || locations[0];

        const rows = steps.map((s, i) => {
          const cls = i < step ? ' done' : (i === step && !cancelled ? ' current' : '');
          return `<div class="ui-live-step${cls}"><span class="ui-live-dot">${i < step ? '✓' : (i + 1)}</span><span>${esc(s)}</span></div>`;
        }).join('');

        const mapBlock = !done ? `
          <div class="ui-live-map-wrap" style="margin-top:10px;border-radius:12px;overflow:hidden;border:1px solid #EADBC4;background:#f5f0e6;position:relative;">
            <iframe data-shipper-map="${esc(d.id)}" src="https://www.google.com/maps?q=${coord}&z=15&output=embed" width="100%" height="180" style="border:0;display:block;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Vị trí shipper"></iframe>
            <div style="position:absolute;top:8px;left:8px;background:rgba(255,255,255,0.95);padding:4px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;color:#2E7D32;box-shadow:0 2px 8px rgba(0,0,0,0.15);">🛵 Đang trên đường giao</div>
          </div>
          <div class="ui-live-shipper" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0 4px;font-size:0.82rem;color:#5D4037;">
            <span>👤 <b>${esc(shipperName)}</b></span><span>·</span>
            <a href="tel:${String(shipperPhone).replace(/\s/g, '')}" style="color:#2E7D32;font-weight:700;text-decoration:none;">📞 ${esc(shipperPhone)}</a>
            <span class="ui-live-loc" style="flex:1;text-align:right;color:#8a7a6a;">📍 ${esc(loc)}</span>
          </div>` : '';

        return `
          <div class="ui-card ui-act-card ui-live" data-live-order="${esc(d.id)}" data-current-step="${step}" data-current-status="${esc(d.status || '')}" ${d.staff ? 'data-live-staff="1"' : ''}>
            <h4>🛵 Trạng thái đơn ${esc(d.id)} ${live ? '<span class="ui-live-flag">● LIVE</span>' : ''}</h4>
            <div class="ui-act-info">${esc(d.customerName || 'Khách')} · <b>${UICards.fmt(d.total)}</b>${cancelled ? ' · <b style="color:#c62828;">ĐÃ HỦY</b>' : (step >= 4 ? ' · <b style="color:#2E7D32;">HOÀN TẤT</b>' : '')}</div>
            <div class="ui-live-body">${rows}</div>
            <div class="ui-live-bar"><div style="width:${cancelled ? 100 : (step / 4 * 100)}%"></div></div>
            ${mapBlock}
            ${d.staff && step < 4 && !cancelled ? `<div class="ui-act">
              ${UICards.abtn('▶ Bước tiếp', 'tiến trình ' + d.id, { sm: true })}
              ${UICards.abtn('✓ Hoàn tất', 'hoàn tất đơn ' + d.id, { sm: true, primary: true })}
              ${UICards.abtn('✗ Hủy đơn', 'hủy đơn ' + d.id, { sm: true, danger: true })}
            </div>` : ''}
            ${!d.staff ? `<div class="ui-act">${UICards.alink('📍 Trang theo dõi', 'tracking.html?id=' + d.id)}</div>` : ''}
          </div>`;
      };

      if (typeof UICards._paintLive === 'function') {
        const _origPaintLive = UICards._paintLive;
        UICards._paintLive = function (id, o) {
          try {
            const newStep = Math.max(0, Math.min(4, Number(o.step) || 0));
            const newStatus = o.status || '';
            const cancelled = newStatus === 'cancelled';
            const done = newStep >= 4 || cancelled;
            const steps = ['Chờ xử lý', 'Đang pha', 'Shipper lấy', 'Đang giao', 'Hoàn tất'];
            const coords = (typeof SHIPPER_DATA !== 'undefined' && SHIPPER_DATA.coords)
              ? SHIPPER_DATA.coords
              : ['10.812483,106.674875', '10.8100,106.6770', '10.8080,106.6800', '10.8050,106.6830', '10.8020,106.6860', '10.7990,106.6890'];
            const locations = (typeof SHIPPER_DATA !== 'undefined' && SHIPPER_DATA.locations)
              ? SHIPPER_DATA.locations
              : ['CAPPAN', 'Đang rời quán', 'Đường HMG', 'Gần ngã tư HMG – PVĐ', 'Đang đến bạn', 'Đã giao'];

            document.querySelectorAll('[data-live-order="' + id + '"]').forEach(el => {
              if (!document.body.contains(el)) return;
              const oldStep = parseInt(el.dataset.currentStep, 10) || 0;
              const oldStatus = el.dataset.currentStatus || '';
              if (newStep === oldStep && newStatus === oldStatus) return;

              el.dataset.currentStep = String(newStep);
              el.dataset.currentStatus = newStatus;

              const timeline = el.querySelector('.ui-live-body');
              if (timeline) {
                timeline.innerHTML = steps.map((s, i) => {
                  const cls = i < newStep ? ' done' : (i === newStep && !cancelled ? ' current' : '');
                  return `<div class="ui-live-step${cls}"><span class="ui-live-dot">${i < newStep ? '✓' : (i + 1)}</span><span>${esc(s)}</span></div>`;
                }).join('');
              }
              const bar = el.querySelector('.ui-live-bar > div');
              if (bar) bar.style.width = (cancelled ? 100 : (newStep / 4 * 100)) + '%';

              const h4 = el.querySelector('h4');
              if (h4) {
                const live = newStep >= 2 && newStep < 4 && !cancelled;
                h4.innerHTML = `🛵 Trạng thái đơn ${esc(id)} ${live ? '<span class="ui-live-flag">● LIVE</span>' : ''}`;
              }
              const info = el.querySelector('.ui-act-info');
              if (info) {
                const base = esc(o.customerName || 'Khách') + ' · <b>' + UICards.fmt(o.total) + '</b>';
                info.innerHTML = base + (cancelled ? ' · <b style="color:#c62828;">ĐÃ HỦY</b>' : (newStep >= 4 ? ' · <b style="color:#2E7D32;">HOÀN TẤT</b>' : ''));
              }
              const iframe = el.querySelector('iframe[data-shipper-map]');
              if (done) {
                const mapWrap = el.querySelector('.ui-live-map-wrap');
                const shipperBlock = el.querySelector('.ui-live-shipper');
                if (mapWrap) mapWrap.remove();
                if (shipperBlock) shipperBlock.remove();
              } else if (iframe) {
                const newSrc = `https://www.google.com/maps?q=${coords[newStep] || coords[0]}&z=15&output=embed`;
                if (iframe.src !== newSrc) iframe.src = newSrc;
              }
              const locEl = el.querySelector('.ui-live-loc');
              if (locEl) locEl.textContent = '📍 ' + (locations[newStep] || '');
            });
          } catch (e) {
            try { _origPaintLive.call(this, id, o); } catch (err) {}
          }
        };
      }

      UICards.renderers.COMPARE = function (d) {
        const a = d.a || {}, b = d.b || {};
        const col = (m, win) => {
          const price = Number(m.price) || 0;
          return `
            <div class="ui-cmp-col${win ? ' ui-cmp-win' : ''}" style="display:flex;flex-direction:column;gap:6px;align-items:stretch;">
              ${win ? '<span class="ui-badge" style="align-self:center;">Rẻ hơn</span>' : ''}
              <div class="menu-item-name" style="text-align:center;font-size:1rem;">${esc(m.name)}</div>
              <div class="menu-item-price" style="text-align:center;font-size:1.1rem;">${UICards.fmt(price)}</div>
              ${m.categoryName ? `<div class="ui-sub" style="text-align:center;">📂 ${esc(m.categoryName)}</div>` : ''}
              ${m.tags ? `<div class="ui-sub" style="text-align:center;font-style:italic;">${esc(m.tags)}</div>` : ''}
              ${m.inStock === false ? '<div class="ui-sub" style="text-align:center;color:#c62828;font-weight:700;">Hết hàng</div>' : ''}
              <div style="margin-top:auto; padding-top:10px; display:flex; justify-content:center;">
                ${m.inStock === false ? '<button class="ui-btn-add" disabled>Hết hàng</button>' : UICards.addBtn(m)}
              </div>
            </div>`;
        };
        return `
          <div class="ui-card">
            <h4>⚖️ So sánh món</h4>
            <div class="ui-cmp">${col(a, d.cheaper === a.name)}${col(b, d.cheaper === b.name)}</div>
            ${d.diff > 0
              ? `<div class="ui-sub ui-more" style="text-align:center;margin-top:10px;">Chênh lệch ${UICards.fmt(d.diff)}</div>`
              : '<div class="ui-sub ui-more" style="text-align:center;margin-top:10px;">Hai món cùng giá</div>'}
          </div>`;
      };

      UICards.renderers.RECIPE = function (d) {
        let price = Number(d.price) || 0;
        if (!price && d.id) {
          const m = API.menu.getById(d.id);
          if (m) price = Number(m.price) || 0;
        }
        return `
          <div class="ui-card">
            <h4>📖 Công thức: ${esc(d.name)}</h4>
            <div class="ui-chips">
              <span class="ui-chip ui-chip-muted">Size: ${esc(d.size || 'Chuẩn')}</span>
              ${price > 0 ? `<span class="ui-chip">Giá: ${UICards.fmt(price)}</span>` : ''}
            </div>
            <div class="ui-cat"><span>🥄 Nguyên liệu</span></div>
            <ul style="padding-left: 16px; font-size: 13px; margin-bottom: 12px; color: #3E2723;">
              ${(d.ingredients || []).map(i => `<li>${esc(i)}</li>`).join('')}
            </ul>
            <div class="ui-cat"><span>👨‍🍳 Cách làm</span></div>
            <ol style="padding-left: 16px; font-size: 13px; color: #3E2723;">
              ${(d.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}
            </ol>
            ${d.note ? `<div class="ui-sub ui-mt">💡 Ghi chú: ${esc(d.note)}</div>` : ''}
          </div>`;
      };

      UICards.renderers.SHIFT = function (d, isPreview) {
        const nameMap = {};
        (Array.isArray(d.shifts) ? d.shifts : []).forEach(s => { nameMap[s.id] = s; });
        const allDates = Object.keys(d.upcoming || {}).filter(k => {
          const v = d.upcoming[k];
          return v && typeof v === 'object' && Object.keys(v).length;
        });
        if (!allDates.length) {
          return `<div class="ui-card"><h4>🗓 Lịch phân ca</h4><p class="ui-sub">Không có lịch nào ạ.</p></div>`;
        }
        const dates = isPreview === false ? allDates : allDates.slice(0, 3);
        return `
          <div class="ui-card">
            <h4>🗓 Lịch phân ca</h4>
            ${dates.map(date => `
              <div class="ui-cat"><span>${esc(UICards.day(date))}</span></div>
              ${Object.entries(d.upcoming[date]).map(([sid, list]) => {
                const sh = nameMap[sid];
                const timeRange = sh && sh.timeRange ? ` (${sh.timeRange})` : '';
                return `<div class="ui-line">
                  <div class="ui-sub"><b>${esc(sh ? sh.name : sid)}</b>${esc(timeRange)}</div>
                  <div>${(list || []).map(esc).join(', ')}</div>
                </div>`;
              }).join('')}
            `).join('')}
          </div>`;
      };

      if (typeof UICards.renderers.MENU === 'function') {
        const _origMenu = UICards.renderers.MENU;
        UICards.renderers.MENU = function (d, isPreview) {
          try {
            if (Array.isArray(d)) d = { total: d.length, items: d };
            if (d && Array.isArray(d.items)) {
              d.items = d.items.map(it => {
                if (!it.id || !API.menu.getById(it.id)) return it;
                const cafein = _cafeinTag(it.id);
                return {
                  ...it,
                  reason: it.reason && !/cafein/i.test(it.reason) ? it.reason + ' · ' + cafein : (it.reason || cafein)
                };
              });
            }
          } catch (e) {}
          return _origMenu.call(this, d, isPreview);
        };
      }

      UICards.renderers.BOOKING_CANCEL = function (d) {
        const bks = (d && d.bks) || [];

        if (d && d.confirm && bks[0]) {
          const b0 = bks[0];
          return `
            <div class="ui-card ui-act-card" style="border-left-color:#c62828;">
              <h4>🚫 Xác nhận hủy bàn</h4>
              <div class="ui-act-info">🎫 <b>${esc(b0.id)}</b> · 🪑 Bàn ${esc(b0.seatId)} · 👥 ${esc(b0.guests)} người<br>🕒 ${UICards.fmtTime(b0.time)} ${esc(String(b0.date || '').toLowerCase())}</div>
              <div class="ui-act">
                <button type="button" class="ui-fab-btn ui-fab-primary" data-ui-say="xác nhận hủy booking ${esc(b0.id)}">✓ Hủy bàn này</button>
                <button type="button" class="ui-fab-btn ui-fab-danger" data-ui-say="giữ bàn">🛑 Giữ bàn</button>
              </div>
            </div>`;
        }

        const rows = bks.map(b => `
          <div class="ui-inner-box" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="font-size:0.8rem; line-height:1.5; min-width:0;">
              <b>🎫 ${esc(b.id)}</b> · 🪑 ${esc(b.seatId)} · 👥 ${esc(b.guests)} người<br>
              <span style="color:#8a7a6a;">🕒 ${UICards.fmtTime(b.time)} ${esc(String(b.date || '').toLowerCase())}</span>
            </div>
            <div style="flex:none;">
              <button type="button" class="ui-fab-btn ui-fab-sm ui-fab-danger" data-ui-say="hủy booking ${esc(b.id)}">✗ Hủy</button>
            </div>
          </div>
        `).join('');

        return `
          <div class="ui-card ui-act-card">
            <h4>📅 Booking của anh/chị (${bks.length})</h4>
            ${d && d.ask ? '<div class="ui-sub" style="margin-bottom:8px;">Bấm <b>✗ Hủy</b> ở bàn muốn hủy ạ:</div>' : ''}
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">${rows}</div>
          </div>`;
      };
    }

    /* ═══════════════ CUSTOMER HANDLERS ═══════════════ */
    const CUSTOMER_HANDLERS = [
function updateInfo(text, n) {
  const isUpdate = /\b(doi|sua|thay|cap nhat|chinh|doi lai|sua lai)\b/.test(n);
  if (!isUpdate) return null;
  
  const isAddr = /\b(dia chi|noi o|cho o|giao hang|giao toi|ship toi)\b/.test(n);
  const isPhone = /\b(so dien thoai|sdt|dien thoai|phone)\b/.test(n);
  
  if (!isAddr && !isPhone) return null;

  const me = API.users.getCurrent();
  if (!me) return _needLogin('cập nhật thông tin giao hàng');

  const sid = AIBrain._getSessionId();
  const patch = {};

  if (isAddr) {
    let newAddr = text.replace(/(?:đổi|sửa|thay|cập nhật|chỉnh|đổi lại|sửa lại|địa chỉ|thông tin|giao hàng|giao tới|ship tới|nơi ở|chỗ ở|thành|sang|qua|tới|là|về|mới|giúp|em|với|nhé|ạ)/gi, '').replace(/^[\s,]+|[\s,]+$/g, '').trim();
    
    if (newAddr.length < 5) {
      // ⚡ P6: set state — user sẽ gõ địa chỉ lượt sau → _updateAddrStep xử lý
      AIBrain._draftSet(sid, { kind: 'update_addr', stage: 'waiting', field: 'address', _backupCheckout: null });
      return { 
        type: 'text', 
        message: 'Dạ anh/chị cho em **địa chỉ mới** ạ (VD: "123 Lê Lợi, Q.1").', 
        source: 'interaction',
        quickReplies: [{ label: '📝 Vào hồ sơ', href: './profile.html' }]
      };
    }
    patch.address = newAddr;
  }

  if (isPhone) {
    const phoneMatch = text.match(/(0\d{9,10})/);
    if (phoneMatch) {
      patch.phone = phoneMatch[1];
    } else {
      // ⚡ P6: set state phone — user sẽ gõ SĐT lượt sau → _updateAddrStep xử lý
      AIBrain._draftSet(sid, { kind: 'update_addr', stage: 'waiting', field: 'phone', _backupCheckout: null });
      return { 
        type: 'text', 
        message: 'Dạ anh/chị cho em **SĐT mới** ạ (VD: "0909123456").', 
        source: 'interaction' 
      };
    }
  }

  API.users.update(me.id, patch);
  if (typeof updateUserArea === 'function') updateUserArea();

  let msg = 'Dạ em đã cập nhật ';
  const parts = [];
  if (patch.address) parts.push(`**địa chỉ mới: ${esc(patch.address)}**`);
  if (patch.phone) parts.push(`**SĐT mới: ${esc(patch.phone)}**`);
  msg += parts.join(' và ') + ' cho anh/chị ạ. Các đơn hàng tiếp theo sẽ giao đến thông tin này.';

  return {
    type: 'text',
    message: msg,
    source: 'interaction',
    quickReplies: [
      { label: '🛒 Đặt hàng ngay', href: './order.html' },
      { label: '📝 Xem hồ sơ', href: './profile.html' }
    ]
  };
},

      function healthFilter(text, n) {
        const isStomach = /\b(dau da day|da day|kho tieu|buon non|say xe|trao nguoc|viem da day)\b/.test(n);
        const isSleep = /\b(kho ngu|mat ngu|khong ngu|lo au|stress|tim dap nhanh)\b/.test(n);
        if (!isStomach && !isSleep) return null;
        if (!/\b(goi y|tu van|mon nao|uong gi|nen uong|khong cafein|tranh cafein|it cafein|an toan|phu hop|mon gi|co gi)\b/.test(n)) return null;

        const safe = API.menu.getAvailable().filter(m => {
          const tags = (typeof LB_TAGS !== 'undefined' && LB_TAGS[m.id]) || [];
          const lv = _cafeinLevel(m.id);
          if (isStomach) {
            if (lv === 'strong') return false;
            if (tags.includes('dang')) return false;
            return true;
          }
          if (isSleep) return lv === 'none';
          return true;
        });

        if (!safe.length) {
          return { type: 'text', message: 'Dạ em chưa tìm được món phù hợp ạ. Anh/chị hỏi nhân viên giúp em nhé!', source: 'interaction' };
        }

        const scored = safe.map(m => {
          const tags = (typeof LB_TAGS !== 'undefined' && LB_TAGS[m.id]) || [];
          const lv = _cafeinLevel(m.id);
          let score = 0;
          if (isStomach) {
            if (lv === 'none') score += 5;
            else if (lv === 'light') score += 3;
            if (tags.includes('nong')) score += 2;
            if (tags.includes('beo')) score += 1;
            if (tags.includes('thanh')) score += 1;
            if (tags.includes('chua')) score += 1;
          }
          if (isSleep) {
            if (lv === 'none') score += 10;
            if (tags.includes('nong')) score += 2;
            if (tags.includes('ngot') || tags.includes('beo')) score += 1;
          }
          return { m, score };
        }).sort((a, b) => b.score - a.score).slice(0, 3);

        const reason = isStomach
          ? 'Dịu nhẹ cho dạ dày · ' + _cafeinTag(scored[0].m.id)
          : 'Không cafein, tốt cho giấc ngủ';

        const items = scored.map(x => ({
          id: x.m.id, name: x.m.name, price: x.m.price, inStock: x.m.inStock,
          badge: x.m.badge, reason
        }));

        return {
          type: 'text',
          message: isStomach
            ? `Dạ anh/chị đang **đau dạ dày**, em tránh cà phê đậm/cafein mạnh và gợi ý ${items.length} món dịu nhẹ:\n[UI_MENU]${JSON.stringify({ title: 'Dịu nhẹ cho dạ dày', items })}[/UI_MENU]`
            : `Dạ để dễ ngủ, em gợi ý ${items.length} món **không chứa cafein**:\n[UI_MENU]${JSON.stringify({ title: 'Không cafein', items })}[/UI_MENU]`,
          source: 'interaction'
        };
      },

      function recoByHistory(text, n) {
        if (!/\b(goi y|tu van|de xuat)\b/.test(n)) return null;
        if (!/\b(lich su|don hang|hay mua|da mua|da uong|quen thuoc|truoc day|gan day|so thich)\b/.test(n)) return null;

        const me = API.users.getCurrent();
        if (!me) return {
          type: 'text',
          message: '🔒 Dạ để gợi ý theo lịch sử mua hàng, anh/chị cần đăng nhập ạ.\n\nNếu chưa có tài khoản, anh/chị có thể xem món bán chạy trước nhé:',
          source: 'interaction',
          quickReplies: [{ label: '🔥 Món bán chạy', text: 'món bán chạy' }, { label: '🔑 Đăng nhập', href: './login.html' }]
        };

        const orders = API.orders.getByUser(me.id).filter(o => o.status !== 'cancelled');
        if (!orders.length) {
          return {
            type: 'text',
            message: 'Dạ anh/chị **chưa có đơn nào** để em dựa vào lịch sử ạ. Anh/chị muốn xem món bán chạy không?',
            source: 'interaction',
            quickReplies: [{ label: '🔥 Món bán chạy', text: 'món bán chạy' }, { label: '📖 Xem menu', href: './menu.html' }]
          };
        }

        const freq = {};
        orders.forEach(o => (o.items || []).forEach(it => {
          freq[it.itemId] = (freq[it.itemId] || 0) + (Number(it.qty) || 1);
        }));
        const topIds = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
        const topItems = topIds.map(id => API.menu.getById(id)).filter(m => m && m.inStock);

        if (!topItems.length) {
          return {
            type: 'text',
            message: 'Dạ các món anh/chị hay gọi đang **tạm hết**. Anh/chị muốn em gợi ý món khác không?',
            source: 'interaction',
            quickReplies: [{ label: '🔥 Món bán chạy', text: 'món bán chạy' }]
          };
        }

        const fav = topItems[0];
        const favTags = (typeof LB_TAGS !== 'undefined' && LB_TAGS[fav.id]) || [];
        const topItemIds = topItems.map(x => x.id);
        const boughtIds = new Set(Object.keys(freq));

        const similar = API.menu.getAvailable()
          .filter(m => m.id !== fav.id && !topItemIds.includes(m.id))
          .map(m => {
            const tags = (typeof LB_TAGS !== 'undefined' && LB_TAGS[m.id]) || [];
            const overlap = favTags.filter(t => tags.includes(t)).length;
            const sameCat = m.categoryId === fav.categoryId;
            return { m, score: overlap * 2 + (sameCat ? 3 : 0) + (boughtIds.has(m.id) ? 0 : 2) };
          })
          .filter(x => x.score >= 3)
          .sort((a, b) => b.score - a.score)
          .slice(0, 1)
          .map(x => x.m);

        let weather = null;
        try { weather = (typeof WeatherService !== 'undefined' && WeatherService._cache) || null; } catch (e) {}
        const isHotW = weather && weather.isHot;
        const isRainy = weather && weather.isRainy;
        const isSad = /\b(met|buon|stress|chan|co don)\b/.test(n);

        const third = API.menu.getAvailable()
          .filter(m => !topItemIds.includes(m.id) && !similar.some(x => x.id === m.id))
          .map(m => {
            const tags = (typeof LB_TAGS !== 'undefined' && LB_TAGS[m.id]) || [];
            let score = 0;
            if (isHotW && (tags.includes('giainhiet') || tags.includes('chua'))) score += 3;
            if (isRainy && tags.includes('nong')) score += 4;
            if (isSad && tags.includes('ngot')) score += 3;
            if (isSad && tags.includes('beo')) score += 2;
            return { m, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 1)
          .map(x => x.m);

        const items = [];
        items.push({
          id: fav.id, name: fav.name, price: fav.price, inStock: fav.inStock, badge: fav.badge,
          reason: '✅ Món anh/chị hay gọi · ' + _cafeinTag(fav.id)
        });
        similar.forEach(m => items.push({
          id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge,
          reason: '✨ Tương tự món yêu thích · ' + _cafeinTag(m.id)
        }));
        third.forEach(m => items.push({
          id: m.id, name: m.name, price: m.price, inStock: m.inStock, badge: m.badge,
          reason: (isHotW ? '🌞 Trời nóng, ' : isRainy ? '🌧 Trời mưa, ' : isSad ? '💛 Xoa dịu, ' : '🌟 ') + _cafeinTag(m.id)
        }));

        const noteW = isHotW ? ' (trời đang nóng)' : isRainy ? ' (trời đang mưa)' : '';
        return {
          type: 'text',
          message: `Dạ dựa vào **lịch sử mua hàng**, em gợi ý ${items.length} món${noteW} ạ:\n[UI_MENU]${JSON.stringify({ title: 'Gợi ý cho anh/chị', items })}[/UI_MENU]`,
          source: 'interaction'
        };
      },
      /* ⚡ FIX: bỏ bản sao `updateInfo` (code trùng y hệt bản ở đầu mảng
         CUSTOMER_HANDLERS) — tránh dập dính khi vá handler ở 1 trong 2 chỗ */

      function orderDetail(text, n) {
        const m = n.match(/\bod[a-z0-9]{3,}\b/);
        if (!m) return null;
        if (!/\b(xem|chi tiet|thong tin|kiem tra|tinh trang)\b/.test(n)) return null;

        const me = API.users.getCurrent();
        if (!me) return _needLogin('xem chi tiết đơn');
        
        const order = _findOrder(m[0]);
        if (!order) return { type: 'text', message: `Dạ không tìm thấy đơn **${m[0].toUpperCase()}** ạ.`, source: 'interaction' };
        
        if (order.userId !== me.id && me.role !== 'staff') {
          return { type: 'text', message: `🔒 Dạ đơn **${order.id.toUpperCase()}** không phải của tài khoản anh/chị ạ.`, source: 'interaction' };
        }
        
        return {
          type: 'text',
          message: `Dạ chi tiết đơn **${order.id}** ạ:`,
          source: 'interaction',
          cards: `[UI_LIVE_ORDER]${JSON.stringify({ ...order, staff: me.role === 'staff' })}[/UI_LIVE_ORDER]`
        };
      },

      function checkoutCart(text, n) {
        // ⚡ FIX: "xác nhận đặt hàng"/"xác nhận đơn" phải nhường cho confirmCheckout
        // (checkoutCart đứng TRƯỚC trong CUSTOMER_HANDLERS, trước đây chặn xác nhận → thẻ tái-render vô hạn, không tạo được đơn)
        if (/\b(xac nhan|dong y)\b/.test(n)) return null;
        if (!/\b(thanh toan|dat hang|dat don|mua hang|chot don)\b/.test(n)) return null;
        
        const me = API.users.getCurrent();
        if (!me) return _needLogin('thanh toán');
        
        const cart = API.cart.get() || [];
        if (!cart.length) return { type: 'text', message: 'Dạ giỏ hàng đang trống, anh/chị chọn món trước nhé!', source: 'interaction' };

        if (!me.address || !me.phone) {
          return {
            type: 'text',
            message: 'Dạ để giao hàng, em cần **địa chỉ** và **số điện thoại** của anh/chị ạ. Anh/chị vui lòng cập nhật trong trang hồ sơ nhé!',
            source: 'interaction',
            quickReplies: [{ label: '📝 Cập nhật hồ sơ', href: './profile.html' }]
          };
        }

        const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
        const shipping = 15000;
        const finalTotal = subtotal + shipping;

        AIBrain._draftSet(AIBrain._getSessionId(), {
          kind: 'checkout',
          stage: 'confirm',
          cart: cart,
          total: finalTotal,
          name: me.name,
          phone: me.phone,
          address: me.address
        });

        return {
          type: 'text',
          message: `Dạ em kiểm tra thông tin giao hàng ạ:`,
          source: 'interaction',
          cards: `[UI_ORDER_CHECKOUT]${JSON.stringify({
            name: me.name, phone: me.phone, address: me.address, total: finalTotal
          })}[/UI_ORDER_CHECKOUT]`
        };
      },

      function confirmCheckout(text, n) {
        if (!/\b(xac nhan dat hang|xac nhan don|dong y dat)\b/.test(n)) return null;
        
        const sid = AIBrain._getSessionId();
        const draft = AIBrain._loadDrafts()[sid];
        if (!draft || draft.kind !== 'checkout' || draft.stage !== 'confirm') {
          return { type: 'text', message: 'Dạ em không tìm thấy yêu cầu đặt hàng nào đang chờ ạ.', source: 'interaction' };
        }

        const me = API.users.getCurrent();
        if (!me) return _needLogin('thanh toán');

        const order = API.orders.create({
          userId: me.id,
          items: draft.cart,
          total: draft.total,
          subtotal: draft.total - 15000,
          shipping: 15000,
          discount: 0,
          promoCode: '',
          address: draft.address,
          phone: draft.phone,
          note: '',
          customerName: draft.name
        });

        API.cart.clear();
        AIBrain._draftDel(sid);

        return {
          type: 'text',
          message: `🎉 Dạ em đã **đặt hàng thành công** đơn **${order.id}** ạ!\nTổng tiền: **${API.utils.formatVND(order.total)}**.\nAnh/chị theo dõi shipper bên dưới nhé:`,
          source: 'interaction',
          cards: `[UI_LIVE_ORDER]${JSON.stringify({ ...order, staff: false })}[/UI_LIVE_ORDER]`,
          quickReplies: [
            { label: '📦 Xem lịch sử đơn', text: 'lịch sử đơn' },
            { label: '🏠 Về trang chủ', href: './index.html' }
          ]
        };
      },

      function orderStatus(text, n) {
        if (_detectOrderIntent(n) !== 'status') return null;

        const me = API.users.getCurrent();
        if (!me) return _needLogin('xem trạng thái đơn');
        const orders = (API.orders.getByUser(me.id) || []).filter(o => o.status !== 'cancelled');
        if (!orders.length) {
          return { type: 'text', message: 'Dạ anh/chị **chưa có đơn nào** ạ. Anh/chị có muốn em gợi ý món?', source: 'interaction', quickReplies: [{ label: '🍲 Gợi ý món', text: 'gợi ý món' }, { label: '📖 Xem menu', href: './menu.html' }] };
        }

        const delivering = orders.find(o => o.step === 2 || o.step === 3);
        const active = delivering || orders.find(o => o.step < 4);

        if (active) {
          const stepText = ['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][active.step] || 'Đang xử lý';
          return {
            type: 'text',
            message: `Dạ đơn **${active.id}** đang ở bước **${stepText}**. Em cập nhật trực tiếp bên dưới ạ:\n[UI_LIVE_ORDER]${JSON.stringify({ id: active.id, step: active.step, status: active.status, total: active.total, customerName: me.name, staff: false })}[/UI_LIVE_ORDER]`,
            source: 'interaction',
            quickReplies: [{ label: '📞 Gọi quán', href: 'tel:0366444038' }, { label: '🛒 Giỏ hàng', href: './cart.html' }]
          };
        }
        const last = orders[0];
        return { type: 'text', message: `Dạ đơn gần nhất **${last.id}** đã giao thành công ạ. Cảm ơn anh/chị!`, source: 'interaction' };
      },

      function bookingList(text, n) {
        // ⚡ FIX: Loại trừ các câu hỏi về đặt bàn MỚI (có số người, giờ, ngày) để nhường cho _draftEngine
        const isNewBooking = /\b(muon dat|dat ban|dat cho|dat ghe|book ban|giu ban)\b/.test(n) 
          && !/\b(cua toi|cua minh|lich su|danh sach|cac booking|da dat)\b/.test(n)
          && (
            /\b\d+\s*(nguoi|ng|khach)\b/.test(n) || 
            /\b(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s*(nguoi|ng|khach)\b/.test(n) || 
            /\b(sang mai|chieu mai|toi mai|toi nay|sang nay|chieu nay|ngay mai|ngay mot)\b/.test(n) || 
            /\b\d{1,2}\s*(h|gio|:)\s*\d{0,2}\b/.test(n)
          );
        if (isNewBooking) return null;

        const sc = _scoreIntent(n, {
          strong: [
            'booking cua toi', 'dat cho cua toi', 'dat ban cua toi',
            'lich su dat cho', 'lich su booking', 'ban toi dang giu',
            'ban cua toi', 'cho cua toi', 'booking cua minh',
            'dat cho cua minh', 'cac booking', 'danh sach booking'
          ],
          weak: ['booking', 'dat cho', 'dat ban', 'ban', 'cho'],
          allowSingleWeak: false
        });
        if (!sc) return null;
        // Nếu câu có "đơn" hoặc "order" thì ưu tiên orderList xử lý
        if (/\b(don hang|don cua|order)\b/.test(n)) return null;
        const me = API.users.getCurrent();
        if (!me) return _needLogin('xem booking');
        const bks = (API.bookings.getByUser(me.id) || []).filter(b => b.status === 'confirmed');
        if (!bks.length) {
          return {
            type: 'text',
            message: 'Dạ anh/chị **chưa có booking nào**. Muốn đặt bàn, bấm chip số người:\n[UI_BOOKING_PLAN]{"guests":[1,2,4,6,8]}[/UI_BOOKING_PLAN]',
            source: 'interaction'
          };
        }
        return {
          type: 'text',
          message: `Dạ anh/chị đang giữ **${bks.length} bàn**. Muốn hủy bàn nào, bấm **✗ Hủy**:\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks, ask: false })}[/UI_BOOKING_CANCEL]`,
          source: 'interaction'
        };
      },

      function orderList(text, n) {
        let isList = _detectOrderIntent(n) === 'list';
        if (!isList) {
          const sc = _scoreIntent(n, {
            strong: ['lich su', 'da dat', 'da mua', 'cac don', 'tat ca don', 'danh sach don', 'lich su don'],
            weak: ['don', 'xem', 'tat ca', 'cac', 'mua'],
            allowSingleWeak: false
          });
          isList = sc === 'strong' || (sc === 'weak' && /\bdon\b/.test(n));
        }
        if (!isList) return null;

        const me = API.users.getCurrent();
        if (!me) return _needLogin('xem lịch sử đơn hàng');
        
        const orders = API.orders.getByUser(me.id) || [];
        if (!orders.length) {
          return { type: 'text', message: 'Dạ anh/chị **chưa có đơn nào** ạ.\n[UI_ORDER_ADDED]{"name":"Bắt đầu gọi món","qty":0,"total":0,"empty":true}[/UI_ORDER_ADDED]', source: 'interaction' };
        }
        
        const recent = orders.slice(-5).reverse();
        return {
          type: 'text',
          message: `Dạ đây là **${orders.length} đơn** gần nhất của anh/chị ạ:\n[UI_ORDER]${JSON.stringify({ title: 'Lịch sử đơn hàng', total: orders.length, orders: recent })}[/UI_ORDER]`,
          source: 'interaction',
          quickReplies: DEFAULT_QR.orderList
        };
      },

      function points(text, n) {
        const sc = _scoreIntent(n, {
          strong: ['diem tich luy', 'diem cua toi', 'diem thuong', 'bao nhieu diem', 'tich luy diem', 'diem tich'],
          weak: ['diem', 'tich luy', 'thuong', 'reward'],
          allowSingleWeak: false
        });
        if (!sc) return null;
        const me = API.users.getCurrent();
        if (!me) return _needLogin('xem điểm');
        const orders = API.orders.getByUser(me.id).filter(o => o.step >= 4 && o.status !== 'cancelled');
        const totalSpent = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const points = Math.floor(totalSpent / 10000);
        return {
          type: 'text',
          message: `Dạ anh/chị đang có **${points} điểm** (từ ${orders.length} đơn hoàn tất):\n[UI_USER_STATS]${JSON.stringify({ points, totalSpent, orderCount: orders.length, nextRewardAt: (points + 1) * 10000 })}[/UI_USER_STATS]`,
          source: 'interaction'
        };
      },

      function vouchers(text, n) {
        const sc = _scoreIntent(n, {
          strong: [
            'voucher cua toi', 'uu dai cua toi', 'ma giam cua toi',
            'khuyen mai cua toi', 'voucher toi co', 'ma nao dung duoc',
            'ma giam nao', 'voucher nao'
          ],
          weak: ['voucher', 'uu dai', 'ma giam', 'khuyen mai', 'sale'],
          allowSingleWeak: false
        });
        if (!sc) return null;        
        const promos = API.promotions.getActive(API.utils.today());
        if (!promos.length) return { type: 'text', message: 'Dạ hiện chưa có khuyến mãi ạ.', source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ quán đang có **${promos.length} mã** khả dụng ạ:\n[UI_PROMO]${JSON.stringify(promos.map(p => ({ code: p.code, description: p.description || p.name, discount: p.discount, minOrder: p.minOrder, validTo: p.endDate })))}[/UI_PROMO]`,
          source: 'interaction'
        };
      },

      function myInfo(text, n) {
        const sc = _scoreIntent(n, {
          strong: ['thong tin cua toi', 'thong tin ca nhan', 'ho so cua toi', 'tai khoan cua toi', 'profile cua toi', 'ho so ca nhan'],
          weak: ['tai khoan', 'ho so', 'profile', 'thong tin'],
          allowSingleWeak: false
        });
        if (!sc) return null;
        
        const me = API.users.getCurrent();
        if (!me) return _needLogin('xem thông tin');
        const orders = API.orders.getByUser(me.id) || [];
        const spend = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.total) || 0), 0);
        const bks = (API.bookings.getByUser(me.id) || []).filter(b => b.status === 'confirmed');
        return {
          type: 'text',
          message: `Dạ hồ sơ của anh/chị ạ:\n[UI_MY_INFO]${JSON.stringify({ id: me.id, name: me.name, phone: me.phone, email: me.email || '', orders: orders.length, spend, bookings: bks.length })}[/UI_MY_INFO]`,
          source: 'interaction'
        };
      },

      function cartView(text, n) {
        if (!/\b(gio hang cua toi|gio cua toi|xem gio hang|gio toi co gi|co gi trong gio|gio hang)\b/.test(n)) return null;
        const items = API.cart.get() || [];
        const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
        const qty = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
        if (!items.length) {
          return {
            type: 'text',
            message: 'Dạ giỏ hàng **trống** ạ. Anh/chị muốn em gợi ý món?',
            source: 'interaction',
            quickReplies: [{ label: '🍲 Gợi ý món', text: 'gợi ý món' }, { label: '📖 Menu', href: './menu.html' }]
          };
        }
        return {
          type: 'text',
          message: `Dạ giỏ hàng có **${qty} món** — tổng **${API.utils.formatVND(total)}** ạ:\n[UI_CART_SUCCESS]${JSON.stringify({ items: items.map(i => i.name + ' × ' + i.qty).join(', '), address: 'Giao đến địa chỉ đã lưu', total })}[/UI_CART_SUCCESS]`,
          source: 'interaction'
        };
      },

      function cartEdit(text, n) {
        if (!/\b(doi size|doi topping|them topping|it da|it duong|khong da|khong duong|ghi chu|them kem)\b/.test(n)) return null;
        const cart = API.cart.get() || [];
        if (!cart.length) return { type: 'text', message: 'Dạ giỏ hàng trống, chọn món trước nhé ạ!', source: 'interaction' };
        const last = cart[cart.length - 1];
        if (/\bit da\b/.test(n))       last.note = ((last.note || '') + ', ít đá').trim().replace(/^,\s*/, '');
        if (/\bit duong\b/.test(n))    last.note = ((last.note || '') + ', ít đường').trim().replace(/^,\s*/, '');
        if (/\bkhong da\b/.test(n))    last.note = ((last.note || '') + ', không đá').trim().replace(/^,\s*/, '');
        if (/\bkhong duong\b/.test(n)) last.note = ((last.note || '') + ', không đường').trim().replace(/^,\s*/, '');
        const szMatch = n.match(/\b(?:doi|chon|lay)\s+size\s+([sml])\b/);
        if (szMatch) {
          const sz = szMatch[1].toUpperCase();
          const m = API.menu.getById(last.itemId);
          const szObj = m && Array.isArray(m.sizes) ? m.sizes.find(x => x.name === sz) : null;
          if (szObj) { last.size = sz; last.price = m.price + (szObj.extraPrice || 0); }
        }
        API.cart.set(cart);
        if (typeof updateUserArea === 'function') updateUserArea();
        return {
          type: 'text',
          message: `Dạ em đã cập nhật **${last.name}** (size ${last.size}${last.note ? ' · ' + last.note : ''}) ạ.`,
          source: 'interaction',
          quickReplies: [{ label: '🛒 Thanh toán', href: './cart.html' }, { label: '🍲 Gọi thêm', text: 'gợi ý món' }]
        };
      },

      function itemDetail(text, n) {
        if (!/\b(chi tiet|thanh phan|mo ta|gioi thieu|la gi|co gi trong)\b/.test(n)) return null;
        const menu = API.menu.getAll();
        const hit = menu.find(m => n.includes(_norm(m.name)));
        if (!hit) return null;
        return {
          type: 'text',
          message: `Dạ thông tin món **${hit.name}** ạ:`,
          source: 'interaction',
          cards: `[UI_MENU]${JSON.stringify({ title: hit.name, items: [{ id: hit.id, name: hit.name, price: hit.price, inStock: hit.inStock, badge: hit.badge, reason: (hit.description || '') + ' · ' + _cafeinTag(hit.id) }] })}[/UI_MENU]`
        };
      },

      function compare(text, n) {
        if (!/\b(so sanh|khac (gi|nhau)|nen chon|cai nao (ngon|tot|re) hon)\b/.test(n)) return null;
        const menu = API.menu.getAll();
        const found = menu.filter(m => n.includes(_norm(m.name)));
        if (found.length < 2) return null;
        const a = found[0], b = found[1];
        const catA = API.categories.getById(a.categoryId);
        const catB = API.categories.getById(b.categoryId);
        const tagOf = m => {
          const tags = (typeof LB_TAGS !== 'undefined' && LB_TAGS[m.id]) || [];
          const out = [];
          if (tags.includes('cafein'))      out.push('có caffeine');
          if (tags.includes('itngot'))      out.push('ít ngọt');
          else if (tags.includes('ngot'))   out.push('ngọt');
          if (tags.includes('dang'))        out.push('đậm');
          if (tags.includes('chua'))        out.push('chua');
          if (tags.includes('beo'))         out.push('béo');
          if (tags.includes('nong'))        out.push('dùng nóng');
          if (tags.includes('giainhiet'))   out.push('giải nhiệt');
          if (tags.includes('tinhtao'))     out.push('tỉnh táo');
          return out.slice(0, 3).join(' · ');
        };
        return {
          type: 'text',
          message: `Dạ em so sánh **${a.name}** và **${b.name}** ạ:`,
          source: 'interaction',
          cards: `[UI_COMPARE]${JSON.stringify({
            a: { id: a.id, name: a.name, price: a.price, tags: tagOf(a), categoryName: catA ? catA.name.replace(/^\S+\s/, '') : '', inStock: a.inStock },
            b: { id: b.id, name: b.name, price: b.price, tags: tagOf(b), categoryName: catB ? catB.name.replace(/^\S+\s/, '') : '', inStock: b.inStock },
            cheaper: a.price < b.price ? a.name : (b.price < a.price ? b.name : null),
            diff: Math.abs(a.price - b.price)
          })}[/UI_COMPARE]`
        };
      },

      function menuByPrice(text, n) {
        const m = n.match(/\b(duoi|toi da|khong qua|max|tam|khoang|ngan sach)\s*(\d{1,3})(?:\s?(?:k|nghin|ngan|000))?\b/);
        if (!m) return null;
        if (!/\b(mon|nuoc|do uong|uong gi|goi y|re|mem)\b/.test(n)) return null;
        const num = parseInt(m[2], 10);
        const max = num < 1000 ? num * 1000 : num;
        const items = API.menu.getAvailable().filter(x => x.price <= max).slice(0, 6);
        if (!items.length) return { type: 'text', message: `Dạ không có món nào dưới ${API.utils.formatVND(max)} ạ.`, source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ đây là **${items.length} món** dưới ${API.utils.formatVND(max)} ạ:`,
          source: 'interaction',
          cards: `[UI_MENU]${JSON.stringify({ title: 'Món dưới ' + API.utils.formatVND(max), items: items.map(x => ({ id: x.id, name: x.name, price: x.price, inStock: x.inStock, badge: x.badge })) })}[/UI_MENU]`
        };
      },

      function reorder(text, n) {
        const m = n.match(/\bdat lai\s+(?:don\s+)?(od[a-z0-9]+|don cu|don truoc|don gan nhat)\b/);
        if (!m) return null;
        const me = API.users.getCurrent();
        if (!me) return _needLogin('đặt lại đơn');
        let target = null;
        if (m[1].startsWith('od')) target = _findOrder(m[1]);
        else {
          const myOrders = API.orders.getByUser(me.id).filter(o => o.status !== 'cancelled');
          target = myOrders[myOrders.length - 1];
        }
        if (!target) return { type: 'text', message: 'Dạ em không tìm thấy đơn để đặt lại ạ.', source: 'interaction' };
        const items = target.items || [];
        if (!items.length) return { type: 'text', message: 'Dạ đơn này không có món để đặt lại ạ.', source: 'interaction' };
        items.forEach(it => {
          const qty = Math.max(1, Number(it.qty) || 1);
          for (let k = 0; k < qty; k++) {
            try { API.cart.add({ itemId: it.itemId, name: it.name, price: it.price, img: it.img, size: it.size || 'M', toppings: it.toppings || [] }); } catch (e) {}
          }
        });
        if (typeof updateUserArea === 'function') updateUserArea();
        return {
          type: 'text',
          message: `Dạ em đã thêm lại **${items.length} món** từ đơn **${target.id}** vào giỏ ạ.`,
          source: 'interaction',
          quickReplies: [{ label: '🛒 Thanh toán', href: './cart.html' }, { label: '🍲 Gọi thêm', text: 'gợi ý món' }]
        };
      },

      function rateOrder(text, n) {
        const m = n.match(/\b(danh gia|rating|review|sao)\s+(?:don\s+)?(od[a-z0-9]+)\b/);
        if (!m) return null;
        const order = _findOrder(m[2]);
        if (!order) return { type: 'text', message: 'Dạ em không tìm thấy đơn ạ.', source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ anh/chị đánh giá đơn **${order.id}** thế nào ạ?`,
          source: 'interaction',
          cards: `[UI_RATING]${JSON.stringify({ orderId: order.id })}[/UI_RATING]`
        };
      },

      function cancelBooking(text, n) {
        if (/\b(mon|gio hang|don)\b/.test(n)) return null;
        if (!/\b(huy|thu hoi)\b/.test(n)) return null;
        if (!/\b(ban|cho|booking|dat cho|bk)\b/.test(n)) return null;

        const me = API.users.getCurrent();
        if (!me) return _needLogin('hủy booking');

        const isConfirm = /\bxac nhan\b/.test(n);
        const mCode = n.match(/\bbk[a-z0-9]+\b/);

        if (mCode) {
          const targetBk = API.bookings.getAll().find(b => String(b.id).toLowerCase() === mCode[0]);

          if (!targetBk) {
            return {
              type: 'text', source: 'interaction',
              message: `🔍 Dạ em không tìm thấy booking **${mCode[0].toUpperCase()}** trong hệ thống ạ.\n\nAnh/chị kiểm tra lại mã giúp em nhé!`,
              quickReplies: [{ label: '📅 Booking của tôi', text: 'booking của tôi' }, { label: '📞 Hotline', href: 'tel:0366444038' }]
            };
          }

          if (targetBk.userId !== me.id) {
            return {
              type: 'text', source: 'interaction',
              message: `🔒 Dạ booking **${targetBk.id.toUpperCase()}** **không phải của tài khoản anh/chị**, em không thể hủy giúp ạ.\n\n⚠ Mỗi khách chỉ có thể tự hủy bàn của chính mình. Nếu cần hỗ trợ, anh/chị vui lòng gọi hotline **0366 444 038** ạ!`,
              quickReplies: [
                { label: '📞 Gọi hotline', href: 'tel:0366444038' },
                { label: '📅 Booking của tôi', text: 'booking của tôi' }
              ]
            };
          }

          if (isConfirm) {
            const res = API.bookings.cancel(targetBk.id);
            if (!res) {
              return {
                type: 'text', source: 'interaction',
                message: `⚠ Dạ em không hủy được booking **${targetBk.id}** ạ. Anh/chị thử lại hoặc gọi hotline **0366 444 038** giúp em nhé!`,
                quickReplies: [{ label: '📞 Hotline', href: 'tel:0366444038' }]
              };
            }
            return {
              type: 'text', source: 'interaction',
              message: `🚫 Dạ em đã **hủy thành công** booking **${targetBk.id}** (bàn ${targetBk.seatId}, ${targetBk.time} ${String(targetBk.date || '').toLowerCase()}) ạ.\n\nCảm ơn anh/chị đã thông báo sớm!`,
              quickReplies: [
                { label: '🪑 Đặt bàn mới', text: 'đặt bàn' },
                { label: '📖 Xem menu', href: './menu.html' }
              ]
            };
          }

          return {
            type: 'text', source: 'interaction',
            message: `Dạ anh/chị xác nhận hủy booking **${targetBk.id}** ạ?\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks: [targetBk], ask: true, confirm: true })}[/UI_BOOKING_CANCEL]`
          };
        }

        const myBks = (API.bookings.getByUser(me.id) || []).filter(b => b.status === 'confirmed');
        if (!myBks.length) {
          return {
            type: 'text', source: 'interaction',
            message: 'Dạ anh/chị không có booking nào đang hoạt động ạ.\n\nAnh/chị muốn đặt bàn mới không?',
            quickReplies: [
              { label: '🪑 Đặt bàn', text: 'đặt bàn' },
              { label: '📖 Menu', href: './menu.html' }
            ]
          };
        }

        return {
          type: 'text', source: 'interaction',
          message: `Dạ anh/chị đang giữ **${myBks.length} bàn**. Bấm **✗ Hủy** bàn cần hủy:\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks: myBks, ask: true })}[/UI_BOOKING_CANCEL]`
        };
      },

      function keepBooking(text, n) {
        if (!/^(thoi|giu ban|khong huy|khong giu|de sau|de sau a|giu nguyen|giu nguyen ban|giu don)\s*[.!?]?$/i.test(n.trim())) return null;
        return {
          type: 'text', source: 'interaction',
          message: '😊 Dạ em giữ nguyên bàn cho anh/chị ạ. Anh/chị cần gì khác không?',
          quickReplies: [
            { label: '📅 Booking của tôi', text: 'booking của tôi' },
            { label: '📖 Menu', href: './menu.html' }
          ]
        };
      },

      function hotline(text, n) {
        const sc = _scoreIntent(n, {
          strong: ['goi hotline', 'lien he quan', 'so dien thoai quan', 'goi quan', 'goi nhan vien', 'gap nhan vien', 'hotline quan', 'so hotline'],
          weak: ['hotline', 'goi', 'lien he', 'dien thoai', 'so'],
          allowSingleWeak: false
        });
        if (!sc) return null;
        if (/\b(shipper|don hang|don cua|giao hang)\b/.test(n)) return null;        
        if (/\b(wifi|dia chi|gio mo|gui xe)\b/.test(n)) return null;
        const hotline = (typeof kbGet === 'function') ? kbGet('store.hotline', '0366 444 038') : '0366 444 038';
        const tel = String(hotline).replace(/\D/g, '');
        return {
          type: 'text',
          message: `Dạ hotline CAPPAN: **${hotline}** ạ.`,
          source: 'interaction',
          quickReplies: [{ label: '📞 Gọi ngay', href: 'tel:' + tel }, { label: '💬 Chat tiếp', text: 'cần hỗ trợ thêm' }]
        };
      },

      function directions(text, n) {
        if (!/\b(chi duong|ban do|map|tim quan|duong di|di nhu the nao)\b/.test(n)) return null;
        const addr = (typeof kbGet === 'function') ? kbGet('store.address', '') : 'Công viên Gia Định, Q. Gò Vấp';
        return {
          type: 'text',
          message: `Dạ địa chỉ quán: **${addr}** ạ.`,
          source: 'interaction',
          quickReplies: [
            { label: '🗺 Mở bản đồ', href: 'https://www.google.com/maps/search/?api=1&query=10.812483,106.674875' },
            { label: '📞 Gọi quán', href: 'tel:0366444038' }
          ]
        };
      },

      function promoSearch(text, n) {
        if (/\b(cua toi|toi co|minh co|nao dung duoc)\b/.test(n)) return null;
        if (!/\b(ma giam|khuyen mai|voucher|coupon|sale|giam gia)\b/.test(n)) return null;
        const promos = API.promotions.getActive(API.utils.today());
        if (!promos.length) return null;
        return {
          type: 'text',
          message: `Dạ quán đang có **${promos.length} mã** khuyến mãi ạ:`,
          source: 'interaction',
          cards: `[UI_PROMO]${JSON.stringify(promos.slice(0, 5).map(p => ({ code: p.code, description: p.description || p.name, discount: p.discount, minOrder: p.minOrder })))}[/UI_PROMO]`
        };
      },

      function multiAdd(text, n) {
        if (!/\b(dat|lay|goi|mua)\b/.test(n)) return null;
        if (!/[,]|\bva\b|\bvoi\b/.test(n)) return null;
        const menu = API.menu.getAll();
        const found = menu.filter(m => n.includes(_norm(m.name)));
        if (found.length < 2) return null;
        const added = [];
        found.forEach(m => {
          if (!m.inStock) return;
          try { API.cart.add({ itemId: m.id, name: m.name, price: m.price, img: m.img, size: 'M', toppings: [] }); added.push(m.name); } catch (e) {}
        });
        if (!added.length) return null;
        if (typeof updateUserArea === 'function') updateUserArea();
        return {
          type: 'text',
          message: `Dạ em đã thêm **${added.length} món** vào giỏ ạ: ${added.join(', ')}.`,
          source: 'interaction',
          quickReplies: [{ label: '🛒 Thanh toán', href: './cart.html' }]
        };
      },

      function cancelMyOrder(text, n) {
        const m = n.match(/\bhuy\s+(?:don\s+)?(od[a-z0-9]+)\b/);
        if (!m) return null;
        const me = API.users.getCurrent();
        if (!me) return _needLogin('hủy đơn');
        const o = _findOrder(m[1]);
        if (!o || o.userId !== me.id) {
          return { type: 'text', message: 'Dạ em không tìm thấy đơn của anh/chị ạ.', source: 'interaction' };
        }
        if (o.status === 'cancelled') {
          return { type: 'text', message: `Dạ đơn **${o.id}** đã được hủy trước đó ạ.`, source: 'interaction' };
        }
        if (o.step >= 2) {
          return { type: 'text', message: 'Dạ đơn đã qua bước chuẩn bị, anh/chị vui lòng gọi hotline **0366 444 038** để được hỗ trợ ạ.', source: 'interaction' };
        }
        if (/\bxac nhan\b/.test(n)) {
          API.orders.cancel(o.id);
          return {
            type: 'text', source: 'interaction',
            message: `🚫 Dạ em đã **hủy đơn ${o.id}** (${API.utils.formatVND(o.total)}) ạ. Anh/chị cần em giúp gì khác không?`,
            quickReplies: QR.order
          };
        }
        return {
          type: 'text', source: 'interaction',
          message: `Dạ anh/chị xác nhận hủy đơn **${o.id}** (${API.utils.formatVND(o.total)}) ạ?`,
          quickReplies: [
            { label: '✓ Hủy đơn', text: 'xác nhận hủy đơn ' + o.id },
            { label: '🛑 Giữ đơn', text: 'giữ đơn' }
          ]
        };
      }
    ];

    /* ═══════════════ STAFF HANDLERS ═══════════════ */
    const STAFF_HANDLERS = [
      function orderAction(text, n) {
        const id = (n.match(/\bod[a-z0-9]+\b/) || [])[0];
        if (!id) return null;
        const act = /\bxac nhan huy\b|\bhuy don\b/.test(n) ? 'cancel'
          : /\bhoan tat don\b/.test(n) ? 'complete'
          : /\btien trinh\b|\bbuoc tiep\b/.test(n) ? 'advance' : null;
        if (!act) return null;

        const o = _findOrder(id);
        if (!o) return { type: 'text', message: `Dạ không tìm thấy đơn **${id.toUpperCase()}** ạ.`, source: 'interaction' };
        if (o.status === 'cancelled') return { type: 'text', message: `Dạ đơn **${o.id}** đã hủy rồi ạ.`, source: 'interaction' };

        if (act === 'cancel' && !/\bxac nhan\b/.test(n)) {
          return {
            type: 'text', source: 'interaction',
            message: `Dạ xác nhận hủy đơn **${o.id}** (${API.utils.formatVND(o.total)}) ạ?`,
            quickReplies: [
              { label: '✓ Hủy đơn', text: 'xác nhận hủy đơn ' + o.id },
              { label: 'Xem đơn', text: 'xem đơn ' + o.id }
            ]
          };
        }

        if (act === 'cancel') API.orders.cancel(o.id);
        else API.orders.updateStep(o.id, act === 'complete' ? 4 : Math.min(o.step + 1, 4));

        const f = API.orders.getById(o.id);
        return {
          type: 'text', source: 'interaction',
          message: `Dạ em đã ${act === 'cancel' ? 'hủy' : act === 'complete' ? 'hoàn tất' : 'cập nhật'} đơn **${f.id}** ạ:`,
          cards: `[UI_LIVE_ORDER]${JSON.stringify(Object.assign({}, f, { staff: true }))}[/UI_LIVE_ORDER]`
        };
      },

      function stockToggle(text, n) {
        const id = (n.match(/\bm\d{3,6}\b/) || [])[0];
        if (!id || !/\bdanh dau\b/.test(n)) return null;
        const m = API.menu.getById(id.toUpperCase());
        if (!m) return { type: 'text', message: 'Dạ em không tìm thấy món này ạ.', source: 'interaction' };

        const backToStock = /\bcon hang\b/.test(n) && !/\bhet hang\b/.test(n);
        if (backToStock) API.menu.markInStock(m.id);
        else API.menu.markOutOfStock(m.id);

        const oos = API.menu.getOutOfStock();
        return {
          type: 'text', source: 'interaction',
          message: `Dạ em đã đánh dấu **${m.name}** ${backToStock ? 'còn hàng ✅' : 'hết hàng ⛔'} ạ.`,
          cards: oos.length
            ? `[UI_OOS]${JSON.stringify({ count: oos.length, items: oos.map(x => ({ id: x.id, name: x.name })) })}[/UI_OOS]`
            : ''
        };
      },

      function kpi(text, n) {
        if (!/\b(kpi|doanh thu (hom nay|tuan|thang)?|doanh so|bao nhieu don|thong ke nhanh|tinh hinh quan)\b/.test(n)) return null;
        if (/\b(ai tra loi|ai tra loi nhieu|thong ke ai)\b/.test(n)) return null;
        const t = API.stats.today();
        return {
          type: 'text',
          message: `Dạ số liệu nhanh hôm nay ạ:`,
          source: 'interaction',
          cards: `[UI_KPI]${JSON.stringify({ today: { revenue: t.total, orders: t.count, completedCount: t.completedCount, pendingCount: t.pendingCount }, week: API.stats.thisWeek().total, month: API.stats.thisMonth().total, status: API.stats.ordersByStatus() })}[/UI_KPI]`
        };
      },

      function topItems(text, n) {
        if (!/\b(top|ban chay|ban nhieu|best.?sell|mon nao hot)\b/.test(n)) return null;
        const top = API.stats.topItems(5);
        if (!top.length) return { type: 'text', message: 'Dạ chưa có dữ liệu ạ.', source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ top 5 món bán chạy ạ:`,
          source: 'interaction',
          cards: `[UI_MENU]${JSON.stringify({ title: 'Top 5 bán chạy', items: top.map((it, i) => ({ id: 'TOP' + i, name: it.name, price: 0, inStock: true, badge: '#' + (i+1) + ' (' + it.qty + ' ly)', reason: 'DT: ' + API.utils.formatVND(it.revenue) })) })}[/UI_MENU]`
        };
      },

      function ordersByFilter(text, n) {
        if (!/\b(don nao|liet ke don|danh sach don|xem don|don dang (xu ly|giao|cho|pha))\b/.test(n)) return null;
        let filter = 'active';
        if (/\bdang giao\b/.test(n))       filter = 'shipping';
        else if (/\bdang pha\b/.test(n))    filter = 'preparing';
        else if (/\bcho xu ly\b/.test(n))   filter = 'pending';
        else if (/\bhoan tat\b/.test(n))    filter = 'completed';
        else if (/\bda huy\b/.test(n))      filter = 'cancelled';
        let list = API.orders.getAll();
        if (filter === 'active')          list = list.filter(o => o.step < 4 && o.status !== 'cancelled');
        else if (filter === 'shipping')   list = list.filter(o => (o.step === 2 || o.step === 3) && o.status !== 'cancelled');
        else if (filter === 'preparing')  list = list.filter(o => o.step === 1);
        else if (filter === 'pending')    list = list.filter(o => o.step === 0 && o.status !== 'cancelled');
        else if (filter === 'completed')  list = list.filter(o => o.step >= 4);
        else if (filter === 'cancelled')  list = list.filter(o => o.status === 'cancelled');
        if (!list.length) return { type: 'text', message: `Dạ không có đơn ${filter} ạ.`, source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ có **${list.length} đơn** (${filter}) ạ. Bấm vào **đơn** để xem chi tiết:`,
          source: 'interaction',
          cards: `[UI_ORDER]${JSON.stringify({ title: `Đơn (${filter})`, total: list.length, orders: list.slice(0, 10).map(o => ({ id: o.id, customerName: o.customerName || 'Khách', total: o.total, step: o.step, status: o.status, stepText: ['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][o.step] })) })}[/UI_ORDER]`
        };
      },

      function orderDetail(text, n) {
        const m = n.match(/\bod[a-z0-9]+\b/);
        if (!m) return null;
        if (!/\b(xem|chi tiet|trang thai|kiem tra|tinh trang)\b/.test(n)) return null;
        const order = _findOrder(m[0]);
        if (!order) return { type: 'text', message: `Dạ không tìm thấy đơn **${m[0].toUpperCase()}** ạ.`, source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ đơn **${order.id}** ạ:`,
          source: 'interaction',
          cards: `[UI_LIVE_ORDER]${JSON.stringify({ ...order, staff: true })}[/UI_LIVE_ORDER]`
        };
      },

      function bookingsToday(text, n) {
        if (!/\b(booking|dat cho|dat ban)\b/.test(n)) return null;
        if (!/\b(hom nay|today|liet ke|danh sach|co bao nhieu|xem)\b/.test(n)) return null;
        const today = API.utils.today();
        const list = API.bookings.getAll().filter(b => b.date === today && b.status === 'confirmed');
        if (!list.length) return { type: 'text', message: 'Dạ hôm nay chưa có booking nào ạ.', source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ hôm nay có **${list.length} booking** đang hoạt động ạ:`,
          source: 'interaction',
          cards: `[UI_BOOKING]${JSON.stringify({ date: today, total: list.length, bookings: list.slice(0, 10).map(b => { const u = API.users.getById(b.userId); const f = API.floors.getById(b.floorId); return { id: b.id, customerName: u ? u.name : 'Khách', seatId: b.seatId, floorName: f ? f.name : b.floorId, time: b.time, guests: b.guests, note: b.note }; }) })}[/UI_BOOKING]`
        };
      },

      function recipe(text, n) {
        if (!/\b(cong thuc|cach lam|cach pha|recipe|nguyen lieu)\b/.test(n)) return null;
        const recs = (typeof SEED_RECIPES !== 'undefined') ? SEED_RECIPES : (typeof RECIPES !== 'undefined' ? RECIPES : null);
        if (!recs) return { type: 'text', message: 'Dạ chưa có dữ liệu công thức ạ.', source: 'interaction' };
        let hit = null, hitId = null;
        for (const id in recs) {
          if (n.includes(_norm(recs[id].name)) || n.includes(id.toLowerCase())) { hit = recs[id]; hitId = id; break; }
        }
        if (!hit) return { type: 'text', message: 'Dạ em không tìm thấy công thức món này ạ.', source: 'interaction' };
        const menuItem = API.menu.getById(hitId);
        return {
          type: 'text',
          message: `Dạ công thức **${hit.name}** ạ:`,
          source: 'interaction',
          cards: `[UI_RECIPE]${JSON.stringify({
            id: hitId, name: hit.name, size: hit.size,
            price: menuItem ? menuItem.price : 0,
            ingredients: hit.ingredients, steps: hit.steps, note: hit.note
          })}[/UI_RECIPE]`
        };
      },

      function customerLookup(text, n) {
        if (!/\b(tra cuu|tim|thong tin)\s+(khach|kh)\b/.test(n)) return null;
        const m = n.match(/(0\d{9,10})/);
        if (!m) return { type: 'text', message: 'Dạ anh/chị cho em SĐT khách để tra cứu ạ.', source: 'interaction' };
        const user = API.users.getByPhone(m[1]);
        if (!user) return { type: 'text', message: `Dạ không tìm thấy khách SĐT **${m[1]}** ạ.`, source: 'interaction' };
        const orders = API.orders.getByUser(user.id) || [];
        const bks = API.bookings.getByUser(user.id) || [];
        return {
          type: 'text',
          message: `Dạ thông tin khách **${user.name}** ạ:`,
          source: 'interaction',
          cards: `[UI_CUSTOMER]${JSON.stringify([{ id: user.id, name: user.name, phone: String(user.phone || '').replace(/\d{4}$/, '****'), totalBookings: bks.length, totalOrders: orders.length, totalSpent: orders.reduce((s,o)=>s+(Number(o.total)||0),0), noShowCount: user.noShowCount || 0 }])}[/UI_CUSTOMER]`
        };
      },

      function schedule(text, n) {
        if (!/\b(lich ca|ca lam|ca sang|ca chieu|ca toi|hom nay ai|nhan vien nao|ai lam hom nay|hom nay co ai)\b/.test(n)) return null;
        const today = API.utils.today();
        const schedule = API.shifts.getSchedule();
        const shifts = API.shifts.getAll();
        const todaySched = schedule[today] || {};
        const upcoming = {};

        shifts.forEach(sh => {
          const staffNames = (todaySched[sh.id] || []).map(id => {
            const s = API.staff.getById(id);
            return s ? s.name : id;
          });
          if (staffNames.length) {
            if (!upcoming[today]) upcoming[today] = {};
            upcoming[today][sh.id] = staffNames;
          }
        });

        if (!Object.keys(upcoming).length) {
          return {
            type: 'text',
            message: `Dạ hôm nay **chưa có phân ca** ạ.\nAnh/chị xem lịch cả tuần tại [trang Lịch ca](staff-schedule.html) nhé!`,
            source: 'interaction',
            quickReplies: [{ label: '📅 Mở Lịch ca', href: './staff-schedule.html' }]
          };
        }

        const shiftsArray = shifts.map(s => ({
          id: s.id, name: s.name, timeRange: s.start + ' - ' + s.end
        }));

        return {
          type: 'text',
          message: `Dạ lịch ca hôm nay (${API.utils.today().split('-').reverse().join('/')}) ạ:`,
          source: 'interaction',
          cards: `[UI_SHIFT]${JSON.stringify({ shifts: shiftsArray, upcoming })}[/UI_SHIFT]`
        };
      },

      function stock(text, n) {
        if (!/\b(het hang|con hang|ton kho|danh dau|mon nao het)\b/.test(n)) return null;
        const oos = API.menu.getOutOfStock();
        if (!oos.length) return { type: 'text', message: 'Dạ tất cả món đều còn hàng ạ.', source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ có **${oos.length} món hết hàng**. Bấm vào món để đánh dấu còn hàng:`,
          source: 'interaction',
          cards: `[UI_OOS]${JSON.stringify({ count: oos.length, items: oos.map(m => ({ id: m.id, name: m.name })) })}[/UI_OOS]`
        };
      },

      function staffList(text, n) {
        if (!/\b(danh sach nhan vien|nhan vien nao|co ai lam|staff list|liet ke nhan vien)\b/.test(n)) return null;
        const staff = API.staff.getAll();
        if (!staff.length) return { type: 'text', message: 'Dạ chưa có nhân viên ạ.', source: 'interaction' };
        return {
          type: 'text',
          message: `Dạ có **${staff.length} nhân viên** ạ:`,
          source: 'interaction',
          cards: `[UI_STAFF]${JSON.stringify(staff.map(s => ({ id: s.id, name: s.name, role: s.role })))}[/UI_STAFF]`
        };
      }
    ];

    /* ═══════════════ MIDDLEWARE ═══════════════ */
    const _origStream = AIBrain.streamReply.bind(AIBrain);

    AIBrain.streamReply = async function (text, onChunk, opts) {
      const _t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      let sid = 'guest', role = 'guest', n = '';
      try {
        sid = this._getSessionId();
        role = this._getRole();
        n = (typeof AIInput !== 'undefined' && AIInput.normalize)
          ? AIInput.normalize(text).norm
          : _norm(text);
      } catch (e) {
        console.warn('[ChatInteractions] context error:', e);
        return _origStream(text, onChunk, opts);
      }

      const _finish = (r) => {
        if (!r) return null;
        if (typeof r.message === 'string') r.message = _sanitize(r.message);
        if (typeof r.cards === 'string')   r.cards   = _sanitize(r.cards);
        try {
          this._pushHistory(sid, 'user', text);
          // ⚡ FIX: lưu cả message lẫn cards để restoreHistory render lại đủ thẻ UI sau refresh
          // (khớp chuẩn lưu history ở brain.js: message + '\n' + cards)
          this._pushHistory(sid, 'assistant', (r.message || '') + (r.cards ? '\n' + r.cards : ''));
        } catch (e) {}
        try { if (typeof AIMetrics !== 'undefined') AIMetrics.record('interaction', r.source || 'handler'); } catch (e) {}
        try {
          if (typeof AIMetrics !== 'undefined' && AIMetrics.logTurn) {
            const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - _t0);
            AIMetrics.logTurn({ q: text, res: r, ms, ttft: ms, role });
          }
        } catch (e) {}
        if (typeof onChunk === 'function' && r.message) { try { onChunk(r.message, r.message); } catch (e) {} }
        return r;
      };

      try {
        if (typeof this._loadDrafts === 'function') this._loadDrafts();
        let inDraft = this._drafts && this._drafts[sid];

        if (inDraft) {
          const kind = inDraft.kind || '';
          /* ⚡ FIX: luồng 'checkout'/'cancel' là LÁ CHỐN XÁC NHẬN — không bị
             INTERRUPT phá draft (trước đây "xác nhận đặt hàng" chứa "đặt hàng"
             làm xóa draft → confirmCheckout báo "không có yêu cầu đang chờ") */
          if (kind === 'checkout' || kind === 'cancel') {
            const CONFIRM_KW = /\b(xac nhan|dong y)\b/;
            if (CONFIRM_KW.test(n)) inDraft = null;   // xác nhận → để handler confirm chạy với draft nguyên vẹn
          } else {
            const INTERRUPT = /\b(shipper|don (cua |hang cua )?(toi|minh)|don hang|trang thai don|tinh trang don|booking cua toi|dat cho cua toi|xem don|kiem tra don|lich su (mua|dat)|menu|thuc don|gio mo|dia chi quan|wifi|hotline|khuyen mai|voucher|diem tich|ca lam|lich ca|thanh toan|dat hang|dat mon|sua thong tin|doi dia chi|sua dia chi)\b/;
            /* ⚡ FIX: với draft 'order' (đang chọn món, chưa vào giỏ), các từ HƯỚNG TIẾN
               (thanh toán/đặt hàng/đặt món) KHÔNG được kill draft — để _orderStep tiếp tục
               hỏi cách nhận (tránh mất món đang chọn âm thầm + tạo nhầm đơn từ giỏ cũ).
               Với draft 'booking', các từ này đúng là đổi chủ đề → vẫn kill. */
            const FORWARD = /\b(thanh toan|dat hang|dat mon)\b/;
            if (INTERRUPT.test(n) && !(kind === 'order' && FORWARD.test(n))) {
              delete this._drafts[sid];
              if (typeof this._saveDrafts === 'function') this._saveDrafts();
              inDraft = null;
            }
          }
        }

        if (!inDraft) {
          const guard = difficultQuestions(text, n, role);
          if (guard) return _finish(guard);

          const cap = capabilities(text, n, role);
          if (cap) return _finish(cap);

          const ack = acknowledgements(text);
          if (ack) return _finish(ack);

          const handlers = role === 'staff' ? STAFF_HANDLERS : CUSTOMER_HANDLERS;
          for (const h of handlers) {
            try {
              const r = h.call(null, text, n, role, sid);
              if (r) {
                if (!r.quickReplies && DEFAULT_QR[h.name]) r.quickReplies = DEFAULT_QR[h.name];
                return _finish(r);
              }
            } catch (e) { console.warn('[ChatInteractions] handler error:', h.name, e); }
          }
        }
      } catch (e) {
        console.warn('[ChatInteractions] middleware error:', e);
      }

      let _r = null;
      try {
        _r = await _origStream(text, onChunk, opts);
      } catch (err) {
        console.error('[ChatInteractions] Lỗi từ AIBrain:', err);
        _r = { type: 'text', message: 'Dạ em đang bận xử lý một chút, anh/chị thử lại giúp em nhé!', source: 'error' };
      }
      
      if (_r) {
        if (typeof _r.message === 'string') _r.message = _sanitize(_r.message);
        if (typeof _r.cards === 'string')   _r.cards   = _sanitize(_r.cards);

        const isOrderKeyword = /\b(don hang|don cua toi|don cua minh|lich su|booking|shipper|dang giao)\b/.test(n);
        // ⚡ FIX: Kiểm tra xem thẻ UI đã được render trong message chưa (để không ép sai handler)
        const hasCard = (typeof _r.cards === 'string' && _r.cards.trim().length > 0) 
                     || (typeof _r.message === 'string' && _r.message.includes('[UI_'));
        if (isOrderKeyword && !hasCard && role === 'customer') {
          for (const hName of ['orderList', 'orderStatus', 'bookingList']) {
            const h = CUSTOMER_HANDLERS.find(fn => fn.name === hName);
            if (!h) continue;
            try {
              const forced = h.call(null, text, n, role, sid);
              if (forced && (forced.cards || forced.type === 'text')) {
                console.warn(`[FallbackProtection] LLM miss "${text.slice(0, 40)}" → ép handler ${hName}`);
                forced._forced = true;
                return _finish(forced);
              }
            } catch (e) {}
          }
        }

        if (!_r.quickReplies) {
          const isBlocked = /không có quyền|khong co quyen|không có thông tin|khong co thong tin|không xử lý được|khong xu ly duoc/i.test(_r.message || '');
          if (isBlocked || _r.source === 'down')               _r.quickReplies = QR.fallback;
          else if (_r.source === 'kb' || _r.source === 'rule') _r.quickReplies = QR.main;
        }
      }
      return _r;
    };

    /* ═══════════════ Extensions ═══════════════ */
    const _origSelfService = AIBrain._selfService;
    if (typeof _origSelfService === 'function') {
      AIBrain._selfService = function (n, sid, role) {
        try {
          if (role === 'customer' || role === 'guest') {
            const r = CUSTOMER_HANDLERS.find(h => h.name === 'orderStatus');
            if (r) { const out = r.call(null, '', n, role, sid); if (out) return out; }
          }
        } catch (e) {}
        return _origSelfService.call(this, n, sid, role);
      };
    }

    (function extendMenuGuard() {
      if (typeof AIBrainLegacy === 'undefined' || typeof AIBrainLegacy.reply !== 'function') return;
      const _origReply = AIBrainLegacy.reply;

      AIBrainLegacy.reply = function (text) {
        try {
          const role = (typeof API !== 'undefined' && API.users.getCurrent())
            ? API.users.getCurrent().role
            : 'customer';
          if (role === 'staff') return _origReply.apply(this, arguments);

          const n = _norm(text);
          const FAKE_DRINKS = [
            'tran chau', 'tra sua', 'matcha latte', 'flat white', 'cold brew',
            'affogato', 'macchiato', 'americano', 'capuchino', 'mojito',
            'pina colada', 'milkshake', 'ice blend', 'cappuccino sua',
            'sinh to dua', 'sinh to kiwi', 'sinh to mam xoi', 'sinh to mo'
          ];

          for (const kw of FAKE_DRINKS) {
            if (!n.includes(kw)) continue;
            const hasReal = API.menu.getAll().some(m => _norm(m.name).includes(kw));
            if (hasReal) continue;

            const sug = API.menu.getAvailable().slice(0, 3);
            const itemsPayload = sug.map(m => ({
              id: m.id, name: m.name, price: m.price,
              inStock: m.inStock, badge: m.badge,
              reason: 'Món tương tự · ' + _cafeinTag(m.id)
            }));
            return `Dạ quán **chưa có "${kw}"** trong menu ạ.\nAnh/chị tham khảo món tương tự nhé:\n[UI_MENU]${JSON.stringify({ title: `Không có "${kw}" — gợi ý thay thế`, items: itemsPayload })}[/UI_MENU]`;
          }
        } catch (e) {
          console.warn('[ChatInteractions] extendMenuGuard error:', e);
        }
        return _origReply.apply(this, arguments);
      };
    })();

    if (typeof LocalBrain !== 'undefined' && typeof LocalBrain._historyRows === 'function') {
      const _origHistoryRows = LocalBrain._historyRows;
      LocalBrain._historyRows = function () {
        const res = _origHistoryRows.call(this);
        try {
          if (res && Array.isArray(res.rows)) {
            res.rows.forEach(r => {
              if (!r.x || !r.x.m) return;
              const base = r._reason || '';
              const cafein = _cafeinTag(r.x.m.id);
              if (!base.includes(cafein)) r._reason = base + ' · ' + cafein;
            });
          }
        } catch (e) {}
        return res;
      };
    }

    if (typeof LocalBrain !== 'undefined' && typeof LocalBrain._drinkReply === 'function') {
      const _origDrinkReply = LocalBrain._drinkReply;
      LocalBrain._drinkReply = function (P, rows, raw, intro) {
        const res = _origDrinkReply.call(this, P, rows, raw, intro);
        try {
          if (res && res.recommendationData && Array.isArray(res.recommendationData.items)) {
            res.recommendationData.items.forEach(it => {
              if (!it.reason) it.reason = _cafeinTag(it.id);
              else if (!/cafein/i.test(it.reason)) it.reason = it.reason + ' · ' + _cafeinTag(it.id);
            });
          }
        } catch (e) {}
        return res;
      };
    }

    if (typeof LocalBrain !== 'undefined' && typeof LocalBrain.multiOrder === 'function') {
      const _origMultiOrder = LocalBrain.multiOrder;
      LocalBrain.multiOrder = function(raw, n) {
        if (/\b(goi y|tu van|de xuat|goi mon|liet ke)\b/.test(n)) return null;
        return _origMultiOrder.call(this, raw, n);
      };
    }

    // Khôi phục cờ và log
    window.__CAPPAN_CHAT_INTERACTIONS__ = true;
    console.info('[ChatInteractions] ✅ v3.3 (CLEAN) — Smart Intent + Fix Syntax Error');

  } catch (err) {
    console.error('[ChatInteractions] ❌ LOAD FAILED:', err);
  }
})();