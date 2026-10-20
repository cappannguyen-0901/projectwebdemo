/* ============================================================
   MAIN.JS — FINAL v3
   ⚡ Thêm feedback 👍/👎 cho câu trả lời AI
============================================================ */

/* ---------- 1. TOAST ---------- */
function showToast(msg, color = '#2E7D32') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = color;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ---------- 2. MODAL ---------- */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ---------- 3. MOBILE MENU ---------- */
function toggleMobileMenu() {
  const nav = document.getElementById('mainNav');
  if (nav) nav.classList.toggle('open');
}

/* ---------- 4. USER AREA ---------- */
function updateUserArea() {
  const el = document.getElementById('userArea');
  if (!el) return;

  const user = API.users.getCurrent();
  const isStaff = user && user.role === 'staff';

  let cartCount = 0;
  if (!isStaff) {
    try { cartCount = API.cart.get().reduce((s, i) => s + i.qty, 0); }
    catch (e) { cartCount = 0; }
  }

  const cartBtn = !isStaff ? `
    <a href="cart.html" class="cart-icon" title="Giỏ hàng">
      🛒${cartCount > 0 ? `<span class="cart-badge">${cartCount}</span>` : ''}
    </a>
  ` : '';

  if (!user) {
    el.innerHTML = `
      ${cartBtn}
      <a href="login.html" class="btn-login">Đăng nhập</a>
      <a href="register.html" class="btn-register">Đăng ký</a>
    `;
    return;
  }

  if (isStaff) {
    el.innerHTML = `
      <a href="staff-dashboard.html" class="user-link">👨‍💼 ${esc(user.name)}</a>
      <button onclick="handleLogout()">Đăng xuất</button>
    `;
    return;
  }

  el.innerHTML = `
    ${cartBtn}
    <a href="profile.html" class="user-link">👤 ${esc(user.name)}</a>
    <button onclick="handleLogout()">Đăng xuất</button>
  `;
}

/* ---------- 5. LOGOUT ---------- */
function handleLogout() {
  const existing = document.getElementById('logoutModal');
  if (existing) { existing.classList.add('open'); return; }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'logoutModal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:400px; text-align:center;">
      <div style="font-size:3rem; margin-bottom:15px;">👋</div>
      <h2 style="color:var(--brown); margin-bottom:10px;">Đăng xuất?</h2>
      <p style="color:var(--gray); margin-bottom:25px;">
        Bạn có chắc chắn muốn đăng xuất khỏi CAPPAN?
      </p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button class="btn-outline" onclick="closeModal('logoutModal')" style="min-width:120px;">Ở lại</button>
        <button class="btn" onclick="confirmLogout()" style="min-width:120px;">Đăng xuất</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('open'), 10);
}

function confirmLogout() {
  closeModal('logoutModal');
  showLogoutLoading();
  setTimeout(() => {
    try { Auth.logout(); }
    catch (e) { localStorage.removeItem('cappan_current_user'); }
    updateUserArea();
    showToast('✓ Đã đăng xuất!');
    setTimeout(() => {
      hideLogoutLoading();
      window.location.href = 'index.html';
    }, 1000);
  }, 600);
}

