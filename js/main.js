/* ============================================================
   MAIN.JS — FINAL v5 (FIX TOÀN DIỆN LỖI QA)
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
  const willOpen = !box.classList.contains('open');
  box.classList.toggle('open');
  
  // ⚡ Lưu trạng thái mở/đóng vào localStorage
  localStorage.setItem('cappan_chat_is_open', willOpen ? '1' : '0');

  if (willOpen) {
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
      hideNewMsgPill();
      const body = document.getElementById('chatBody');
      if (body) {
        body._stick = true;
        body.scrollTop = body.scrollHeight;
      }
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
    // ⚡ FIX: reset pill + scroll
    hideNewMsgPill();
    body._stick = true;
    body.scrollTop = 0;
  }
  if (typeof renderQuickReplies === 'function') setTimeout(renderQuickReplies, 300);
  showToast('✓ Đã xóa lịch sử chat');
} 

/* ---------- 6b. CLEAR AI CACHE (FIX C-17) ---------- */
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
window.clearAICache = clearAICache; // ⚡ FIX C-17

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

/* ============================================================
   CHAT SMART SCROLL + PILL (Luôn hiện khi cuộn lên)
============================================================ */
function hideNewMsgPill() {
  const p = document.getElementById('chatNewPill');
  if (p) p.classList.remove('show');
}

function showNewMsgPill(body) {
  body = body || document.getElementById('chatBody');
  if (!body) return;

  const panel = document.getElementById('chatPanel');
  if (panel && panel.classList.contains('collapsed')) return;
  const box = document.getElementById('chatBox');
  if (box && !box.classList.contains('open')) return;

  let p = document.getElementById('chatNewPill');
  if (!p) {
    p = document.createElement('button');
    p.type = 'button';
    p.id = 'chatNewPill';
    p.className = 'chat-new-pill';
    p.textContent = '↓ Cuộn xuống';
    p.onclick = () => {
      body._stick = true;
      body.scrollTop = body.scrollHeight;
      hideNewMsgPill();
    };
    // Gắn vào ngay trong khung chat cha
    const parent = body.closest('.chat-panel') || body.closest('.chat-box') || body.parentElement;
    parent.appendChild(p);
  }
  p.classList.add('show');
}

function bindChatScroll(body) {
  if (!body || body._scrollBound) return;
  body._scrollBound = true;
  body._stick = true;
  
  body.addEventListener('scroll', () => {
    // Khoảng cách từ vị trí hiện tại đến đáy
    const dist = body.scrollHeight - body.scrollTop - body.clientHeight;
    
    // Nếu cách đáy > 120px => Đang xem tin cũ -> HIỆN NÚT
    if (dist > 120) {
      body._stick = false;
      showNewMsgPill(body);
    } else {
      // Nếu kéo xuống gần đáy -> ẨN NÚT
      body._stick = true;
      hideNewMsgPill();
    }
  }, { passive: true });
}

function chatScroll(force) {
  const body = document.getElementById('chatBody');
  if (!body) return;
  bindChatScroll(body);

  if (force || body._stick !== false) {
    body._stick = true;
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
      hideNewMsgPill();
    });
  }
}
/* ---------- 8. ADD CHAT MSG ---------- */
function addChatMsg(textOrHtml, who, isHtml = false) {
  const body = document.getElementById('chatBody');
  if (!body) return;
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  const content = isHtml ? textOrHtml : escapeHtml(filterMarkdown(textOrHtml)).replace(/\n/g, '<br>');
  div.innerHTML = `<div class="bubble">${content}</div>`;
  body.appendChild(div);
  chatScroll(who === 'user');
  return div;
}

