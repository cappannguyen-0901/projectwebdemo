/* ============================================================
   CHAT INTERACTIONS v2.0 — "Chatbot là dashboard thu nhỏ"
   - KHÔNG sửa file gốc (brain.js, main.js, chat-panel.js…)
   - Load SAU handover.js (cuối pipeline AI)
   - Middleware wrap AIBrain.streamReply → xử lý trước, fallback sau
   - Idempotent + fail-safe + không throw
   - Bao gồm: 30+ handler + 4 renderer override + sanitize token
============================================================ */
(function () {
  'use strict';

  if (window.__CAPPAN_CHAT_INTERACTIONS__) return;
  window.__CAPPAN_CHAT_INTERACTIONS__ = true;

  if (typeof AIBrain === 'undefined') {
    console.warn('[ChatInteractions] AIBrain chưa load — skip');
    return;
  }

  /* ============================================================
     Helpers
  ============================================================ */
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

  /* ============================================================
     1. FIX BUG: _getRole thiếu → chat tự reset khi F5
  ============================================================ */
  if (typeof AIBrain._getRole !== 'function') {
    AIBrain._getRole = function () {
      const sid = this._getSessionId();
      if (sid.indexOf('staff_') === 0)    return 'staff';
      if (sid.indexOf('customer_') === 0) return 'customer';
      return 'guest';
    };
  }

  /* ============================================================
     2. RENDERER OVERRIDES — 4 loại (LIVE_ORDER / COMPARE / RECIPE / SHIFT)
  ============================================================ */
  if (typeof UICards !== 'undefined' && UICards.renderers) {

    /* -------- 2.1 LIVE_ORDER: giữ data-live-order để realtime 6s -------- */
    /* -------- 2.1 LIVE_ORDER: timeline + BẢN ĐỒ MINI + shipper info -------- */
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
          <iframe
            data-shipper-map="${esc(d.id)}"
            src="https://www.google.com/maps?q=${coord}&z=15&output=embed"
            width="100%" height="180"
            style="border:0;display:block;"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            title="Vị trí shipper"></iframe>
          <div style="position:absolute;top:8px;left:8px;background:rgba(255,255,255,0.95);padding:4px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;color:#2E7D32;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
            🛵 Đang trên đường giao
          </div>
        </div>
        <div class="ui-live-shipper" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0 4px;font-size:0.82rem;color:#5D4037;">
          <span>👤 <b>${esc(shipperName)}</b></span>
          <span>·</span>
          <a href="tel:${String(shipperPhone).replace(/\s/g, '')}" style="color:#2E7D32;font-weight:700;text-decoration:none;">📞 ${esc(shipperPhone)}</a>
          <span class="ui-live-loc" style="flex:1;text-align:right;color:#8a7a6a;">📍 ${esc(loc)}</span>
        </div>
      ` : '';

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

    /* -------- 2.2 COMPARE: thêm yếu tố + nút "+ Thêm" xuống dưới -------- */
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
            ${m.caffeine !== undefined ? `<div class="ui-sub" style="text-align:center;">${m.caffeine ? '☕ Có caffeine' : '🚫 Không caffeine'}</div>` : ''}
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
    /* -------- 2.1b CHỐNG NHÁY: override _paintLive để diff-based update -------- */
    /* main.js gốc re-render toàn bộ innerHTML mỗi 6s → iframe Google Maps bị load lại
       (nháy trắng, giật). Override để chỉ update timeline + progress + iframe.src
       khi step THỰC SỰ đổi → iframe giữ nguyên nếu step chưa đổi. */
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

            /* Nếu KHÔNG đổi → bỏ qua hoàn toàn (iframe không reload) */
            if (newStep === oldStep && newStatus === oldStatus) return;

            el.dataset.currentStep = String(newStep);
            el.dataset.currentStatus = newStatus;

            /* 1. Timeline */
            const timeline = el.querySelector('.ui-live-body');
            if (timeline) {
              timeline.innerHTML = steps.map((s, i) => {
                const cls = i < newStep ? ' done' : (i === newStep && !cancelled ? ' current' : '');
                return `<div class="ui-live-step${cls}"><span class="ui-live-dot">${i < newStep ? '✓' : (i + 1)}</span><span>${esc(s)}</span></div>`;
              }).join('');
            }

            /* 2. Progress bar */
            const bar = el.querySelector('.ui-live-bar > div');
            if (bar) bar.style.width = (cancelled ? 100 : (newStep / 4 * 100)) + '%';

            /* 3. LIVE badge trên h4 */
            const h4 = el.querySelector('h4');
            if (h4) {
              const live = newStep >= 2 && newStep < 4 && !cancelled;
              h4.innerHTML = `🛵 Trạng thái đơn ${esc(id)} ${live ? '<span class="ui-live-flag">● LIVE</span>' : ''}`;
            }

            /* 4. Info text (HỦY / HOÀN TẤT) */
            const info = el.querySelector('.ui-act-info');
            if (info) {
              const base = esc(o.customerName || 'Khách') + ' · <b>' + UICards.fmt(o.total) + '</b>';
              info.innerHTML = base + (cancelled
                ? ' · <b style="color:#c62828;">ĐÃ HỦY</b>'
                : (newStep >= 4 ? ' · <b style="color:#2E7D32;">HOÀN TẤT</b>' : ''));
            }

            /* 5. Iframe src — chỉ update khi step đổi */
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

            /* 6. Location text */
            const locEl = el.querySelector('.ui-live-loc');
            if (locEl) locEl.textContent = '📍 ' + (locations[newStep] || '');
          });
        } catch (e) {
          /* Fallback: dùng bản gốc nếu override lỗi (thà nháy còn hơn crash) */
          try { _origPaintLive.call(this, id, o); } catch (err) {}
        }
      };
    }
    /* -------- 2.3 RECIPE: ẩn "Giá: 0đ", tự lookup từ menu -------- */
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

    /* -------- 2.4 SHIFT: phòng thủ shape (shifts array) -------- */
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
  }

  /* ============================================================
     3. CUSTOMER HANDLERS (19 loại)
  ============================================================ */
  const CUSTOMER_HANDLERS = [
    function orderStatus(text, n) {
      if (!/\b(trang thai don|tinh trang don|don (cua )?(toi|minh|em) (dang|toi|dau|sao)|shipper (dau|toi|o dau)|giao (chua|toi|dau)|don hang (toi|dau|sao)|kiem tra don|xem don (cua )?(toi|minh)|don dang (giao|xu ly)|don toi dau)\b/.test(n)) return null;
      const me = API.users.getCurrent();
      if (!me) return _needLogin('xem trạng thái đơn');
      const orders = (API.orders.getByUser(me.id) || []).filter(o => o.status !== 'cancelled');
      if (!orders.length) {
        return {
          type: 'text',
          message: 'Dạ anh/chị **chưa có đơn nào** ạ. Anh/chị có muốn em gợi ý món?',
          source: 'interaction',
          quickReplies: [{ label: '🍲 Gợi ý món', text: 'gợi ý món' }, { label: '📖 Xem menu', href: './menu.html' }]
        };
      }
      const active = orders.find(o => o.step < 4);
      if (active) {
        return {
          type: 'text',
          message: `Dạ đơn **${active.id}** đang ở bước **${['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][active.step]}**. Em cập nhật trực tiếp bên dưới ạ:\n[UI_LIVE_ORDER]${JSON.stringify({ id: active.id, step: active.step, status: active.status, total: active.total, customerName: me.name, staff: false })}[/UI_LIVE_ORDER]`,
          source: 'interaction'
        };
      }
      const last = orders[0];
      return {
        type: 'text',
        message: `Dạ đơn gần nhất **${last.id}** đã giao thành công ạ. Cảm ơn anh/chị!`,
        source: 'interaction',
        quickReplies: [
          { label: '🛍 Đặt lại', text: 'đặt lại đơn ' + last.id },
          { label: '⭐ Đánh giá', text: 'đánh giá đơn ' + last.id }
        ]
      };
    },

    function bookingList(text, n) {
      if (!/\b(booking cua toi|dat cho cua toi|dat ban cua toi|ban da dat|ban cua toi|cho cua toi|lich su dat cho|ban toi dang giu)\b/.test(n)) return null;
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
      if (/\b(dang giao|dang xu ly|shipper|trang thai)\b/.test(n)) return null;
      if (!/\b(don hang cua toi|don cua toi|don cua minh|lich su mua hang|lich su dat hang|don nao cua toi|don toi|don gan nhat)\b/.test(n)) return null;
      const me = API.users.getCurrent();
      if (!me) return _needLogin('xem đơn');
      const orders = API.orders.getByUser(me.id) || [];
      if (!orders.length) {
        return {
          type: 'text',
          message: 'Dạ anh/chị **chưa có đơn nào** ạ.\n[UI_ORDER_ADDED]{"name":"Bắt đầu gọi món","qty":0,"total":0,"empty":true}[/UI_ORDER_ADDED]',
          source: 'interaction'
        };
      }
      const recent = orders.slice(-5).reverse();
      return {
        type: 'text',
        message: `Dạ đây là **${orders.length} đơn** gần nhất ạ:\n[UI_ORDER]${JSON.stringify({ title: 'Đơn của tôi', total: orders.length, orders: recent })}[/UI_ORDER]`,
        source: 'interaction'
      };
    },

    function points(text, n) {
      if (!/\b(diem (tich luy|cua toi|thuong)|bao nhieu diem|diem tich)\b/.test(n)) return null;
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
      if (!/\b(voucher|uu dai|ma giam|khuyen mai|sale) (cua toi|toi co|minh co|nao dung duoc)\b/.test(n)) return null;
      const promos = API.promotions.getActive(API.utils.today());
      if (!promos.length) return { type: 'text', message: 'Dạ hiện chưa có khuyến mãi ạ.', source: 'interaction' };
      return {
        type: 'text',
        message: `Dạ quán đang có **${promos.length} mã** khả dụng ạ:\n[UI_PROMO]${JSON.stringify(promos.map(p => ({ code: p.code, description: p.description || p.name, discount: p.discount, minOrder: p.minOrder, validTo: p.endDate })))}[/UI_PROMO]`,
        source: 'interaction'
      };
    },

    function myInfo(text, n) {
      if (!/\b(thong tin cua toi|thong tin ca nhan|ho so cua toi|tai khoan cua toi|profile cua toi)\b/.test(n)) return null;
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
        cards: `[UI_MENU]${JSON.stringify({ title: hit.name, items: [{ id: hit.id, name: hit.name, price: hit.price, inStock: hit.inStock, badge: hit.badge, reason: hit.description || '' }] })}[/UI_MENU]`
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
      if (m[1].startsWith('od')) target = API.orders.getById(m[1].toUpperCase());
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
      const order = API.orders.getById(m[2].toUpperCase());
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
      const bks = (API.bookings.getByUser(me.id) || []).filter(b => b.status === 'confirmed');
      if (!bks.length) return { type: 'text', message: 'Dạ anh/chị không có booking đang hoạt động ạ.', source: 'interaction' };
      const mCode = n.match(/\bbk[a-z0-9]+\b/);
      const target = mCode ? bks.find(b => String(b.id).toLowerCase() === mCode[0]) : (bks.length === 1 ? bks[0] : null);
      if (target) {
        return {
          type: 'text',
          message: `Dạ anh/chị xác nhận hủy booking **${target.id}** (bàn ${target.seatId}) ạ?\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks: [target], ask: true, confirm: true })}[/UI_BOOKING_CANCEL]`,
          source: 'interaction'
        };
      }
      return {
        type: 'text',
        message: `Dạ anh/chị đang giữ **${bks.length} bàn**. Bấm **✗ Hủy** bàn cần hủy:\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks, ask: true })}[/UI_BOOKING_CANCEL]`,
        source: 'interaction'
      };
    },

    function hotline(text, n) {
      if (!/\b(goi hotline|lien he quan|so dien thoai quan|goi quan|goi nhan vien|gap nhan vien|hotline)\b/.test(n)) return null;
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
      const m = n.match(/\b(huy|huy don)\s+(?:don\s+)?(od[a-z0-9]+)\b/);
      if (!m) return null;
      const me = API.users.getCurrent();
      if (!me) return _needLogin('hủy đơn');
      const o = API.orders.getById(m[2].toUpperCase());
      if (!o || o.userId !== me.id) return { type: 'text', message: 'Dạ em không tìm thấy đơn của anh/chị ạ.', source: 'interaction' };
      if (o.step >= 2) return { type: 'text', message: 'Dạ đơn đã qua bước chuẩn bị, vui lòng gọi hotline **0366 444 038** ạ.', source: 'interaction' };
      return {
        type: 'text',
        message: `Dạ anh/chị xác nhận hủy đơn **${o.id}** (${API.utils.formatVND(o.total)}) ạ?\n[UI_BOOKING_CANCEL]${JSON.stringify({ bks: [{ id: o.id, seatId: 'Đơn', guests: o.items?.length || 0, time: '', date: '', _isOrder: true }], ask: true, confirm: true })}[/UI_BOOKING_CANCEL]`,
        source: 'interaction'
      };
    }
  ];

  /* ============================================================
     4. STAFF HANDLERS (10 loại)
  ============================================================ */
  const STAFF_HANDLERS = [
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
      const order = API.orders.getById(m[0].toUpperCase());
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

  /* ============================================================
     5. MIDDLEWARE: Wrap AIBrain.streamReply
  ============================================================ */
  const _origStream = AIBrain.streamReply.bind(AIBrain);

  AIBrain.streamReply = async function (text, onChunk, opts) {
    try {
      const sid = this._getSessionId();
      const role = this._getRole();
      const n = (typeof AIInput !== 'undefined' && AIInput.normalize)
        ? AIInput.normalize(text).norm
        : _norm(text);

      const inDraft = this._drafts && this._drafts[sid];

      if (!inDraft) {
        const handlers = role === 'staff' ? STAFF_HANDLERS : CUSTOMER_HANDLERS;
        for (const h of handlers) {
          try {
            const r = h.call(null, text, n, role, sid);
            if (r) {
              if (typeof r.message === 'string') r.message = _sanitize(r.message);
              if (typeof r.cards === 'string')   r.cards   = _sanitize(r.cards);
              try {
                this._pushHistory(sid, 'user', text);
                this._pushHistory(sid, 'assistant', r.message || r.cards || '');
              } catch (e) {}
              try { if (typeof AIMetrics !== 'undefined') AIMetrics.record('interaction', h.name); } catch (e) {}
              if (typeof onChunk === 'function' && r.message) { try { onChunk(r.message, r.message); } catch (e) {} }
              return r;
            }
          } catch (e) { console.warn('[ChatInteractions] handler error:', h.name, e); }
        }
      }
    } catch (e) {
      console.warn('[ChatInteractions] middleware error:', e);
    }

    const _r = await _origStream(text, onChunk, opts);
    if (_r) {
      if (typeof _r.message === 'string') _r.message = _sanitize(_r.message);
      if (typeof _r.cards === 'string')   _r.cards   = _sanitize(_r.cards);
    }
    return _r;
  };

  /* ============================================================
     6. Mở rộng _selfService (LIVE_ORDER cho "trạng thái đơn")
  ============================================================ */
  const _origSelfService = AIBrain._selfService;
  if (typeof _origSelfService === 'function') {
    AIBrain._selfService = function (n, sid, role) {
      try {
        if (role === 'customer' || role === 'guest') {
          const r = CUSTOMER_HANDLERS[0].call(null, '', n, role, sid);
          if (r) return r;
        }
      } catch (e) {}
      return _origSelfService.call(this, n, sid, role);
    };
  }

  /* ============================================================
     7. Mở rộng guard menu bịa (trân châu, cold brew, matcha latte…)
  ============================================================ */
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
          'pina colada', 'milkshake', 'ice blend', 'cappuccino sua'
        ];

        for (const kw of FAKE_DRINKS) {
          if (!n.includes(kw)) continue;
          const hasReal = API.menu.getAll().some(m => _norm(m.name).includes(kw));
          if (hasReal) continue;

          const sug = API.menu.getAvailable().slice(0, 3);
          const itemsPayload = sug.map(m => ({
            id: m.id, name: m.name, price: m.price,
            inStock: m.inStock, badge: m.badge, reason: 'Món tương tự'
          }));
          return `Dạ quán **chưa có "${kw}"** trong menu ạ.\nAnh/chị tham khảo món tương tự nhé:\n[UI_MENU]${JSON.stringify({ title: `Không có "${kw}" — gợi ý thay thế`, items: itemsPayload })}[/UI_MENU]`;
        }
      } catch (e) {
        console.warn('[ChatInteractions] extendMenuGuard error:', e);
      }
      return _origReply.apply(this, arguments);
    };
  })();

  console.info('[ChatInteractions] ✅ v2.0 — 30+ handlers, 4 renderer overrides, sanitize token');
})();