function showLogoutLoading() {
  let overlay = document.getElementById('logoutLoading');
  if (overlay) { overlay.classList.add('show'); return; }
  overlay = document.createElement('div');
  overlay.id = 'logoutLoading';
  overlay.className = 'logout-loading';
  overlay.innerHTML = `
    <div class="logout-loading-content">
      <div class="spinner"></div>
      <p>Đang đăng xuất...</p>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);
}
function hideLogoutLoading() {
  const o = document.getElementById('logoutLoading');
  if (o) o.classList.remove('show');
}

/* ---------- 6. CHAT TOGGLE ---------- */
function toggleChat() {
  const box = document.getElementById('chatBox');
  if (!box) return;
  box.classList.toggle('open');
  if (box.classList.contains('open')) {
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    }, 300);
  }
}

function clearChatHistory() {
  if (!confirm('Xóa toàn bộ lịch sử trò chuyện?')) return;
  if (typeof AIBrain === 'undefined') {
    showToast('⚠ AI chưa sẵn sàng', '#c62828');
    return;
  }
  const sid = AIBrain._getSessionId();
  AIBrain._clearHistory(sid);
  const body = document.getElementById('chatBody');
  if (body) {
    body.innerHTML = `
      <div class="msg bot">
        <div class="bubble">Đã xóa lịch sử. Anh/chị cần hỗ trợ gì ạ?</div>
      </div>
    `;
  }
  if (typeof renderQuickReplies === 'function') {
    setTimeout(renderQuickReplies, 300);
  }
  showToast('✓ Đã xóa lịch sử chat');
}

/* ---------- 7. MARKDOWN FILTER ---------- */
function filterMarkdown(text) {
  let clean = String(text);
  clean = clean.replace(/^\|.*\|$/gm, (line) => {
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    if (cells.every(c => /^[-:]+$/.test(c))) return '';
    return '• ' + cells.join(' — ');
  });
  clean = clean.replace(/\*\*(.+?)\*\*/g, '$1');
  clean = clean.replace(/\*(.+?)\*/g, '$1');
  clean = clean.replace(/`(.+?)`/g, '$1');
  clean = clean.replace(/~~(.+?)~~/g, '$1');
  clean = clean.replace(/^#{1,6}\s*/gm, '');
  clean = clean.replace(/^[-_=]{3,}$/gm, '');
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  return clean;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.esc = esc;

/* ---------- 8. ADD CHAT MSG ---------- */
function addChatMsg(textOrHtml, who, isHtml = false) {
  const body = document.getElementById('chatBody');
  if (!body) return;
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  const content = isHtml ? textOrHtml : escapeHtml(filterMarkdown(textOrHtml)).replace(/\n/g, '<br>');
  div.innerHTML = `<div class="bubble">${content}</div>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  return div;
}

/* ---------- 9. TYPING INDICATOR ---------- */
function showTypingIndicator(label = '') {
  const body = document.getElementById('chatBody');
  if (!body) return;
  if (document.getElementById('typingIndicator')) return;

  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typingIndicator';

  if (label) {
    div.innerHTML = `<div class="bubble"><div class="tool-indicator">${escapeHtml(label)}</div></div>`;
  } else {
    div.innerHTML = `
      <div class="bubble typing-bubble">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;
  }
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

/* ---------- 10. CONFIRM BUTTONS ---------- */
function addConfirmButtons(text, toolName, toolCallId, args) {
  const body = document.getElementById('chatBody');
  if (!body) return;

  const div = document.createElement('div');
  div.className = 'msg bot';
  const safe = escapeHtml(filterMarkdown(text));

  div.innerHTML = `
    <div class="bubble">
      ${safe.replace(/\n/g, '<br>')}
      <div class="confirm-actions" style="margin-top:10px; display:flex; gap:8px;">
        <button class="confirm-yes" style="
          padding:6px 14px; border:none; border-radius:8px;
          background:#2E7D32; color:white; cursor:pointer; font-size:13px;
        ">✓ Xác nhận</button>
        <button class="confirm-no" style="
          padding:6px 14px; border:1px solid #c62828; border-radius:8px;
          background:white; color:#c62828; cursor:pointer; font-size:13px;
        ">✗ Hủy</button>
      </div>
    </div>
  `;

  div.querySelector('.confirm-yes').onclick = async () => {
    div.querySelector('.confirm-actions').remove();
    addChatMsg('Đã xác nhận.', 'user');
    showTypingIndicator('⚙️ Đang thực hiện...');
    try {
      const res = await AIBrain.confirmPending(toolName, toolCallId, args);
      hideTypingIndicator();
      if (res && res.type === 'pending') {
        addConfirmButtons(res.message, res.toolName, res.toolCallId, res.args);
      } else {
        const m = (res && res.message) || res;
        if (UICards.has(m)) UICards.appendTo(m); else addChatMsg(m, 'bot');
      }
    } catch (e) {
      hideTypingIndicator();
      addChatMsg('Xin lỗi, thao tác bị lỗi.', 'bot');
      console.error(e);
    }
  };

  div.querySelector('.confirm-no').onclick = () => {
    div.querySelector('.confirm-actions').remove();
    const res = AIBrain.cancelPending();
    addChatMsg(res.message, 'bot');
  };

  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

/* ---------- 11. FEEDBACK 👍/👎 ---------- */
function addFeedbackButtons(msgDiv, question, answer) {
  if (!msgDiv) return;
  const wrap = msgDiv.querySelector('.bubble');
  if (!wrap) return;
  if (wrap.querySelector('.ai-feedback')) return;

  const actions = document.createElement('div');
  actions.className = 'ai-feedback';
  actions.innerHTML = `
    <button class="fb-btn fb-up" title="Hữu ích">👍</button>
    <button class="fb-btn fb-down" title="Chưa đúng">👎</button>
  `;
  wrap.appendChild(actions);

  actions.querySelector('.fb-up').onclick = () => {
    try { AIMetrics.logFeedback(question, answer, 'up'); } catch(e) {}
    actions.remove();
    showToast('✓ Cảm ơn phản hồi của bạn!');
  };
  actions.querySelector('.fb-down').onclick = () => {
    try { AIMetrics.logFeedback(question, answer, 'down'); } catch(e) {}
    actions.remove();
    showToast('⚠ Đã ghi nhận — gọi hotline 0366 474 038 nếu cần hỗ trợ ngay.', '#c62828');
  };
}

/* ---------- 12. QUICK REPLIES ---------- */
const QUICK_CUSTOMER = [
  'Còn chỗ yên tĩnh không?',
  'Menu có gì?',
  'Giờ mở cửa?',
  'Đặt chỗ thế nào?'
];

const QUICK_STAFF = [
  'Còn bao nhiêu chỗ trống?',
  'Đơn nào đang xử lý?',
  'Hôm nay có booking nào?',
  'Danh sách nhân viên'
];

function renderQuickReplies() {
  const body = document.getElementById('chatBody');
  if (!body) return;
  if (document.getElementById('quickReplies')) return;

  const isStaff = (typeof Auth !== 'undefined' && Auth.isStaff) ? Auth.isStaff() : false;
  const list = isStaff ? QUICK_STAFF : QUICK_CUSTOMER;

  const div = document.createElement('div');
  div.id = 'quickReplies';
  div.className = 'quick-replies';
  div.innerHTML = list.map(q =>
    `<button class="quick-reply-btn" onclick="sendQuickReply('${q.replace(/'/g, "\\'")}')">${q}</button>`
  ).join('');
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function sendQuickReply(text) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = text;
  sendChat();
}