function showTypingIndicator(label = '') {
  const body = document.getElementById('chatBody');
  if (!body) return;
  const existing = document.getElementById('typingIndicator');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typingIndicator';
  if (label) {
    div.innerHTML = `<div class="bubble"><div class="tool-indicator">${escapeHtml(label)}</div></div>`;
  } else {
    div.innerHTML = `<div class="bubble typing-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
    /* ⚡ Đổi nhãn sau 1.5s để người xem demo không tưởng treo */
    setTimeout(() => {
      const ind = document.getElementById('typingIndicator');
      if (ind && !ind.querySelector('.tool-indicator')) {
        ind.querySelector('.bubble').innerHTML = '<div class="tool-indicator">🤖 Đang phân tích…</div>';
      }
    }, 1500);
  }
  body.appendChild(div);
  chatScroll();
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
  chatScroll(true);
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
  chatScroll();
}

function sendQuickReply(text) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = text;
  sendChat();
}

/* ============================================================
   UI CARDS — Generative UI (Zero-Token)
============================================================ */
const UICards = {
  has(msg) { return typeof msg === 'string' && /\[UI_\w+\]/.test(msg); },

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

  mask(p) {
    const t = String(p == null ? '' : p);
    if (!t || t.includes('*')) return t;
    return t.length <= 6 ? '****' : t.slice(0, 4) + '****' + t.slice(-2);
  },

  day(d) { return String(d || '').slice(5).split('-').reverse().join('/'); },

  canOrder() {
    try { return !(typeof Auth !== 'undefined' && Auth.isStaff && Auth.isStaff()); }
    catch (e) { return true; }
  },

    addBtn(m) {
    if (m.noBtn) return ''; // ⚡ Dùng cho cart items
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
      if (Array.isArray(d)) d = { available: d.length, floors: [], seats: d };
      const floors = (d.floors || []).length > 1
        ? `<div class="ui-chips">${d.floors.map(f =>
            `<span class="ui-chip ui-chip-muted">${esc(f.name)}: ${esc(f.available)}/${esc(f.total)}</span>`).join('')}</div>`
        : '';
      const canBook = UICards.canOrder();
      const seats = (d.seats || []).map(s => canBook
        ? `<a class="ui-chip ui-chip-btn" href="booking.html?seat=${encodeURIComponent(s.id)}" title="Đặt bàn ${esc(s.id)}">Bàn ${esc(s.id)} · ${esc(s.capacity)} người</a>`
        : `<span class="ui-chip">Bàn ${esc(s.id)} · ${esc(s.capacity)} người</span>`).join('');
      return `
        <div class="ui-card">
          <h4>🪑 ${d.title ? esc(d.title) : `Còn ${esc(d.available)} chỗ trống`}</h4>
          ${floors}
          <div class="ui-chips">${seats}</div>
          ${canBook ? `<div class="ui-sub ui-more">Bấm vào bàn để chọn và đặt ngay</div>
          <a href="booking.html" class="btn ui-btn-block">Đặt chỗ ngay</a>` : ''}
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
      const t = d.today || {};
      const st = d.status || {};
      const chips = [['Chờ xử lý', st.pending], ['Đang pha', st.preparing], ['Đang giao', st.shipping],
                     ['Hoàn tất', st.completed], ['Đã hủy', st.cancelled]]
        .filter(([, n]) => n !== undefined)
        .map(([l, n]) => `<span class="ui-chip ui-chip-muted">${l}: ${esc(n)}</span>`).join('');

      const sub = (Number(t.completedCount) || 0) + (Number(t.pendingCount) || 0) > 0
        ? `${esc(t.completedCount || 0)} hoàn tất · ${esc(t.pendingCount || 0)} đang xử lý`
        : `${esc(t.orders || 0)} đơn`;

      return `
        <div class="ui-card">
          <h4>📊 Doanh thu</h4>
          <div class="ui-kpi-main">
            <div class="ui-sub">Hôm nay</div>
            <div class="ui-kpi-value">${UICards.fmt(t.revenue)}</div>
            <div class="ui-sub">${sub}</div>
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
      // ⚡ Đã thêm nút Quản lý nhân viên (A-13)
      return `
        <div class="ui-card">
          <h4>👥 Nhân viên (${(d || []).length})</h4>
          ${(d || []).map(p => `
            <div class="ui-row ui-line"><span><b>${esc(p.name)}</b></span><span class="ui-sub">${esc(p.role)} · ${esc(p.id)}</span></div>`).join('')}
          <a href="staff-schedule.html" class="btn ui-btn-block">Quản lý nhân viên</a>
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
      const st = { confirmed: 'đang hoạt động', completed: 'hoàn tất', cancelled: 'đã hủy', pending: 'chờ' };
      return `
        <div class="ui-card">
          <h4>🧑 Hồ sơ khách hàng</h4>
          ${(d || []).map(c => {
            const bks = (c.recentBookings || []).slice(-3).reverse();
            return `
            <div class="ui-order">
              <div class="ui-row"><b>${esc(c.name)}</b><span class="ui-sub">${esc(UICards.mask(c.phone))}</span></div>
              ${Number(c.noShowCount) >= 2 ? `<div class="ui-warn">⚠️ Khách này có ${esc(c.noShowCount)} lần no-show</div>` : ''}
              <div class="ui-chips ui-mt">
                <span class="ui-chip ui-chip-muted">Booking: ${esc(c.totalBookings)}</span>
                <span class="ui-chip ui-chip-muted">Đơn: ${esc(c.totalOrders)}</span>
                ${c.totalSpent !== undefined ? `<span class="ui-chip">Chi tiêu: ${UICards.fmt(c.totalSpent)}</span>` : ''}
                <span class="ui-chip ${c.noShowCount > 0 ? 'ui-chip-warn' : 'ui-chip-muted'}">No-show: ${esc(c.noShowCount)}</span>
              </div>
              ${bks.length ? `<div class="ui-sub">Đặt chỗ gần nhất: ${bks.map(b => `${esc(b.seatId)} (${esc(UICards.day(b.date))} ${esc(b.time)} · ${esc(st[b.status] || b.status)})`).join('; ')}</div>` : ''}
              ${(c.recentOrders || []).length ? `<div class="ui-sub">Đơn gần nhất: ${c.recentOrders.map(o => `#${esc(o.id)} (${UICards.fmt(o.total)})`).join(', ')}</div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
    },

    COMPARE(d) {
      const col = (m, win) => `
        <div class="ui-cmp-col${win ? ' ui-cmp-win' : ''}">
          ${win ? '<span class="ui-badge">Rẻ hơn</span>' : ''}
          <div class="menu-item-name">${esc(m.name)}</div>
          <div class="menu-item-price">${UICards.fmt(m.price)}</div>
          <div class="ui-sub">${esc(m.tags || '')}</div>
          ${UICards.addBtn(m)}
        </div>`;
      return `
        <div class="ui-card">
          <h4>⚖️ So sánh món</h4>
          <div class="ui-cmp">${col(d.a, d.cheaper && d.cheaper === d.a.name)}${col(d.b, d.cheaper && d.cheaper === d.b.name)}</div>
          ${d.diff ? `<div class="ui-sub ui-more">Chênh lệch ${UICards.fmt(d.diff)}</div>` : '<div class="ui-sub ui-more">Hai món cùng giá</div>'}
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
    },

    COMBO(d) {
      return `
        <div class="ui-card ui-card-gold">
          <h4>🎉 Combo ưu đãi</h4>
          ${(d || []).map(c => `
            <div class="ui-promo">
              <div class="ui-grow">
                <div class="ui-promo-code">${esc(c.name)}</div>
                <div class="ui-sub">${(c.items || []).map(esc).join(' + ')}</div>
                <div class="ui-sub" style="text-decoration:line-through;opacity:.6;">
                  ${UICards.fmt(c.originalPrice)}
                </div>
              </div>
              <div style="text-align:right;">
                <div class="ui-price" style="font-size:16px;">${UICards.fmt(c.comboPrice)}</div>
                <div class="ui-sub">Tiết kiệm ${UICards.fmt(c.originalPrice - c.comboPrice)}</div>
                <button class="btn ui-btn-sm" data-ui-combo="${esc(c.id)}">Mua</button>
              </div>
            </div>
          `).join('')}
        </div>`;
    },

    SHIFT_PERSONAL(d) {
      return `
        <div class="ui-card">
          <h4>🗓 Ca của ${esc(d.staffName || 'bạn')} (7 ngày tới)</h4>
          ${(d.shifts || []).map(s => `
            <div class="ui-line">
              <div class="ui-row">
                <b>${esc(s.dateLabel)}</b>
                <span class="ui-chip">${esc(s.shiftName)}</span>
              </div>
              <div class="ui-sub">🕐 ${esc(s.time)}</div>
              ${(s.coworkers || []).length ? `<div class="ui-sub">👥 Cùng ca: ${s.coworkers.map(esc).join(', ')}</div>` : ''}
            </div>
          `).join('')}
          ${(!d.shifts || !d.shifts.length) ? '<p class="ui-sub">Không có ca nào.</p>' : ''}
        </div>`;
    },

    LIVE_ORDER(d) {
      const o = d.order || {};
      const step = Math.max(0, Math.min(4, Number(o.step) || 0));
      return `
        <div class="ui-card">
          <h4>🛵 Đơn #${esc(o.id)} đang giao</h4>
          <div class="ui-progress"><div style="width:${step / 4 * 100}%"></div></div>
          <div class="ui-sub ui-mt">
            📍 ${esc(d.location || '—')}<br>
            ⏱️ Dự kiến: ${step < 4 ? '~' + ((5 - step) * 5) + ' phút' : 'Đã giao'}
            ${d.shipperName ? `<br>🛵 ${esc(d.shipperName)} · ${esc(d.shipperPhone || '')}` : ''}
          </div>
          <iframe src="https://www.google.com/maps?q=${esc(d.coord)}&z=15&output=embed"
                  style="width:100%; height:180px; border:0; border-radius:8px; margin-top:8px;"
                  loading="lazy" title="Bản đồ shipper"></iframe>
          <a href="tracking.html" class="btn ui-btn-block">Xem chi tiết →</a>
        </div>`;
    },
    RECIPE(d) {
      return `
        <div class="ui-card">
          <h4>📖 Công thức: ${esc(d.name)}</h4>
          <div class="ui-chips">
            <span class="ui-chip ui-chip-muted">Size: ${esc(d.size || 'Chuẩn')}</span>
            <span class="ui-chip">Giá: ${UICards.fmt(d.price)}</span>
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
    },
  }
};
window.UICards = UICards;