/* ============================================================
   UI CARDS — Generative UI (Zero-Token)
   brain.js trả về chuỗi [UI_TYPE]{json}[/UI_TYPE]; đoạn này vẽ thành thẻ HTML.
   Mọi dữ liệu đều đi qua esc() để chống chèn HTML/JS.
   Muốn thêm thẻ mới: thêm 1 hàm vào UICards.renderers + 1 case trong
   AIToolExecutor.renderFromTemplate (brain.js).
============================================================ */
const UICards = {
  has(msg) { return typeof msg === 'string' && /\[UI_\w+\]/.test(msg); },

  /* Tách chuỗi thành các phần: text thường và thẻ */
  parse(msg) {
    const parts = [];
    const re = /\[UI_(\w+)\]([\s\S]*?)\[\/UI_\1\]/g;
    const pushText = s => { s = s.trim(); if (s) parts.push({ kind: 'text', value: s }); };
    let last = 0, m;
    while ((m = re.exec(msg)) !== null) {
      pushText(msg.slice(last, m.index));
      try { parts.push({ kind: 'card', type: m[1], data: JSON.parse(m[2]) }); }
      catch (e) { console.warn('[UICards] JSON thẻ lỗi:', m[1], e); }
      last = re.lastIndex;
    }
    pushText(msg.slice(last));
    return parts;
  },

  /* Vẽ vào khung chat. Trả về div của tin cuối để gắn 👍/👎 */
  appendTo(msg, question) {
    let lastDiv = null;
    this.parse(msg).forEach(p => {
      if (p.kind === 'text') { lastDiv = addChatMsg(p.value, 'bot'); return; }
      const fn = this.renderers[p.type];
      if (!fn) return;
      let html = '';
      try { html = fn.call(this, p.data); }
      catch (e) { console.warn('[UICards] render lỗi:', p.type, e); }
      if (html) lastDiv = addChatMsg(html, 'bot', true);
    });
    if (lastDiv && question) {
      addFeedbackButtons(lastDiv, question, String(msg).replace(/\[UI_(\w+)\][\s\S]*?\[\/UI_\1\]/g, '[thẻ $1]'));
    }
    return lastDiv;
  },

  fmt(n) {
    try { return API.utils.formatVND(n); }
    catch (e) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
  },

  /* 2026-10-20 → 20/10 */
  day(d) { return String(d || '').slice(5).split('-').reverse().join('/'); },

  /* Nhân viên không dùng giỏ hàng → ẩn nút "+ Thêm" */
  canOrder() {
    try { return !(typeof Auth !== 'undefined' && Auth.isStaff && Auth.isStaff()); }
    catch (e) { return true; }
  },

  addBtn(m) {
    if (m.inStock === false) return `<button class="btn ui-btn-sm" disabled>Hết hàng</button>`;
    return this.canOrder() ? `<button class="btn ui-btn-sm" data-ui-add="${esc(m.id)}">+ Thêm</button>` : '';
  },

  menuRow(m) {
    return `
      <div class="ui-row ui-menu-row">
        <div class="ui-grow">
          <div class="menu-item-name">${esc(m.name)}${m.badge ? ` <span class="ui-badge">${esc(m.badge)}</span>` : ''}</div>
          <div class="menu-item-price">${this.fmt(m.price)}</div>
        </div>
        ${this.addBtn(m)}
      </div>`;
  },

  renderers: {
    SEAT(d) {
      if (Array.isArray(d)) d = { available: d.length, floors: [], seats: d };   // tương thích lịch sử cũ
      const floors = (d.floors || []).length > 1
        ? `<div class="ui-chips">${d.floors.map(f =>
            `<span class="ui-chip ui-chip-muted">${esc(f.name)}: ${esc(f.available)}/${esc(f.total)}</span>`).join('')}</div>`
        : '';
      const seats = (d.seats || []).map(s =>
        `<span class="ui-chip">Bàn ${esc(s.id)} · ${esc(s.capacity)} người</span>`).join('');
      return `
        <div class="ui-card">
          <h4>🪑 ${d.title ? esc(d.title) : `Còn ${esc(d.available)} chỗ trống`}</h4>
          ${floors}
          <div class="ui-chips">${seats}</div>
          <a href="booking.html" class="btn ui-btn-block">Đặt chỗ ngay</a>
        </div>`;
    },

    PROMO(d) {
      return `
        <div class="ui-card ui-card-gold">
          <h4>🎁 Ưu đãi hôm nay</h4>
          ${(d || []).map(p => `
            <div class="ui-promo">
              <div class="ui-grow">
                <div class="ui-promo-code">${esc(p.code)}</div>
                <div class="ui-sub">${esc(p.description)}</div>
                ${p.validTo ? `<div class="ui-sub">HSD: ${esc(p.validTo)}</div>` : ''}
              </div>
              <button class="btn ui-btn-sm" data-ui-copy="${esc(p.code)}">Copy</button>
            </div>`).join('')}
        </div>`;
    },

    ORDER(d) {
      if (Array.isArray(d)) d = { total: d.length, orders: d };
      const orders = d.orders || [];
      return `
        <div class="ui-card">
          <h4>📦 ${esc(d.title || `Đơn đang xử lý (${d.total})`)}</h4>
          ${orders.map(o => {
            const cancelled = o.status === 'cancelled';
            const step = Math.max(0, Math.min(4, Number(o.step) || 0));
            return `
            <div class="ui-order${cancelled ? ' ui-dim' : ''}">
              <div class="ui-row">
                <b>#${esc(o.id)}</b>
                <span class="ui-price">${UICards.fmt(o.total)}</span>
              </div>
              <div class="ui-sub">Khách: ${esc(o.customerName)}</div>
              ${cancelled
                ? `<div class="ui-step ui-red">Đã hủy</div>`
                : `<div class="ui-progress"><div style="width:${step / 4 * 100}%"></div></div>
                   <div class="ui-step">${esc(o.stepText || ['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][step])}</div>`}
            </div>`;
          }).join('')}
          <a href="staff-orders.html" class="btn ui-btn-block">Quản lý đơn</a>
        </div>`;
    },

    KPI(d) {
      const st = d.status || {};
      const chips = [['Chờ xử lý', st.pending], ['Đang pha', st.preparing], ['Đang giao', st.shipping],
                     ['Hoàn tất', st.completed], ['Đã hủy', st.cancelled]]
        .filter(([, n]) => n !== undefined)
        .map(([l, n]) => `<span class="ui-chip ui-chip-muted">${l}: ${esc(n)}</span>`).join('');
      return `
        <div class="ui-card">
          <h4>📊 Doanh thu</h4>
          <div class="ui-kpi-main">
            <div class="ui-sub">Hôm nay</div>
            <div class="ui-kpi-value">${UICards.fmt(d.today && d.today.revenue)}</div>
            <div class="ui-sub">${esc(d.today && d.today.orders)} đơn</div>
          </div>
          <div class="ui-kpi-grid">
            <div><div class="ui-sub">Tuần này</div><b>${UICards.fmt(d.week)}</b></div>
            <div><div class="ui-sub">Tháng này</div><b>${UICards.fmt(d.month)}</b></div>
          </div>
          <div class="ui-chips">${chips}</div>
          <a href="staff-dashboard.html" class="btn ui-btn-block">Mở dashboard</a>
        </div>`;
    },

    BOOKING(d) {
      const rows = (d.bookings || []);
      return `
        <div class="ui-card">
          <h4>📅 Booking hôm nay (${esc(d.total)})</h4>
          ${rows.map(b => `
            <div class="ui-order">
              <div class="ui-row"><b>${esc(b.time)} · Bàn ${esc(b.seatId)}</b><span class="ui-sub">${esc(b.floorName)}</span></div>
              <div class="ui-sub">${esc(b.customerName)} · ${esc(b.guests)} khách</div>
              ${b.note ? `<div class="ui-sub">📝 ${esc(b.note)}</div>` : ''}
            </div>`).join('')}
          ${d.total > rows.length ? `<div class="ui-sub ui-more">…và ${d.total - rows.length} booking khác</div>` : ''}
        </div>`;
    },

    OOS(d) {
      return `
        <div class="ui-card">
          <h4>🚫 Món hết hàng (${esc(d.count)})</h4>
          <div class="ui-sub ui-mb">Bấm vào món để đánh dấu còn hàng lại</div>
          <div class="ui-chips">
            ${(d.items || []).map(m => `<button class="ui-chip ui-chip-btn" data-ui-say="Đánh dấu món ${esc(m.id)} còn hàng trở lại">${esc(m.name)}</button>`).join('')}
          </div>
        </div>`;
    },

    STAFF(d) {
      return `
        <div class="ui-card">
          <h4>👥 Nhân viên (${(d || []).length})</h4>
          ${(d || []).map(p => `
            <div class="ui-row ui-line"><span><b>${esc(p.name)}</b></span><span class="ui-sub">${esc(p.role)} · ${esc(p.id)}</span></div>`).join('')}
        </div>`;
    },

    SHIFT(d) {
      const name = {}; (d.shifts || []).forEach(s => { name[s.id] = s; });
      return `
        <div class="ui-card">
          <h4>🗓 Lịch phân ca</h4>
          ${Object.keys(d.upcoming || {}).map(date => `
            <div class="ui-cat"><span>${esc(UICards.day(date))}</span></div>
            ${Object.entries(d.upcoming[date]).map(([sid, list]) => `
              <div class="ui-line">
                <div class="ui-sub"><b>${esc((name[sid] && name[sid].name) || sid)}</b>${name[sid] ? ` (${esc(name[sid].timeRange)})` : ''}</div>
                <div>${(list || []).map(esc).join(', ')}</div>
              </div>`).join('')}
          `).join('')}
        </div>`;
    },

    CUSTOMER(d) {
      return `
        <div class="ui-card">
          <h4>🧑 Khách hàng</h4>
          ${(d || []).map(c => `
            <div class="ui-order">
              <div class="ui-row"><b>${esc(c.name)}</b><span class="ui-sub">${esc(c.phone)}</span></div>
              <div class="ui-chips ui-mt">
                <span class="ui-chip ui-chip-muted">Booking: ${esc(c.totalBookings)}</span>
                <span class="ui-chip ui-chip-muted">Đơn: ${esc(c.totalOrders)}</span>
                <span class="ui-chip ${c.noShowCount > 0 ? 'ui-chip-warn' : 'ui-chip-muted'}">No-show: ${esc(c.noShowCount)}</span>
              </div>
              ${(c.recentOrders || []).length ? `<div class="ui-sub">Đơn gần nhất: ${c.recentOrders.map(o => `#${esc(o.id)} (${UICards.fmt(o.total)})`).join(', ')}</div>` : ''}
            </div>`).join('')}
        </div>`;
    },

    MENU(d) {
      if (Array.isArray(d)) d = { total: d.length, items: d };
      const items = d.items || [];
      const more = d.total > items.length ? `<div class="ui-sub ui-more">…và ${d.total - items.length} món khác</div>` : '';
      return `
        <div class="ui-card">
          <h4>🥤 ${esc(d.title || 'Món gợi ý')}</h4>
          ${items.map(m => this.menuRow(m)).join('')}
          ${more}
          <a href="menu.html" class="btn-outline ui-btn-block">Xem toàn bộ Menu</a>
        </div>`;
    },

    CATALOG(d) {
      return `
        <div class="ui-card">
          <h4>📖 Menu CAPPAN (${esc(d.totalItems)} món)</h4>
          ${(d.categories || []).map(c => `
            <div class="ui-cat"><span>${esc(c.name)}</span><span class="ui-sub">${esc(c.count)} món</span></div>
            ${(c.items || []).map(m => this.menuRow(m)).join('')}
          `).join('')}
          <a href="menu.html" class="btn ui-btn-block">Xem toàn bộ Menu</a>
        </div>`;
    },

    STORE(d) {
      const wifi = d.wifi && typeof d.wifi === 'object' ? `${d.wifi.name} / ${d.wifi.password}` : d.wifi;
      const tel = String(d.hotline || '').replace(/\s/g, '');
      return `
        <div class="ui-card ui-center">
          <h4>☕ CAPPAN</h4>
          <p class="ui-sub ui-mb">${esc(d.slogan)}</p>
          <div class="ui-info">
            <p>📍 <b>Địa chỉ:</b> ${esc(d.address)}</p>
            <p>🕐 <b>Giờ mở:</b> ${esc(d.hours)}</p>
            ${wifi ? `<p>📶 <b>Wifi:</b> ${esc(wifi)}</p>` : ''}
            ${d.parking ? `<p>🛵 <b>Gửi xe:</b> ${esc(d.parking)}</p>` : ''}
          </div>
          <div class="ui-row ui-gap">
            <a href="tel:${esc(tel)}" class="btn ui-btn-half">📞 Gọi ngay</a>
            <a href="contact.html" class="btn-outline ui-btn-half">🗺 Xem bản đồ</a>
          </div>
        </div>`;
    }
  }
};
window.UICards = UICards;

/* ---------- Thêm món vào giỏ từ thẻ Menu ---------- */
function quickOrder(itemId) {
  let item = null;
  try { item = API.menu.getById(itemId); } catch (e) {}
  if (!item) { showToast('⚠ Không tìm thấy món này', '#c62828'); return; }
  if (item.inStock === false) { showToast(`⚠ ${item.name} đã hết hàng`, '#c62828'); return; }
  if (typeof Auth !== 'undefined' && Auth.isStaff && Auth.isStaff()) {
    showToast('Tài khoản nhân viên không dùng giỏ hàng', '#856404'); return;
  }

  // ⚡ FIX: Bấm "+ Thêm" trên thẻ thì thêm luôn size M. Nếu muốn chọn size/topping thì sang trang Menu.
  try {
    API.cart.add({ itemId: item.id, name: item.name, price: item.price, img: item.img, size: 'M', toppings: [] });
    showToast(`✓ Đã thêm ${item.name} vào giỏ`);
    updateUserArea();
  } catch (e) {
    console.warn('[quickOrder] lỗi thêm giỏ:', e);
    showToast('⚠ Chưa thêm được vào giỏ, anh/chị thử lại nhé', '#c62828');
  }


  // API.cart.add(item) nhận 1 object, tự đặt qty = 1 và gộp theo (itemId + size)
  try {
    API.cart.add({ itemId: item.id, name: item.name, price: item.price, img: item.img, size: '' });
    showToast(`✓ Đã thêm ${item.name} vào giỏ`);
    updateUserArea();
  } catch (e) {
    console.warn('[quickOrder] lỗi thêm giỏ:', e);
    showToast('⚠ Chưa thêm được vào giỏ, anh/chị thử lại nhé', '#c62828');
  }
}
window.quickOrder = quickOrder;

/* Click trong thẻ (event delegation → hoạt động cả với thẻ khôi phục từ lịch sử) */
document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('[data-ui-copy]');
  if (copyBtn) {
    const code = copyBtn.dataset.uiCopy;
    const ok = () => showToast(`✓ Đã copy mã ${code}`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(ok, () => showToast(`Mã của bạn: ${code}`, '#856404'));
    } else {
      showToast(`Mã của bạn: ${code}`, '#856404');
    }
    return;
  }
  const addBtn = e.target.closest('[data-ui-add]');
  if (addBtn) { quickOrder(addBtn.dataset.uiAdd); return; }
  const sayBtn = e.target.closest('[data-ui-say]');
  if (sayBtn) sendQuickReply(sayBtn.dataset.uiSay);
});

/* ============================================================
   SEND CHAT — STREAMING
============================================================ */
async function sendChat() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  if (typeof AIBrain === 'undefined' || typeof AIBrain.streamReply !== 'function') {
    addChatMsg(text, 'user');
    input.value = '';
    addChatMsg('Xin lỗi, em chưa sẵn sàng. Anh/chị thử lại sau nhé!', 'bot');
    return;
  }

  const qr = document.getElementById('quickReplies');
  if (qr) qr.remove();

  document.querySelectorAll('#chatBody .confirm-actions').forEach(el => el.remove());

  addChatMsg(text, 'user');
  input.value = '';

  const body = document.getElementById('chatBody');
  if (!body) return;

  let botDiv = null;
  let streamTxt = null;
  let cursorEl = null;
  let renderedLength = 0;
  let firstChunkReceived = false;

  const ensureBubble = () => {
    if (botDiv) return;
    botDiv = document.createElement('div');
    botDiv.className = 'msg bot';
    botDiv.innerHTML =
      '<div class="bubble">' +
        '<span class="stream-text"></span>' +
        '<span class="streaming-cursor">|</span>' +
      '</div>';
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;
    streamTxt = botDiv.querySelector('.stream-text');
    streamTxt.style.whiteSpace = 'pre-wrap';
    cursorEl  = botDiv.querySelector('.streaming-cursor');
  };

  const removeCursor = () => {
    if (cursorEl && cursorEl.parentNode) cursorEl.remove();
    cursorEl = null;
  };

  const resetBubble = () => {
    if (botDiv && botDiv.parentNode) botDiv.remove();
    botDiv = null;
    streamTxt = null;
    cursorEl = null;
    renderedLength = 0;
    firstChunkReceived = false;
  };
  

  const onChunk = (delta, full) => {
    if (!firstChunkReceived) {
      firstChunkReceived = true;
      hideTypingIndicator();
      ensureBubble();
    }
    streamTxt.textContent = filterMarkdown(full);
    renderedLength = full.length;
    body.scrollTop = body.scrollHeight;
  };

  AIBrain._onPhaseChange = (phase) => {
    if (phase === 'stream2') {
      removeCursor();
      resetBubble();
      showTypingIndicator();
    }
  };

  showTypingIndicator();

  try {
    const response = await AIBrain.streamReply(text, onChunk);

    if (response && response.type === 'pending') {
      hideTypingIndicator();
      if (botDiv && botDiv.parentNode) botDiv.remove();
      botDiv = null;
      addConfirmButtons(response.message, response.toolName, response.toolCallId, response.args);
      return;
    }

    hideTypingIndicator();
    removeCursor();

    // ⚡ GENERATIVE UI: có thẻ [UI_...] → bỏ bong bóng stream, vẽ thẻ (xem UICards ở trên)
    if (response && response.type === 'text' && UICards.has(response.message)) {
      if (botDiv && botDiv.parentNode) botDiv.remove();
      botDiv = null;
      UICards.appendTo(response.message, text);
      return;
    }

    const finalMsg = (response && response.message) ? String(response.message) : '';

    if (!firstChunkReceived) {
      ensureBubble();
      removeCursor();
      streamTxt.textContent = finalMsg.trim()
        ? filterMarkdown(finalMsg)
        : 'Xin lỗi, em chưa có câu trả lời cho câu hỏi này. Anh/chị hỏi lại giúp em nhé!';
    } else {
      if (finalMsg.trim()) {
        streamTxt.textContent = filterMarkdown(finalMsg);
      } else if (streamTxt && !streamTxt.textContent.trim()) {
        streamTxt.textContent = 'Xin lỗi, em chưa có câu trả lời cho câu hỏi này. Anh/chị hỏi lại giúp em nhé!';
      }
    }

    // ⚡ FIX: gắn feedback 👍/👎 sau khi có câu trả lời
    if (botDiv) addFeedbackButtons(botDiv, text, finalMsg);

    // ⚡ Bộ não nội bộ: câu giải thích (đã stream ở trên) + thẻ có nút bấm
    if (response && response.cards) UICards.appendTo(response.cards);

  } catch (e) {
    console.error('[sendChat] lỗi:', e);
    hideTypingIndicator();
    removeCursor();
    if (!firstChunkReceived) {
      ensureBubble();
      streamTxt.textContent = 'Xin lỗi, em đang gặp sự cố kỹ thuật. Anh/chị thử lại nhé!';
    } else if (streamTxt && !streamTxt.textContent.trim()) {
      streamTxt.textContent = 'Xin lỗi, em đang gặp sự cố kỹ thuật. Anh/chị thử lại nhé!';
    }
  } finally {
    AIBrain._onPhaseChange = null;
  }
}