/* ---------- Thêm món vào giỏ từ thẻ Menu ---------- */
function quickOrder(itemId) {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) {
    showToast('🔒 Vui lòng đăng nhập để đặt món!', '#c62828');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  let item = null;
  try { item = API.menu.getById(itemId); } catch (e) {}
  if (!item) { showToast('⚠ Không tìm thấy món này', '#c62828'); return; }
  if (item.inStock === false) { showToast(`⚠ ${item.name} đã hết hàng`, '#c62828'); return; }
  if (Auth.isStaff()) {
    showToast('Tài khoản nhân viên không dùng giỏ hàng', '#856404');
    return;
  }

  try {
    API.cart.add({
      itemId: item.id, name: item.name, price: item.price,
      img: item.img, size: 'M', toppings: []
    });
    showToast(`✓ Đã thêm ${item.name} vào giỏ`);
    updateUserArea();
  } catch (e) {
    console.warn('[quickOrder] lỗi thêm giỏ:', e);
    showToast('⚠ Chưa thêm được vào giỏ, anh/chị thử lại nhé', '#c62828');
  }
}
window.quickOrder = quickOrder;

/* ---------- Thêm combo vào giỏ (FIX B-17) ---------- */
function addComboToCart(comboId) {
  const combo = (typeof KB !== 'undefined' && KB.combos)
    ? KB.combos.find(c => c.id === comboId) : null;
  if (!combo) { showToast('Không tìm thấy combo', '#c62828'); return; }
  if (!Auth.isLoggedIn()) { showToast('🔒 Vui lòng đăng nhập', '#c62828'); return; }

  // ⚡ P1-1: Thêm combo như 1 line item duy nhất — tránh bug discount × qty
  const items = (combo.itemIds || []).map(id => API.menu.getById(id)).filter(Boolean);
  if (!items.length) { showToast('Combo không còn món hợp lệ', '#c62828'); return; }

  API.cart.add({
    itemId: 'COMBO_' + combo.id,
    name: `${combo.name} — ${items.map(m => m.name).join(' + ')}`,
    price: combo.comboPrice,
    img: items[0].img,
    size: 'Combo',
    toppings: []
  });

  updateUserArea();
  const saved = combo.originalPrice - combo.comboPrice;
  showToast(`✓ Đã thêm combo "${combo.name}" (Tiết kiệm ${API.utils.formatVND(saved)})`);
}
window.addComboToCart = addComboToCart;

/* Click trong thẻ (event delegation) */
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
  if (sayBtn) { sendQuickReply(sayBtn.dataset.uiSay); return; }
  const comboBtn = e.target.closest('[data-ui-combo]');
  if (comboBtn) { addComboToCart(comboBtn.dataset.uiCombo); return; }
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

  let botDiv = null, streamTxt = null, cursorEl = null, firstChunkReceived = false;

  const ensureBubble = () => {
    if (botDiv) return;
    botDiv = document.createElement('div');
    botDiv.className = 'msg bot';
    botDiv.innerHTML = '<div class="bubble"><span class="stream-text"></span><span class="streaming-cursor">|</span></div>';
    body.appendChild(botDiv);
    chatScroll();
    streamTxt = botDiv.querySelector('.stream-text');
    streamTxt.style.whiteSpace = 'pre-wrap';
    cursorEl = botDiv.querySelector('.streaming-cursor');
  };
  const removeCursor = () => { if (cursorEl && cursorEl.parentNode) cursorEl.remove(); cursorEl = null; };
  const resetBubble = () => {
    if (botDiv && botDiv.parentNode) botDiv.remove();
    botDiv = null; streamTxt = null; cursorEl = null; firstChunkReceived = false;
  };
  const onChunk = (delta, full) => {
    if (!firstChunkReceived) { firstChunkReceived = true; hideTypingIndicator(); ensureBubble(); }
    streamTxt.textContent = filterMarkdown(full);
    chatScroll();
  };

  AIBrain._onPhaseChange = (phase) => {
    if (phase === 'stream2') { removeCursor(); resetBubble(); showTypingIndicator(); }
    else if (phase === 'tool') { removeCursor(); resetBubble(); showTypingIndicator('⚙️ Đang thực hiện...'); }
  };

  showTypingIndicator();

  try {
    const raw = await AIBrain.streamReply(text, onChunk);
    const safe = (typeof AIOutput !== 'undefined' && AIOutput.isValidResponse(raw))
      ? raw
      : (typeof AIOutput !== 'undefined' ? AIOutput.build('error', { source: 'validation' }) : (raw || { type: 'text', message: '' }));

    hideTypingIndicator();
    removeCursor();

    /* Nhánh 1: pending — cần confirm */
    if (safe.type === 'pending') {
      if (botDiv && botDiv.parentNode) botDiv.remove();
      botDiv = null;
      addConfirmButtons(safe.message, safe.toolName, safe.toolCallId, safe.args);
      return;
    }

    /* Nhánh 2: cards riêng (LocalBrain / structured) */
    if (safe.cards && UICards.has(safe.cards)) {
      if (!firstChunkReceived) {
        ensureBubble();
        removeCursor();
        streamTxt.textContent = filterMarkdown(safe.message || '');
      }
      UICards.appendTo(safe.cards, text);
      if (botDiv) addFeedbackButtons(botDiv, text, safe.message || '');
      return;
    }

    /* Nhánh 3: message có UI_ inline (template) */
    if (safe.message && UICards.has(safe.message)) {
      if (botDiv && botDiv.parentNode) botDiv.remove();
      botDiv = null;
      UICards.appendTo(safe.message, text);
      return;
    }

    /* Nhánh 4: text thuần */
    const finalMsg = safe.message || '';
    if (!firstChunkReceived) {
      ensureBubble(); removeCursor();
      streamTxt.textContent = finalMsg.trim()
        ? filterMarkdown(finalMsg)
        : 'Xin lỗi, em chưa có câu trả lời cho câu hỏi này. Anh/chị hỏi lại giúp em nhé!';
    } else if (finalMsg.trim()) {
      streamTxt.textContent = filterMarkdown(finalMsg);
    } else if (streamTxt && !streamTxt.textContent.trim()) {
      streamTxt.textContent = 'Xin lỗi, em chưa có câu trả lời cho câu hỏi này. Anh/chị hỏi lại giúp em nhé!';
    }
    if (botDiv) addFeedbackButtons(botDiv, text, finalMsg);
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
        if (UICards.has(item.content)) UICards.appendTo(item.content);
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
   13b. VOICE INPUT
============================================================ */
function initVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = document.getElementById('chatInput');
  if (!SR || !input || document.getElementById('chatMic')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'chatMic';
  btn.className = 'chat-mic';
  btn.title = 'Nói để nhập';
  btn.setAttribute('aria-label', 'Nhập bằng giọng nói');
  btn.textContent = '🎤';
  input.parentNode.insertBefore(btn, input.nextSibling);

  const idle = input.placeholder;
  let rec = null, listening = false;

  btn.addEventListener('click', () => {
    if (listening && rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'vi-VN';
    rec.interimResults = true;
    rec.continuous = false;
    const base = input.value.trim() ? input.value.trim() + ' ' : '';

    rec.onstart = () => { listening = true; btn.classList.add('on'); input.placeholder = 'Đang nghe…'; };
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      input.value = base + t;
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast('⚠ Chưa cấp quyền micro cho trình duyệt', '#c62828');
      else if (e.error === 'no-speech') showToast('Không nghe thấy giọng nói', '#856404');
      else if (e.error !== 'aborted') showToast('⚠ Không nhận được giọng nói, thử lại nhé', '#c62828');
    };
    rec.onend = () => { listening = false; btn.classList.remove('on'); input.placeholder = idle; input.focus(); };
    try { rec.start(); } catch (err) {}
  });
}

/* ============================================================
   13c. REFRESH SEAT CARDS AFTER BOOKING
============================================================ */
/* ⚡ FIX H3: dùng thẳng API, không gọi LLM (tiết kiệm ~1 lượt gọi/booking) */
function refreshSeatCardsAfterBooking() {
  const box = document.getElementById('chatBox');
  if (!box || !box.classList.contains('open')) return;
  if (typeof API === 'undefined' || typeof UICards === 'undefined') return;

  setTimeout(() => {
    try {
      const avail = API.seats.getAvailable();
      if (!avail.length) {
        addChatMsg('Dạ sau khi đặt, hiện quán đã hết chỗ trống ạ.', 'bot');
        return;
      }
      const byFloor = {};
      avail.forEach(s => { byFloor[s.floorId] = (byFloor[s.floorId] || 0) + 1; });
      const floors = Object.keys(byFloor).map(fid => ({
        name: (API.floors.getById(fid) || {}).name || fid,
        available: byFloor[fid],
        total: API.seats.getByFloor(fid).length
      }));
      const card = `[UI_SEAT]${JSON.stringify({
        available: avail.length,
        floors,
        seats: avail.slice(0, 6).map(s => ({
          id: s.id, capacity: s.capacity, zone: s.zone,
          floor: (API.floors.getById(s.floorId) || {}).name || s.floorId
        }))
      })}[/UI_SEAT]`;
      UICards.appendTo(card);
    } catch (e) {
      console.warn('[refreshSeatCardsAfterBooking] lỗi:', e);
    }
  }, 400);
}
window.refreshSeatCardsAfterBooking = refreshSeatCardsAfterBooking;

/* ============================================================
   14. INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateUserArea();
  bindChatScroll(document.getElementById('chatBody'));
  initVoiceInput();

  // ⚡ KHÔI PHỤC TRẠNG THÁI KHUNG CHAT KHI CHUYỂN TRANG
  const chatBox = document.getElementById('chatBox');
  if (chatBox && localStorage.getItem('cappan_chat_is_open') === '1') {
    chatBox.classList.add('open');
  }

  if (typeof AIMetrics !== 'undefined' && AIMetrics.installFlushHooks) {
    AIMetrics.installFlushHooks();
  }

  if (document.getElementById('chatBox')) {
    setTimeout(renderQuickReplies, 800);
    const isStaffPage = (document.body.dataset.page || '').startsWith('staff-');
    if (!isStaffPage) restoreChatHistory();
  }
});



/* ============================================================
   15. EXPORT
============================================================ */
window.toggleMobileMenu    = toggleMobileMenu;
window.toggleChat          = toggleChat;
window.clearChatHistory    = clearChatHistory;
window.clearAICache        = clearAICache;
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
// ⚡ P0-4: Fallback cho openAuth (nếu còn chỗ nào gọi)
window.openAuth = function() {
  window.location.href = 'login.html';
};
/* ============================================================
   17. TÍNH NĂNG KÉO GIÃN KHUNG CHAT (CUSTOMER)
============================================================ */
function initChatResizer() {
  const chatBox = document.getElementById('chatBox');
  if (!chatBox || document.getElementById('chatBoxResizer')) return;

  const resizer = document.createElement('div');
  resizer.id = 'chatBoxResizer';
  resizer.className = 'chat-box-resizer';
  chatBox.appendChild(resizer);

  let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;

  const start = (clientX, clientY) => {
    if (window.innerWidth <= 768) return; // Bỏ qua trên mobile
    resizing = true;
    sx = clientX; sy = clientY;
    sw = chatBox.offsetWidth; sh = chatBox.offsetHeight;
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  const move = (clientX, clientY) => {
    if (!resizing) return;
    let w = sw + (sx - clientX);
    let h = sh + (sy - clientY);
    w = Math.max(320, Math.min(w, window.innerWidth - 40));
    h = Math.max(400, Math.min(h, window.innerHeight - 100));
    chatBox.style.setProperty('width',  w + 'px', 'important');
    chatBox.style.setProperty('height', h + 'px', 'important');
  };

  const end = () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Lưu kích thước mới
    localStorage.setItem('cappan_chat_customer_w', chatBox.offsetWidth);
    localStorage.setItem('cappan_chat_customer_h', chatBox.offsetHeight);
  };

  // Bắt sự kiện Chuột
  resizer.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX, e.clientY); });
  document.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  document.addEventListener('mouseup', end);

  // Bắt sự kiện Cảm ứng
  resizer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches[0]) start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (resizing && e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchend', end);
}