/* ============================================================
   13. RESTORE CHAT HISTORY
============================================================ */
function restoreChatHistory() {
  try {
    if (typeof AIBrain === 'undefined') return;

    const sid = AIBrain._getSessionId();
    const role = AIBrain._getRole();
    AIBrain._getHistory(sid, role);

    const history = AIBrain.histories[sid] || [];
    if (history.length <= 1) return;

    const body = document.getElementById('chatBody');
    if (!body) return;

    body.innerHTML = '';

    let rendered = 0;
    history.forEach(item => {
      if (item.role === 'user') {
        addChatMsg(item.content, 'user');
        rendered++;
      } else if (item.role === 'assistant' && item.content) {
        if (UICards.has(item.content)) UICards.appendTo(item.content);   // khôi phục cả thẻ
        else addChatMsg(item.content, 'bot');
        rendered++;
      }
    });
    console.log(`[Chat] Đã khôi phục ${rendered} tin`);
  } catch (e) {
    console.error('[Chat] Lỗi khôi phục:', e);
  }
}

/* ============================================================
   14. INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateUserArea();

  if (document.getElementById('chatBox')) {
    setTimeout(renderQuickReplies, 800);
    restoreChatHistory();
  }
});

function clearAICache() {
  if (typeof ResponseCache === 'undefined') {
    showToast('⚠ Cache chưa khởi tạo', '#c62828');
    return;
  }
  const size = ResponseCache.size();
  if (size === 0) {
    showToast('Cache đang trống', '#856404');
    return;
  }
  if (!confirm(`Xóa ${size} mục cache?`)) return;
  ResponseCache.clear();
  showToast(`✓ Đã xóa ${size} mục cache`);
}
window.clearAICache = clearAICache;

/* ============================================================
   15. EXPORT
============================================================ */
window.toggleMobileMenu    = toggleMobileMenu;
window.toggleChat          = toggleChat;
window.clearChatHistory    = clearChatHistory;
window.sendChat            = sendChat;
window.sendQuickReply      = sendQuickReply;
window.renderQuickReplies  = renderQuickReplies;
window.handleLogout        = handleLogout;
window.confirmLogout       = confirmLogout;
window.openModal           = openModal;
window.closeModal          = closeModal;
window.updateUserArea      = updateUserArea;
window.showToast           = showToast;
window.addChatMsg          = addChatMsg;
window.showTypingIndicator = showTypingIndicator;
window.hideTypingIndicator = hideTypingIndicator;
window.filterMarkdown      = filterMarkdown;
window.escapeHtml          = escapeHtml;
window.addFeedbackButtons  = addFeedbackButtons;