// Kích hoạt khi tải xong
if (document.readyState === 'complete') {
  initChatResizer();
} else {
  window.addEventListener('load', initChatResizer, { once: true });
}
/* ============================================================
   UPGRADE 9: Chat message copy button
============================================================ */
(function() {
  function attachCopyButtons() {
    const body = document.getElementById('chatBody');
    if (!body) return;

    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1 || !n.classList.contains('msg') || !n.classList.contains('bot')) return;
        const bubble = n.querySelector('.bubble');
        if (!bubble || bubble.querySelector('.copy-btn')) return;
        if (bubble.classList.contains('typing-bubble')) return;

        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.innerHTML = '📋';
        btn.title = 'Copy tin nhắn';
        btn.setAttribute('aria-label', 'Copy tin nhắn');
        btn.onclick = (e) => {
          e.stopPropagation();
          const clone = bubble.cloneNode(true);
          
          // ⚡ Xóa cả các thẻ <a> chứa link CTA (Quản lý đơn, Xem menu...)
          clone.querySelectorAll('.ai-feedback, .copy-btn, .confirm-actions, .quick-replies, button, a.btn, a.btn-outline, a.ui-btn-block, a.ui-btn-half').forEach(el => el.remove());

          const text = (clone.innerText || '').replace(/\s+$/,'').trim();
          if (!text) {
            showToast('⚠ Không có nội dung để copy', '#c62828');
            return;
          }

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
              () => showToast('✓ Đã copy tin nhắn'),
              () => showToast('⚠ Không copy được', '#c62828')
            );
          } else {
            showToast('⚠ Trình duyệt không hỗ trợ copy', '#c62828');
          }
        };
        bubble.style.position = 'relative';
        bubble.appendChild(btn);
      }));
    }).observe(body, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachCopyButtons);
  } else {
    attachCopyButtons();
  }
})();
/* ============================================================
   UPGRADE 10: Global keyboard shortcuts
============================================================ */
(function() {
  document.addEventListener('keydown', (e) => {
    // Skip khi đang gõ input/textarea (trừ Esc)
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');

    // ⚡ "/" — focus chat input
    if (e.key === '/' && !typing) {
      e.preventDefault();
      const box = document.getElementById('chatBox');
      if (box && !box.classList.contains('open')) toggleChat();
      setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
      return;
    }

    // ⚡ Esc — đóng tất cả modal + chat
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      const box = document.getElementById('chatBox');
      if (box && box.classList.contains('open')) box.classList.remove('open');
      return;
    }

    // ⚡ Ctrl+K — toggle chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (typeof toggleChat === 'function') toggleChat();
      return;
    }

    // ⚡ Ctrl+Enter — gửi chat từ bất kỳ đâu
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const box = document.getElementById('chatBox');
      if (box && box.classList.contains('open')) {
        e.preventDefault();
        if (typeof sendChat === 'function') sendChat();
      }
    }
  });

  // ⚡ Hiện hint ở footer
  console.info('[shortcuts] "/" focus chat · Ctrl+K toggle · Ctrl+Enter send · Esc close');
})();
/* ============================================================
   UPGRADE 12: Export chat history as .txt
============================================================ */
window.exportChatHistory = function() {
  try {
    if (typeof AIBrain === 'undefined') { showToast('⚠ AI chưa sẵn sàng', '#c62828'); return; }
    const sid = AIBrain._getSessionId();
    const history = AIBrain.histories[sid] || [];
    if (history.length <= 1) { showToast('Chưa có tin nhắn để export', '#856404'); return; }

    const user = API.users.getCurrent();
    const lines = [
      `# CAPPAN — Chat Export`,
      `# User: ${user ? user.name + ' (' + user.phone + ')' : 'Guest'}`,
      `# Thời gian: ${new Date().toLocaleString('vi-VN')}`,
      `# Số tin: ${history.length - 1}`,
      `# ${'='.repeat(50)}`,
      ''
    ];

    history.forEach((m, i) => {
      if (m.role === 'system') return;
      if (m.role === 'tool') return;
      const role = m.role === 'user' ? '👤 User' : '🤖 Bot';
      const content = (m.content || '').replace(/\[UI_(\w+)\][\s\S]*?\[\/UI_\1\]/g, '[Card: $1]');
      lines.push(`[${role}] ${content}`);
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cappan-chat-${Date.now()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('✓ Đã export chat history');
  } catch (e) {
    console.error('[exportChatHistory]', e);
    showToast('⚠ Export thất bại', '#c62828');
  }
};