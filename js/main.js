/* ============================================================
   MAIN.JS — BẢN HOÀN CHỈNH (KHÔI PHỤC KÉO GIÃN + FIX NÚT)
============================================================ */

/* ---------- 1. TOAST (FIXED) ---------- */
let _audioSuccess = null;
try {
  _audioSuccess = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
} catch (e) { _audioSuccess = null; }

const PENDING_TOAST_KEY = 'cappan_pending_toast';

function showToast(msg, color = '#2E7D32') {
  // ⚡ CHỈ persist critical — KHÔNG persist "đã thêm" (spam)
  if (/thành công|đã đặt (bàn|hàng|chỗ)|đã hủy (đơn|booking|chỗ)|hoàn tất booking/i.test(msg)) {
    try {
      sessionStorage.setItem(PENDING_TOAST_KEY, JSON.stringify({ msg, color, ts: Date.now() }));
    } catch (e) {}
  }

  if (_audioSuccess && (color === '#2E7D32' || color === undefined)) {
    try {
      _audioSuccess.currentTime = 0;
      const pr = _audioSuccess.play();
      if (pr !== undefined) pr.catch(e => { if (e.name !== 'AbortError') console.warn('[Audio]', e); });
    } catch (e) {}
  }

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

// ⚡ Restore pending toast khi load trang mới (NGOÀI showToast — fix bug scope)
(function restorePendingToast() {
  const run = () => {
    try {
      const saved = sessionStorage.getItem(PENDING_TOAST_KEY);
      if (!saved) return;
      const { msg, color, ts } = JSON.parse(saved);
      sessionStorage.removeItem(PENDING_TOAST_KEY);
      if (Date.now() - ts < 30000) setTimeout(() => showToast(msg, color), 400);
    } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
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

  const signature = `${user ? user.id : 'guest'}_${cartCount}`;
  if (el.dataset.signature === signature) return;
  el.dataset.signature = signature;

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
  overlay.innerHTML = `<div class="logout-loading-content"><div class="spinner"></div><p>Đang đăng xuất...</p></div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);
}
function hideLogoutLoading() {
  const o = document.getElementById('logoutLoading');
  if (o) o.classList.remove('show');
}

/* ---------- 6. CHAT TOGGLE & SMART SCROLL ---------- */
function toggleChat() {
  const box = document.getElementById('chatBox');
  if (!box) return;
  
  const willOpen = !box.classList.contains('open');
  box.classList.toggle('open');
  
  const modal = document.getElementById('uiCardModal');
  if (modal) modal.style.display = 'none';

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

function hideNewMsgPill() {
  const p = document.getElementById('chatNewPill');
  if (p) p.classList.remove('show');
}

function bindChatScroll(body) {
  if (!body) return;

  let p = document.getElementById('chatNewPill');
  const box = document.getElementById('chatBox');
  if (!p && box) {
    p = document.createElement('button');
    p.type = 'button';
    p.id = 'chatNewPill';
    p.className = 'chat-new-pill';
    p.textContent = '↓ Cuộn xuống';
    p.onclick = (e) => {
      e.preventDefault();
      body._stick = true;
      body.scrollTop = body.scrollHeight;
      hideNewMsgPill();
    };
    box.appendChild(p);
  }

  if (body._scrollBound) return;
  body._scrollBound = true;
  body._stick = true;

  body.addEventListener('scroll', () => {
    const dist = body.scrollHeight - body.scrollTop - body.clientHeight;
    if (dist > 50) {
      body._stick = false; 
      if (p) p.classList.add('show');
    } else {
      body._stick = true;
      if (p) p.classList.remove('show');
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

function clearChatHistory() {
  if (!confirm('Xóa toàn bộ lịch sử trò chuyện?')) return;
  if (typeof AIBrain === 'undefined') { showToast('⚠ AI chưa sẵn sàng', '#c62828'); return; }
  const sid = AIBrain._getSessionId();
  AIBrain._clearHistory(sid);
  const body = document.getElementById('chatBody');
  if (body) {
    body.innerHTML = `<div class="msg bot"><div class="bubble">Đã xóa lịch sử. Anh/chị cần hỗ trợ gì ạ?</div></div>`;
    hideNewMsgPill();
    body._stick = true;
    body.scrollTop = 0;
  }
  if (typeof renderQuickReplies === 'function') setTimeout(renderQuickReplies, 300);
  showToast('✓ Đã xóa lịch sử chat');
} 

function clearAICache() {
  // 1. Kiểm tra an toàn
  if (typeof ResponseCache === 'undefined') { 
    showToast('⚠ Hệ thống Cache chưa sẵn sàng', '#c62828'); 
    return; 
  }

  const size = ResponseCache.size();
  const msg = size > 0 
    ? `Bạn có chắc muốn xóa ${size} mục cache AI không?` 
    : `Bộ nhớ đệm AI đang trống. Bạn có muốn dọn dẹp cả Lịch sử Chat không?`;
    
  // Sử dụng confirm của trình duyệt
  if (!window.confirm(msg)) return;

  try {
    // 2. Xóa Cache AI
    ResponseCache.clear();

    // 3. Xóa Lịch sử chat (SessionStorage)
    if (typeof AIBrain !== 'undefined' && typeof AIBrain._getSessionId === 'function') {
      const sid = AIBrain._getSessionId();
      sessionStorage.removeItem('cappan_history_' + sid);
      // Nếu đang mở Chatbox, xóa trắng màn hình chat
      const chatBody = document.getElementById('chatBody');
      if (chatBody) chatBody.innerHTML = '';
    }

    // 4. Thông báo thành công
    showToast('✓ Đã xóa sạch Cache và Lịch sử chat!');
    
    // 5. Tải lại trang sau 1s để làm mới hoàn toàn
    setTimeout(() => window.location.reload(), 1000);

  } catch (e) {
    console.error('[clearAICache] Lỗi:', e);
    showToast('⚠ Có lỗi xảy ra khi xóa cache', '#c62828');
  }
}
// Ghi đè lại vào window để nút HTML gọi được
window.clearAICache = clearAICache;

/* ---------- 7. MARKDOWN & ESCAPE ---------- */
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
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
window.esc = esc;

/* ---------- 8. ADD CHAT MSG & INDICATORS ---------- */
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

/* ---------- 9. CONFIRM & FEEDBACK ---------- */
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
        <button class="confirm-yes" style="padding:6px 14px; border:none; border-radius:8px; background:#2E7D32; color:white; cursor:pointer; font-size:13px;">✓ Xác nhận</button>
        <button class="confirm-no" style="padding:6px 14px; border:1px solid #c62828; border-radius:8px; background:white; color:#c62828; cursor:pointer; font-size:13px;">✗ Hủy</button>
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
        if (res && Array.isArray(res.quickReplies)) addContextQuickReplies(res.quickReplies);
      }
    } catch (e) {
      hideTypingIndicator();
      addChatMsg('Xin lỗi, thao tác bị lỗi.', 'bot');
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

function addFeedbackButtons(msgDiv, question, answer) {
  if (!msgDiv) return;
  const wrap = msgDiv.querySelector('.bubble');
  if (!wrap || wrap.querySelector('.ai-feedback')) return;

  const actions = document.createElement('div');
  actions.className = 'ai-feedback';
  actions.innerHTML = `<button class="fb-btn fb-up" title="Hữu ích">👍</button><button class="fb-btn fb-down" title="Chưa đúng">👎</button>`;
  wrap.appendChild(actions);

  actions.querySelector('.fb-up').onclick = () => {
    try { AIMetrics.logFeedback(question, answer, 'up'); } catch(e) {}
    actions.remove();
    showToast('✓ Cảm ơn phản hồi của bạn!');
  };
  actions.querySelector('.fb-down').onclick = () => {
    try {
      AIMetrics.logFeedback(question, answer, 'down');
      const u = API.users.getCurrent();
      if (u && typeof UserMemory !== 'undefined') {
        msgDiv.querySelectorAll('[data-ui-add]').forEach(btn => {
          UserMemory.recordReject(btn.dataset.uiAdd, u.id);
        });
      }
    } catch(e) {}
    actions.remove();
    showToast('⚠ Đã ghi nhận — gọi hotline 0366 444 038 nếu cần hỗ trợ ngay.', '#c62828');
  };
}

/* ---------- 10. QUICK REPLIES ---------- */
const QUICK_CUSTOMER = ['Còn chỗ yên tĩnh không?', 'Menu có gì?', 'Giờ mở cửa?', 'Đặt chỗ thế nào?'];
const QUICK_STAFF = ['Còn bao nhiêu chỗ trống?', 'Đơn nào đang xử lý?', 'Hôm nay có booking nào?', 'Danh sách nhân viên'];

function renderQuickReplies() {
  const body = document.getElementById('chatBody');
  if (!body || document.getElementById('quickReplies')) return;

  const isStaff = (typeof Auth !== 'undefined' && Auth.isStaff) ? Auth.isStaff() : false;
  const list = isStaff ? QUICK_STAFF : QUICK_CUSTOMER;

  const div = document.createElement('div');
  div.id = 'quickReplies';
  div.className = 'quick-replies';
  div.innerHTML = list.map(q => `<button type="button" class="quick-reply-btn" onclick="sendQuickReply('${q.replace(/'/g, "\\'")}')">${q}</button>`).join('');
  body.appendChild(div);
  chatScroll();
}

function sendQuickReply(text) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = text;
  sendChat();
}

/* ⚡ v5.2 CONTEXT QUICK REPLIES — nút hành động thông minh gắn theo từng câu trả lời
   Hỗ trợ item dạng: 'string' | { label, text? } | { label, href } (liên kết an toàn qua _safeHref) */
function addContextQuickReplies(list) {
  const body = document.getElementById('chatBody');
  if (!body || !Array.isArray(list)) return;
  const old = document.getElementById('quickReplies');
  if (old) old.remove();

  const items = list.filter(Boolean).slice(0, 4);
  if (!items.length) return;

  const div = document.createElement('div');
  div.id = 'quickReplies';
  div.className = 'quick-replies ctx-quick-replies';

  const mk = it => {
    if (typeof it === 'string') {
      return `<button type="button" class="quick-reply-btn" onclick="sendQuickReply('${esc(it).replace(/'/g, "\\'")}')">${esc(it)}</button>`;
    }
    const label = esc(it.label || '').replace(/'/g, "\\'");
    if (it.href) {
      const hr = _safeHref(it.href);
      if (hr) return `<a type="button" class="quick-reply-btn" href="${esc(hr)}">${esc(it.label)}</a>`;
      return '';
    }
    if (it.text) return `<button type="button" class="quick-reply-btn" onclick="sendQuickReply('${esc(it.text).replace(/'/g, "\\'")}')">${esc(it.label)}</button>`;
    return `<button type="button" class="quick-reply-btn" onclick="sendQuickReply('${label}')">${esc(it.label)}</button>`;
  };
  div.innerHTML = items.map(mk).join('');
  body.appendChild(div);
  chatScroll();
}
window.addContextQuickReplies = addContextQuickReplies;
/* ⚡ B4/B5: URL scheme validation — chặn javascript:, data:, file: */
function _safeHref(href, allowed) {
  const s = String(href == null ? '' : href).trim();
  if (!s) return '';
  if (/^[./#?]/.test(s) || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  const m = s.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!m) return '';
  const scheme = m[1].toLowerCase();
  const ALLOW = Array.isArray(allowed) ? allowed : ['http', 'https', 'tel', 'mailto'];
  return ALLOW.includes(scheme) ? s : '';
}
window._safeHref = _safeHref;
/* ---------- 11. UI CARDS (RENDERERS) ---------- */
const UICards = {
  has(msg) { return typeof msg === 'string' && /\[UI_\w+\]/.test(msg); },
  parse(msg) {
    const parts = [];
    const re = /\[UI_(\w+)\]([\s\S]*?)\[\/UI_\1\]/g;
    const pushText = s => { s = s.trim(); if (s) parts.push({ kind: 'text', value: s }); };
    let last = 0, m;
    while ((m = re.exec(msg)) !== null) {
      pushText(msg.slice(last, m.index));
      try { parts.push({ kind: 'card', type: m[1], data: JSON.parse(m[2]) }); } catch (e) {}
      last = re.lastIndex;
    }
    pushText(msg.slice(last));
    return parts;
  },
  
  _store: {},
  _storeOrder: [],
  _STORE_MAX: 50, // ⚡ FIX H3
  
  _putStore(id, val) {
    this._store[id] = val;
    this._storeOrder.push(id);
    while (this._storeOrder.length > this._STORE_MAX) {
      const oldId = this._storeOrder.shift();
      delete this._store[oldId];
    }
  },

  showSkeletonInChat() {    const body = document.getElementById('chatBody');
    if (!body) return;
    body.querySelectorAll('.skeleton-msg').forEach(el => el.remove());
    const sk = document.createElement('div');
    sk.className = 'msg bot skeleton-msg';
    sk.innerHTML = '<div class="bubble" style="min-width:220px;">'
      + '<div class="skeleton" style="height:12px;width:70%;margin-bottom:8px;border-radius:6px;"></div>'
      + '<div class="skeleton" style="height:12px;width:90%;margin-bottom:8px;border-radius:6px;"></div>'
      + '<div class="skeleton" style="height:12px;width:55%;border-radius:6px;"></div>'
      + '</div>';
    body.appendChild(sk);
    if (typeof chatScroll === 'function') chatScroll();
  },
  
  appendTo(msg, question) {
    document.querySelectorAll('.skeleton-msg').forEach(el => el.remove());
    let lastDiv = null;
    this.parse(msg).forEach(p => {
      if (p.kind === 'text') { lastDiv = addChatMsg(p.value, 'bot'); return; }
      const fn = this.renderers[p.type];
      if (!fn) return;
      
      let html = '';
      try {
        const cardId = 'card_' + Date.now() + Math.floor(Math.random() * 1000);
        this._putStore(cardId, { type: p.type, data: p.data }); // ⚡ Dùng _putStore
        let innerHtml = fn.call(this, p.data, true);
        html = `<div class="ui-card-wrapper">
            <button type="button" class="ui-card-expand-btn" onclick="expandUICard('${cardId}')" title="Phóng to">Xem</button>
            ${innerHtml}</div>`;
      } catch (e) {}
      if (html) { lastDiv = addChatMsg(html, 'bot', true); if (html.indexOf('data-live-order') !== -1) this._startLiveIfAny(html); }
    });
    if (lastDiv && question) {
      addFeedbackButtons(lastDiv, question, String(msg).replace(/\[UI_(\w+)\][\s\S]*?\[\/UI_\1\]/g, '[thẻ $1]'));
    }
    return lastDiv;
  },

  /* ============================================================
     ⚡ v6.2 — LIVE ORDER ENGINE: đơn đang giao tự cập nhật trong chat
     Poll mỗi 6s; tự dừng khi đơn hoàn tất/hủy hoặc thẻ bị gỡ khỏi DOM
  ============================================================ */
  _liveTimers: {},
  _startLiveIfAny(html) {
    try {
      const re = /data-live-order="([^"]+)"/g;
      let m;
      while ((m = re.exec(String(html))) !== null) this._liveWatch(m[1]);
    } catch (e) {}
  },
  _liveWatch(id) {
    if (this._liveTimers[id]) return;
    const tick = () => {
      const el = document.querySelector('[data-live-order="' + id + '"]');
      if (!el || !document.body.contains(el)) { clearInterval(t); delete this._liveTimers[id]; return; }
      const o = (typeof API !== 'undefined' && API.orders.getById) ? API.orders.getById(id) : null;
      if (!o) { clearInterval(t); delete this._liveTimers[id]; return; }
      if (o.step >= 4 || o.status === 'cancelled') { this._paintLive(id, o); clearInterval(t); delete this._liveTimers[id]; return; }
      this._paintLive(id, o);
    };
    const t = setInterval(tick, 6000);
    this._liveTimers[id] = t;
  },
  _paintLive(id, o) {
    try {
      document.querySelectorAll('[data-live-order="' + id + '"]').forEach(el => {
        if (!document.body.contains(el)) return;
        const staff = el.dataset.liveStaff === '1';
        el.innerHTML = this.renderers.LIVE_ORDER.call(this, Object.assign({}, o, { staff: staff }));
      });
    } catch (e) {}
  },

  fmt(n) { try { return API.utils.formatVND(n); } catch (e) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; } },
  mask(p) { const t = String(p == null ? '' : p); if (!t || t.includes('*')) return t; return t.length <= 6 ? '****' : t.slice(0, 4) + '****' + t.slice(-2); },
  day(d) { return String(d || '').slice(5).split('-').reverse().join('/'); },
  canOrder() { try { return !(typeof Auth !== 'undefined' && Auth.isStaff && Auth.isStaff()); } catch (e) { return true; } },

  addBtn(m) {
    if (m.noBtn) return ''; 
    if (m.inStock === false) return `<button type="button" class="ui-btn-add" disabled>Hết hàng</button>`;
    return this.canOrder() ? `<button type="button" class="ui-btn-add" data-ui-add="${esc(m.id)}">+ Thêm</button>` : '';
  },

  /* ⚡ v6 — BUTTON SINH ĐỘNG: helper dựng nút hành động trong thẻ chat.
     opts: { primary → gradient + pulse, sm → chip nhỏ, danger → đỏ }
     Bấm nút → gửi text vào chat (data-ui-say đã có handler sẵn). */
  abtn(label, say, opts) {
    opts = opts || {};
    const cls = 'ui-fab-btn' + (opts.primary ? ' ui-fab-primary' : '') + (opts.sm ? ' ui-fab-sm' : '') + (opts.danger ? ' ui-fab-danger' : '');
    return `<button type="button" class="${cls}" data-ui-say="${esc(String(say || label))}">${esc(label)}</button>`;
  },
  alink(label, href) {
    const h = _safeHref(href);
    return h ? `<a class="ui-fab-btn" href="${esc(h)}">${esc(label)}</a>` : '';
  },
  fmtTime(t) {
    const p = String(t || '').split(':');
    return (p.length === 2) ? p[0] + 'h' + (p[1] === '00' ? '' : p[1]) : String(t || '');
  },

  menuRow(m) {
    return `
      <div class="ui-menu-row">
        <div class="ui-menu-info">
          <div class="ui-menu-title-wrap">
            <span class="menu-item-name">${esc(m.name)}</span>
            ${m.badge ? `<span class="ui-badge">${esc(m.badge)}</span>` : ''}
          </div>
          ${m.reason ? `<div style="font-size:0.72rem; color:#9E8A7A; margin:2px 0 4px; font-style:italic;">✨ ${esc(m.reason)}</div>` : ''}
          <div class="menu-item-price">${this.fmt(m.price)}</div>
        </div>
        <div class="ui-menu-action">
          ${this.addBtn(m)}
        </div>
      </div>`;
  },

  renderers: {
      SEAT(d) {
      if (Array.isArray(d)) d = { available: d.length, floors: [], seats: d };
      const seats = Array.isArray(d.seats) ? d.seats : [];
      const canBook = UICards.canOrder();
      const meta = d.bookingMeta || {};

      const baseParams = new URLSearchParams();
      if (meta.date) baseParams.set('date', meta.date);
      if (meta.time) baseParams.set('time', meta.time);
      if (meta.guests) baseParams.set('guests', meta.guests);

      const floorsHtml = (d.floors || []).length > 1
        ? `<div class="ui-cat" style="flex-wrap:wrap; gap:6px;">${d.floors.map(f => `<span class="ui-sub" style="background:#f0e6d2;padding:3px 10px;border-radius:12px;font-size:12px;">${esc(f.name)}: ${esc(f.available)}/${esc(f.total)}</span>`).join('')}</div>`
        : '';

      const seatListHtml = seats.length === 0
        ? '<p class="ui-sub" style="text-align:center;padding:10px;">Hiện không còn chỗ trống.</p>'
        : seats.map(seat => {
            if (canBook) {
              const params = new URLSearchParams(baseParams);
              params.set('seat', seat.id);
              return `<a href="booking.html?${params.toString()}" class="ui-seat-row">
                        <span class="seat-name">🪑 Bàn ${esc(seat.id)} <small>(${esc(seat.capacity)} người)</small></span>
                        <span class="seat-btn">Đặt ngay →</span>
                      </a>`;
            }
            return `<div class="ui-seat-row" style="cursor:default; background:#f5f5f5;"><span class="seat-name">🪑 ${esc(seat.id)} – ${esc(seat.capacity)} người</span></div>`;
          }).join('');

      const viewAllBtn = canBook ? `<a href="booking.html?${baseParams.toString()}" class="ui-btn-see-all">Xem tất cả chỗ →</a>` : '';

      return `
        <div class="ui-card">
          <h4>🪑 ${esc(d.title || `Còn ${d.available || seats.length} chỗ trống`)}</h4>
          <div class="ui-card-content">
            ${floorsHtml}
            <div class="ui-seat-list">${seatListHtml}</div>
          </div>
          ${viewAllBtn}
        </div>`;
    },
    PROMO(d, isPreview = true) {
      const list = isPreview ? d.slice(0, 3) : d;
      return `
        <div class="ui-card ui-card-gold" style="padding: 12px !important;">
          <h4 style="font-size: 1rem; margin-bottom: 10px;">🎁 Ưu đãi hôm nay ${!isPreview ? `(${d.length})` : ''}</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${list.map(p => `
              <div class="ui-inner-box" style="display: flex; align-items: center; justify-content: space-between;">
                <div style="flex: 1; min-width: 0; overflow: hidden; white-space: ${isPreview ? 'nowrap' : 'normal'}; text-overflow: ellipsis; font-size: 0.8rem;">
                  <b style="color: #C9A227; font-size: 0.9rem; font-family: monospace;">${esc(p.code)}</b>
                  <span style="color: #777; margin-left: 6px; font-size: 0.75rem;">- ${esc(p.description)}</span>
                </div>
                <button type="button" data-ui-copy="${esc(p.code)}" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; background: #C9A227; color: #fff; border: none; cursor: pointer; white-space: nowrap; margin-left: 8px; font-weight: 600;">Copy</button>
              </div>
            `).join('')}
          </div>
        </div>`;
    },

    PROMO_MANAGE(d) {
      return `
        <div class="ui-card ui-card-gold" style="text-align: center; padding: 20px 16px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">🎁</div>
          <h4 style="color: #5D4037; margin-bottom: 6px;">${esc(d.title || 'Quản lý khuyến mãi')}</h4>
          <p class="ui-sub" style="margin-bottom: 16px; color: #666;">${esc(d.desc || 'Anh/chị muốn tạo mã giảm giá mới cho quán?')}</p>
          <a href="staff-promotions.html?action=add" class="btn ui-btn-block" style="background: linear-gradient(135deg, #C9A227, #b08d1e); color: #fff; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 12px rgba(201,162,39,0.3);">+ Tạo khuyến mãi mới</a>
        </div>`;
    },
        GROUP_SUMMARY(d) {
      if (!d || !d.summary) return '';
      const s = d.summary;
      return `
        <div class="ui-card ui-card-gold" style="border-left: 4px solid #C9A227;">
          <h4 style="margin-bottom: 10px;">📝 Thông tin nhóm đã ghi nhận</h4>
          ${s.size ? `<div class="ui-sub" style="margin-bottom: 8px;">👥 <b>${s.size} người</b></div>` : ''}
          ${s.members && s.members.length ? `
            <div class="ui-cat"><span>👤 Sở thích riêng</span></div>
            ${s.members.map(m => `<div class="ui-line" style="padding: 4px 0;"><b>${esc(m.name)}</b> · ${esc((m.prefs || []).join(', '))}</div>`).join('')}
          ` : ''}
          ${s.generalPrefs && s.generalPrefs.length ? `
            <div class="ui-cat"><span>🎯 Sở thích chung</span></div>
            <div class="ui-sub">${esc(s.generalPrefs.join(', '))}</div>
          ` : ''}
          ${s.notes && s.notes.length ? `
            <div class="ui-cat"><span>⚠️ Ghi chú quan trọng</span></div>
            ${s.notes.map(n => `<div class="ui-sub" style="color: #c62828;">${esc(n)}</div>`).join('')}
          ` : ''}
          <div style="margin-top: 12px; text-align: center;">
            <button type="button" class="btn-outline" style="padding: 6px 16px; font-size: 0.85rem;" onclick="window.location.href='menu.html'">Xem menu →</button>
          </div>
        </div>`;
    },
        USER_STATS(d) {
      if (!d) return '';
      const next = d.nextRewardAt && d.totalSpent < d.nextRewardAt 
        ? `Còn ${UICards.fmt(d.nextRewardAt - d.totalSpent)} nữa để được thêm 1 điểm` 
        : 'Bạn đã đạt mốc phần thưởng tiếp theo!';
        
      return `
        <div class="ui-card ui-card-gold">
          <h4>🎁 Điểm tích lũy của bạn</h4>
          <div class="ui-card-content" style="text-align: center; padding: 10px 0;">
            <div style="font-size: 2.5rem; font-weight: 800; color: #C9A227; line-height: 1;">${esc(d.points)}</div>
            <div style="font-size: 0.9rem; color: #888; margin-top: 4px;">điểm</div>
          </div>
          <div class="ui-order" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee;">
            <span>💰 Tổng chi tiêu:</span> <b>${UICards.fmt(d.totalSpent)}</b>
          </div>
          <div class="ui-order" style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span>📦 Đơn hoàn tất:</span> <b>${esc(d.orderCount)} đơn</b>
          </div>
          <div style="text-align: center; font-size: 0.85rem; color: #E65100; background: #FFF3E0; padding: 8px; border-radius: 8px; margin-top: 10px;">
            🎯 ${next}
          </div>
          <a href="profile.html?tab=vouchers" class="ui-btn-see-all">Xem ưu đãi →</a>
        </div>`;
    },

     /* ===== ⚡ v6 — THẺ TƯƠNG TÁC FLOW ĐẶT BÀN / ĐẶT NƯỚC ===== */

    /* Bước 1 đặt bàn: chip chọn số người */
    BOOKING_PLAN(d) {
      const gs = (d && Array.isArray(d.guests) && d.guests.length) ? d.guests : [1, 2, 4, 6, 8];
      return `
        <div class="ui-card ui-act-card">
          <h4>🪑 Đặt bàn nhanh</h4>
          <div class="ui-sub">Bàn cho mấy người? Bấm chip bên dưới ạ:</div>
          <div class="ui-act">${gs.map(g => UICards.abtn(g + ' người', g + ' người', { sm: true })).join('')}</div>
          <div class="ui-act">${UICards.alink('🗺 Xem sơ đồ chỗ ngồi →', 'booking.html')}</div>
        </div>`;
    },

    /* Bước 2 đặt bàn: chip chọn khung giờ */
    TIME_PICK() {
      const opts = [
        ['Tối nay 19h', 'tối nay 19h'], ['Hôm nay 12h', 'hôm nay 12h'],
        ['Sáng mai 9h', 'sáng mai 9h'], ['Chiều mai 15h', 'chiều mai 15h'],
        ['Tối mai 19h', 'tối mai 19h']
      ];
      return `
        <div class="ui-card ui-act-card">
          <h4>🕒 Chọn giờ ngồi</h4>
          <div class="ui-act">${opts.map(o => UICards.abtn(o[0], o[1], { sm: true })).join('')}</div>
          <div class="ui-sub" style="margin-top:8px;">Giờ khác: anh/chị gõ ví dụ "18h30 mai" ạ.</div>
        </div>`;
    },

    /* Xác nhận: thông tin bàn + nút hành động lớn, nút chính nhấp nháy */
    BOOKING_CONFIRM(d) {
      const alts = (d && d.alts) || [];
      return `
        <div class="ui-card ui-act-card">
          <h4>✅ Xem lại bàn đã chọn</h4>
          <div class="ui-act-info">🪑 Bàn <b>${esc(d.seat)}</b> · sức chứa ${esc(d.cap)} · 👥 ${esc(d.guests)} người<br>🕒 ${UICards.fmtTime(d.time)} ${esc(String(d.date || '').toLowerCase())}</div>
          <div class="ui-act">
            ${UICards.abtn('✓ Xác nhận đặt chỗ', 'xác nhận đặt chỗ', { primary: true })}
            ${alts.length ? UICards.abtn('🔄 Đổi bàn khác', 'chọn bàn khác', {}) : ''}
            ${UICards.abtn('✗ Hủy', 'hủy', { danger: true, sm: true })}
          </div>
          ${alts.length ? `<div class="ui-act">${alts.map(s => UICards.abtn('🪑 ' + s, 'chọn bàn ' + String(s).toLowerCase(), { sm: true })).join('')}</div>` : ''}
        </div>`;
    },

    /* Thành công: vé đặt bàn với mã + hành động kế tiếp */
    BOOKING_DONE(d) {
      return `
        <div class="ui-card ui-card-gold ui-act-card">
          <h4>🎉 Đặt bàn thành công!</h4>
          <div class="ui-act-info">🪑 Bàn <b>${esc(d.seat)}</b> · 👥 ${esc(d.guests)} người<br>🕒 ${UICards.fmtTime(d.time)} ${esc(String(d.date || '').toLowerCase())}<br>🎫 Mã: <b>${esc(d.id)}</b></div>
          <div class="ui-act">
            ${UICards.alink('📅 Booking của tôi', 'profile.html')}
            ${UICards.abtn('🛍 Gọi món trước', 'gợi ý món ngon', {})}
          </div>
        </div>`;
    },

    /* ===== ⚡ v6.2 — LIVE ORDER: đơn đang giao cập nhật trực tiếp trên chat ===== */
    LIVE_ORDER(d) {
      const steps = ['Chờ xử lý', 'Đang pha', 'Shipper lấy', 'Đang giao', 'Hoàn tất'];
      const step = Math.max(0, Math.min(4, Number(d.step) || 0));
      const cancelled = d.status === 'cancelled';
      const live = step >= 2 && step < 4 && !cancelled;
      const rows = steps.map((s, i) => {
        const cls = i < step ? ' done' : (i === step && !cancelled ? ' current' : '');
        return `<div class="ui-live-step${cls}"><span class="ui-live-dot">${i < step ? '✓' : (i + 1)}</span><span>${esc(s)}</span></div>`;
      }).join('');
      return `
        <div class="ui-card ui-act-card ui-live" data-live-order="${esc(d.id)}" ${d.staff ? 'data-live-staff="1"' : ''}>
          <h4>🛵 Trạng thái đơn ${esc(d.id)} ${live ? '<span class="ui-live-flag">● LIVE</span>' : ''}</h4>
          <div class="ui-act-info">${esc(d.customerName || 'Khách')} · <b>${UICards.fmt(d.total)}</b>${cancelled ? ' · <b style="color:#c62828;">ĐÃ HỦY</b>' : (step >= 4 ? ' · <b style="color:#2E7D32;">HOÀN TẤT</b>' : '')}</div>
          <div class="ui-live-body">${rows}</div>
          <div class="ui-live-bar"><div style="width:${cancelled ? 100 : (step / 4 * 100)}%"></div></div>
          ${d.staff && step < 4 && !cancelled ? `<div class="ui-act">
            ${UICards.abtn('▶ Bước tiếp', 'tiến trình ' + d.id, { sm: true })}
            ${UICards.abtn('✓ Hoàn tất', 'hoàn tất đơn ' + d.id, { sm: true, primary: true })}
            ${UICards.abtn('✗ Hủy đơn', 'hủy đơn ' + d.id, { sm: true, danger: true })}
          </div>` : ''}
          ${!d.staff ? `<div class="ui-act">${UICards.alink('📍 Trang theo dõi', 'tracking.html?id=' + d.id)}</div>` : ''}
        </div>`;
    },

    /* ===== ⚡ v6.1 — SELF-SERVICE: hủy bàn + hồ sơ khách ===== */

    /* Danh sách booking khách → từng dòng có nút ✗ Hủy */
    BOOKING_CANCEL(d) {
      const bks = (d && d.bks) || [];
      const rows = bks.map(b => `
        <div class="ui-inner-box" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="font-size:0.8rem; line-height:1.5; min-width:0;">
            <b>🎫 ${esc(b.id)}</b> · 🪑 ${esc(b.seatId)} · 👥 ${esc(b.guests)} người<br>
            <span style="color:#8a7a6a;">🕒 ${UICards.fmtTime(b.time)} ${esc(String(b.date || '').toLowerCase())}</span>
          </div>
          <div style="flex:none;">
            <button type="button" class="ui-fab-btn ui-fab-sm ui-fab-danger" data-ui-say="hủy booking ${esc(b.id)}">✗ Hủy</button>
          </div>
        </div>`).join('');
      const title = d && d.ask ? '❓ Chọn bàn cần hủy' : '📅 Booking của anh/chị';
      if (d && d.confirm) {
        const b0 = bks[0] || {};
        return `
          <div class="ui-card ui-act-card" style="border-left-color:#c62828;">
            <h4>🚫 Xác nhận hủy bàn</h4>
            <div class="ui-act-info">🎫 <b>${esc(b0.id)}</b> · 🪑 Bàn ${esc(b0.seatId)} · 👥 ${esc(b0.guests)} người<br>🕒 ${UICards.fmtTime(b0.time)} ${esc(String(b0.date || '').toLowerCase())}</div>
            <div class="ui-act">
              ${UICards.abtn('✓ Hủy bàn này', 'hủy booking ' + (b0.id || ''), { primary: true })}
              ${UICards.abtn('🛑 Giữ bàn', 'thôi', { danger: true })}
            </div>
          </div>`;
      }
      const head = 'Dạ anh/chị đang giữ ' + bks.length + ' bàn.';
      return `
        <div class="ui-card ui-act-card">
          <h4>${esc(title)}</h4>
          ${d && d.ask ? `<div class="ui-sub">${esc(head)} Từng dòng có nút hủy riêng ạ.</div>` : ''}
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">${rows}</div>
          <div class="ui-act">
            ${UICards.abtn('🛍 Gọi món trước', 'gợi ý món ngon', {})}
            ${UICards.abtn('🆕 Đặt thêm bàn', 'đặt bàn', { sm: true })}
          </div>
        </div>`;
    },

    /* Hủy xong — vé xác nhận + bước tiếp */
    BOOKING_CANCELLED(d) {
      return `
        <div class="ui-card ui-act-card" style="border-left-color:#c62828;">
          <h4>🚫 Đã hủy booking ${esc(d.id)}</h4>
          <div class="ui-act-info">🪑 Bàn ${esc(d.seat)} · 👥 ${esc(d.guests)} người<br>🕒 Đã hủy khung ${UICards.fmtTime(d.time)} ${esc(String(d.date || '').toLowerCase())}</div>
          <div class="ui-act">
            ${UICards.abtn('🆕 Đặt bàn khác', 'đặt bàn', { primary: true })}
            ${UICards.abtn('🛍 Gọi món mang về', 'gợi ý món ngon', {})}
          </div>
        </div>`;
    },

    /* Hồ sơ khách — em đọc hết mọi thứ khách cho phép */
    MY_INFO(d) {
      const mem = (d && d.mem) || null;
      const od = mem ? mem.orderCount : (d ? d.orders : 0);
      const sp = mem ? mem.totalSpent : (d ? d.spend : 0);
      return `
        <div class="ui-card ui-card-gold ui-act-card">
          <h4>📇 Hồ sơ của anh/chị</h4>
          <div class="ui-inner-box" style="text-align:left; font-size:0.83rem; line-height:1.6; margin:8px 0;">
            👤 <b>${esc((d && d.name) || 'Khách')}</b> <span class="ui-sub">· ${esc((d && d.id) || '')}</span><br>
            📞 ${esc((d && d.phone) || '—')} ${d && d.email ? '· ✉️ ' + esc(d.email) : ''}<br>
            📦 ${esc(od || 0)} đơn · 💰 Tổng chi: <b>${UICards.fmt(sp || 0)}</b><br>
            📅 ${esc((d && d.bookings) || 0)} booking đang hoạt động
            ${mem && mem.favTags && mem.favTags.length ? `<br>💕 Khẩu vị ghi nhận: ${esc(mem.favTags.join(', '))}` : ''}
          </div>
          <div class="ui-act">
            ${UICards.abtn('📦 Đơn của tôi', 'đơn hàng của tôi', {})}
            ${UICards.abtn('📅 Booking của tôi', 'booking của tôi', {})}
            ${UICards.abtn('🛍 Gợi ý theo khẩu vị', 'gợi ý món', { sm: true, primary: true })}
          </div>
          <div class="ui-act" style="margin-top:6px;">${UICards.alink('💾 Sửa hồ sơ / Voucher', 'profile.html')}</div>
        </div>`;
    },

    /* Chưa đăng nhập */
    NEED_LOGIN() {
      return `
        <div class="ui-card ui-act-card">
          <h4>🔐 Cần đăng nhập</h4>
          <div class="ui-sub">Dạ để em tra cứu và xử lý thông tin của anh/chị (booking, đơn hàng, ưu đãi) — anh/chị đăng nhập giúp em ạ!</div>
          <div class="ui-act">
            ${UICards.alink('🔑 Đăng nhập', 'login.html')}
            ${UICards.alink('🆕 Tạo tài khoản', 'register.html')}
          </div>
        </div>`;
    },

    /* Đặt nước: stepper số lượng + cách nhận */
    ORDER_PICK(d) {
      return `
        <div class="ui-card ui-act-card">
          <h4>🧾 ${esc(d.name)}</h4>
          <div class="ui-sub">${UICards.fmt(d.price)} / phần</div>
          <div class="ui-sub" style="margin-top:6px;">Chọn số lượng:</div>
          <div class="ui-act">${[1, 2, 3, 5].map(q => UICards.abtn('x' + q, 'lấy ' + q, { sm: true, primary: q === (d.qty || 1) })).join('')}</div>
          <div class="ui-act">
            ${UICards.abtn('⚡ Nhận ngay', 'nhận ngay', { primary: true })}
            ${UICards.abtn('🕒 Đặt giờ lấy', 'đặt giờ lấy', {})}
            ${UICards.abtn('✗ Bỏ', 'hủy', { danger: true, sm: true })}
          </div>
        </div>`;
    },

    /* Đặt nước: đã thêm giỏ → thanh toán / upsell */
    ORDER_ADDED(d) {
      if (d && d.empty) {
        return `
          <div class="ui-card ui-act-card">
            <h4>🧾 Chưa có món nào trong giỏ</h4>
            <div class="ui-act">
              ${UICards.abtn('🍲 Gợi ý món ngon', 'gợi ý món', { primary: true })}
              ${UICards.alink('📖 Xem menu', 'menu.html')}
            </div>
          </div>`;
      }
      return `
        <div class="ui-card ui-act-card">
          <h4>🛒 Đã thêm vào giỏ</h4>
          <div class="ui-act-info">${esc(d.name)} × ${esc(d.qty)} · <b>${UICards.fmt(d.total)}</b>${d.pickup ? `<br>🕒 Lấy lúc ${esc(d.pickup)}` : ''}</div>
          <div class="ui-act">
            ${UICards.alink('🛒 Thanh toán →', 'cart.html')}
            ${UICards.abtn('🍲 Gọi thêm', 'gợi ý món khác', {})}
          </div>
        </div>`;
    },

    ORDER(d) {
      if (Array.isArray(d)) d = { total: d.length, orders: d };
      const orders = d.orders || [];
      const isCustomer = UICards.canOrder(); // ⚡ Phân quyền
      
      return `
        <div class="ui-card">
          <h4>📦 ${esc(d.title || `Đơn đang xử lý (${d.total})`)}</h4>
          <div class="ui-card-content">
            ${orders.map(o => {
              const cancelled = o.status === 'cancelled';
              const step = Math.max(0, Math.min(4, Number(o.step) || 0));
              const canCancel = !cancelled && step < 2 && isCustomer; // Chỉ khách mới được thấy nút Hủy (nếu đúng quyền)
              return `
              <div class="ui-order${cancelled ? ' ui-dim' : ''}" style="border-bottom:1px dashed #e0e0e0; padding-bottom:10px; margin-bottom:10px;">
                <div class="ui-row" style="display:flex; justify-content:space-between; font-weight:bold;">
                  <span>#${esc(o.id)}</span><span style="color:#2E7D32;">${UICards.fmt(o.total)}</span>
                </div>
                <div class="ui-sub">Khách: ${esc(o.customerName)}</div>
                ${cancelled ? `<div style="color:red; font-size:0.8rem; margin-top:4px;">Đã hủy</div>` : `<div class="ui-progress" style="height:4px; background:#eee; margin:6px 0;"><div style="width:${step / 4 * 100}%; height:100%; background:#C9A227;"></div></div><div class="ui-sub" style="font-size:0.8rem;">${esc(o.stepText || ['Chờ xử lý','Đang pha','Shipper lấy','Đang giao','Hoàn tất'][step])}</div>`}
                ${canCancel ? `<button type="button" class="ui-btn-add" data-ui-cancel-order="${esc(o.id)}" style="margin-top:8px; padding:4px 12px; font-size:0.75rem; border-color:#c62828; color:#c62828; background:#FFF;">Hủy đơn</button>` : ''}
              </div>`;
            }).join('')}
          </div>
          <!-- ⚡ ĐIỀU HƯỚNG ĐÚNG ROLE -->
          ${isCustomer 
            ? `<a href="profile.html?tab=orders" class="ui-btn-see-all">Xem lịch sử đơn hàng</a>`
            : `<a href="staff-orders.html" class="ui-btn-see-all">Quản lý đơn</a>`}
        </div>`;
    },

    CART_SUCCESS(d) {
      return `
        <div class="ui-card ui-card-gold" style="text-align: center; padding: 12px !important; border: 1.5px solid #2E7D32; border-radius: 10px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 8px;">
            <span style="font-size: 1.2rem;">🛒</span>
            <h4 style="color: #2E7D32; margin: 0; font-size: 0.95rem;">Đã thêm vào giỏ!</h4>
          </div>
          <div style="background: #fff; padding: 6px 8px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e0e0e0; text-align: left; font-size: 0.8rem;">
            <div style="font-weight: 600; color: #5D4037; margin-bottom: 2px;">${esc(d.items)}</div>
            <div style="font-size: 0.75rem; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📍 ${esc(d.address)}</div>
          </div>
          <div style="margin-bottom: 10px; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; padding: 0 4px;">
            <span style="color: #666;">Tổng tiền:</span><b style="color: #c62828; font-size: 1.05rem;">${UICards.fmt(d.total)}</b>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="cart.html" class="btn" style="flex: 1; background: #2E7D32; color: #fff; font-weight: bold; border-radius: 6px; padding: 8px 0; font-size: 0.8rem; text-decoration: none; text-align: center;">Thanh toán →</a>
            <button type="button" class="btn-outline" data-ui-say="Xem khuyến mãi" style="flex: 1; border: 1px solid #C9A227; color: #C9A227; border-radius: 6px; padding: 8px 0; font-size: 0.8rem; background: transparent; cursor: pointer;">🎁 Mã giảm giá</button>
          </div>
        </div>`;
    },

KPI(d) {
  const t = d.today || {};
  const range = d.timeRange || 'all';
  const label = { today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', all: 'Tổng quan' }[range] || 'Tổng quan';

  const chips = [
    ['Chờ xử lý', d.status?.pending], ['Đang pha', d.status?.preparing],
    ['Đang giao', d.status?.shipping], ['Hoàn tất', d.status?.completed],
    ['Đã hủy', d.status?.cancelled]
  ].filter(([,n]) => n !== undefined).map(([l,n]) => `<span class="ui-chip ui-chip-muted">${l}: ${esc(n)}</span>`).join('');

  const sub = (Number(t.completedCount) || 0) + (Number(t.pendingCount) || 0) > 0
    ? `${esc(t.completedCount || 0)} hoàn tất · ${esc(t.pendingCount || 0)} đang xử lý`
    : `${esc(t.orders || 0)} đơn`;

  return `
    <div class="ui-card">
      <h4>📊 Doanh thu — ${label}</h4>
      ${(range === 'today' || range === 'all') ? `
        <div class="ui-kpi-main">
          <div class="ui-sub">Hôm nay</div>
          <div class="ui-kpi-value">${UICards.fmt(t.revenue)}</div>
          <div class="ui-sub">${sub}</div>
        </div>` : ''}
      <div class="ui-kpi-grid">
        ${(range === 'week'  || range === 'all') ? `<div><div class="ui-sub">Tuần này</div><b>${UICards.fmt(d.week)}</b></div>` : ''}
        ${(range === 'month' || range === 'all') ? `<div><div class="ui-sub">Tháng này</div><b>${UICards.fmt(d.month)}</b></div>` : ''}
      </div>
      <div class="ui-chips">${chips}</div>
      ${!UICards.canOrder() ? `<a href="staff-stats.html" class="ui-btn-see-all">Mở thống kê</a>` : ''}
    </div>`;
},

        BOOKING(d) {
      const rows = (d.bookings || []);
      const isCustomer = UICards.canOrder(); // ⚡ Phân quyền
      
      return `
        <div class="ui-card">
          <h4>📅 Booking (${esc(d.total)})</h4>
          <div class="ui-card-content">
            ${rows.map(b => `
              <div class="ui-order" style="border-bottom:1px dashed #e0e0e0; padding-bottom:8px; margin-bottom:8px;">
                <div class="ui-row" style="display:flex; justify-content:space-between; font-weight:bold;">
                  <span>${esc(b.time)} · Bàn ${esc(b.seatId)}</span><span class="ui-sub">${esc(b.floorName)}</span>
                </div>
                <div class="ui-sub">${esc(b.customerName)} · ${esc(b.guests)} khách</div>
                ${b.note ? `<div class="ui-sub">📝 ${esc(b.note)}</div>` : ''}
              </div>`).join('')}
            ${d.total > rows.length ? `<div class="ui-sub ui-more" style="text-align:center;">…và ${d.total - rows.length} booking khác</div>` : ''}
          </div>
          ${isCustomer 
            ? `<a href="profile.html" class="ui-btn-see-all">Xem lịch sử đặt chỗ</a>`
            : `<a href="staff-bookings.html" class="ui-btn-see-all">Quản lý Booking</a>`}
        </div>`;
    },

    OOS(d) {
      return `
        <div class="ui-card">
          <h4>🚫 Món hết hàng (${esc(d.count)})</h4>
          <div class="ui-sub ui-mb">Bấm vào món để đánh dấu còn hàng lại</div>
          <div class="ui-chips">
            ${(d.items || []).map(m => `<button type="button" class="ui-chip ui-chip-btn" data-ui-say="Đánh dấu món ${esc(m.id)} còn hàng trở lại">${esc(m.name)}</button>`).join('')}
          </div>
        </div>`;
    },

    STAFF(d) {
      return `
        <div class="ui-card">
          <h4>👥 Nhân viên (${(d || []).length})</h4>
          ${(d || []).map(p => `<div class="ui-row ui-line"><span><b>${esc(p.name)}</b></span><span class="ui-sub">${esc(p.role)} · ${esc(p.id)}</span></div>`).join('')}
          <a href="staff-schedule.html" class="btn ui-btn-block">Quản lý nhân viên</a>
        </div>`;
    },

SHIFT(d, isPreview = true) {
  const nameMap = {}; (d.shifts || []).forEach(s => { nameMap[s.id] = s; });
  const allDates = Object.keys(d.upcoming || {}).filter(k => Object.keys(d.upcoming[k]).length);
  const dates = isPreview ? allDates.slice(0, 3) : allDates;
  const hasMore = allDates.length > dates.length;

  const kw = d.dateKeyword || 'this_week';
  const label = { today: 'hôm nay', tomorrow: 'ngày mai', this_week: 'tuần này', next_week: 'tuần sau', all: '' }[kw] || '';

  if (!allDates.length) {
    return `<div class="ui-card"><h4>🗓 Lịch phân ca</h4><p class="ui-sub">Không có lịch ${label} ạ.</p></div>`;
  }

  return `
    <div class="ui-card">
      <h4>🗓 Lịch phân ca ${label ? `— ${label}` : ''} ${isPreview && hasMore ? `(${dates.length}/${allDates.length} ngày)` : `(${allDates.length} ngày)`}</h4>
      ${dates.map(date => `
        <div class="ui-cat"><span>${esc(UICards.day(date))}</span></div>
        ${Object.entries(d.upcoming[date]).map(([sid, list]) => `
          <div class="ui-line">
            <div class="ui-sub"><b>${esc((nameMap[sid] && nameMap[sid].name) || sid)}</b>${nameMap[sid] ? ` (${esc(nameMap[sid].timeRange)})` : ''}</div>
            <div>${(list || []).map(esc).join(', ')}</div>
          </div>`).join('')}
      `).join('')}
      ${hasMore ? `<div class="ui-sub ui-more" style="text-align:center;padding:6px;">…và ${allDates.length - dates.length} ngày khác (bấm "Xem" góc phải)</div>` : ''}
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

        MENU(d, isPreview = true) {
      if (Array.isArray(d)) d = { total: d.length, items: d };
      const items = isPreview ? (d.items || []).slice(0, 3) : (d.items || []);
      const more = (d.total > items.length && isPreview) ? `<div class="ui-sub" style="text-align:center; padding: 6px 0;">...và ${d.total - items.length} món khác</div>` : '';
      const btnHtml = d.isCart ? `<a href="cart.html" class="ui-btn-see-all">Đi đến Giỏ hàng</a>` : `<a href="menu.html" class="ui-btn-see-all">Xem toàn bộ Menu</a>`;
      
      return `
        <div class="ui-card">
          <h4>🥤 ${esc(d.title || 'Món gợi ý')}</h4>
          <div class="ui-card-content">
            ${items.map(m => this.menuRow(m)).join('')}
          </div>
          ${more}
          ${btnHtml}
        </div>`;
    },

        CATALOG(d, isPreview = true) {
      const allItems = API.menu.getAll();
      const allCats = API.categories.getAll().map(c => {
        const catItems = allItems.filter(m => m.categoryId === c.id);
        return { id: c.id, name: c.name, count: catItems.length, items: catItems };
      }).filter(c => c.count > 0);

      return `
        <div class="ui-card">
          <div class="ui-card-header">
            <h4>📖 Menu CAPPAN <span class="ui-sub-count">(${allItems.length} món)</span></h4>
          </div>
          
          ${allCats.map(c => {
            const displayItems = isPreview ? c.items.slice(0, 3) : c.items;
            return `
            <div class="ui-cat">
              <span>${esc(c.name)} <span class="ui-sub-count">(${c.count})</span></span>
              ${isPreview ? `<a href="order.html?cat=${esc(c.id)}" class="ui-link-more">Xem tất cả →</a>` : ''}
            </div>
            <div class="ui-menu-list">
              ${displayItems.map(m => this.menuRow(m)).join('')}
            </div>
            ${isPreview && c.count > 3 ? `<div class="ui-more-text">...và ${c.count - 3} món khác</div>` : ''}
          `}).join('')}
          
          <div style="text-align: center; margin-top: 20px;">
            <a href="menu.html" class="btn-outline" style="display: inline-block; width: auto; padding: 8px 24px; border-radius: 20px; font-size: 0.9rem;">Xem toàn bộ Menu</a>
          </div>
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
                <div class="ui-sub" style="text-decoration:line-through;opacity:.6;">${UICards.fmt(c.originalPrice)}</div>
              </div>
              <div style="text-align:right;">
                <div class="ui-price" style="font-size:16px;">${UICards.fmt(c.comboPrice)}</div>
                <div class="ui-sub">Tiết kiệm ${UICards.fmt(c.originalPrice - c.comboPrice)}</div>
                <button type="button" class="btn ui-btn-sm" data-ui-combo="${esc(c.id)}">Mua</button>
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
              <div class="ui-row"><b>${esc(s.dateLabel)}</b><span class="ui-chip">${esc(s.shiftName)}</span></div>
              <div class="ui-sub">🕐 ${esc(s.time)}</div>
              ${(s.coworkers || []).length ? `<div class="ui-sub">👥 Cùng ca: ${s.coworkers.map(esc).join(', ')}</div>` : ''}
            </div>
          `).join('')}
          ${(!d.shifts || !d.shifts.length) ? '<p class="ui-sub">Không có ca nào.</p>' : ''}
        </div>`;
    },
          RATING(d) {
  return `
    <div class="ui-card" style="text-align: center; padding: 16px;">
      <h4 style="margin-bottom: 8px;">⭐ Đánh giá đơn #${esc(d.orderId)}</h4>
      <p class="ui-sub" style="margin-bottom: 12px;">Anh/chị thấy đơn hàng thế nào ạ?</p>
      <div id="rating_${esc(d.orderId)}" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 8px;">
        ${[1,2,3,4,5].map(n =>
          `<button type="button" onclick="submitRating('${esc(d.orderId)}', ${n}, this)"
                   style="background: none; border: none; font-size: 32px; cursor: pointer; color: #ddd; padding: 0; transition: color .15s;"
                   onmouseover="this.style.color='#C9A227'"
                   onmouseout="this.style.color='#ddd'">☆</button>`
        ).join('')}
      </div>
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

  WELCOME(d) {
  if (!d || !Array.isArray(d.options)) return '';
  return `
    <div class="ui-card ui-card-gold">
      <h4>${esc(d.title || 'Chào mừng!')}</h4>
      <p class="ui-sub ui-mb">${d.desc ? esc(d.desc) : ''}</p>
      <div class="ui-welcome-actions">
        ${d.options.map(opt => {
          if (!opt) return '';
          const itemId = opt.itemId ? String(opt.itemId).replace(/[^\w-]/g, '') : '';
          const href = _safeHref(opt.href, ['http', 'https']);
          const prompt = opt.prompt ? String(opt.prompt).replace(/[<>&"']/g, '') : '';
          const label = esc(opt.label || '');
          if (itemId) {
            return `<button type="button" class="ui-welcome-btn" data-ui-add-item="${esc(itemId)}">${label}</button>`;
          }
          if (href) {
            // ⚡ Dùng data-href + delegated handler (không inline onclick → tránh XSS)
            return `<button type="button" class="ui-welcome-btn" data-nav-href="${esc(href)}">${label}</button>`;
          }
          return `<button type="button" class="ui-welcome-btn" data-ui-say="${esc(prompt)}">${label}</button>`;
        }).join('')}
      </div>
    </div>`;
},
  HANDOVER(d) {
  const safeHref = _safeHref(d && d.hotlineHref, ['tel']);
  const tel = String((d && d.hotline) || '').replace(/[^\d+]/g, '');
  const finalHref = safeHref || (tel ? `tel:${tel}` : '');
  return `
    <div class="ui-card" style="border: 1.5px solid #c62828; text-align: center; padding: 16px;">
      <h4 style="color: #c62828; margin-bottom: 8px;">📞 ${esc(d && d.title || 'Kết nối nhân viên')}</h4>
      <p class="ui-sub" style="margin-bottom: 12px;">${esc(d && d.desc || 'Anh/chị vui lòng gọi hotline để được hỗ trợ.')}</p>
      ${finalHref ? `<a href="${esc(finalHref)}" class="btn ui-btn-block" style="background: #c62828; color: #fff; border-radius: 8px; font-weight: bold;">Gọi Hotline: ${esc(tel || (d && d.hotline) || '')}</a>` : ''}
    </div>`;
},
        CHECKOUT(d) {
      return `
        <div class="ui-card" style="text-align: center; border: 1.5px solid #2E7D32; border-radius: 12px; padding: 16px;">
          <h4 style="color: #2E7D32; margin-bottom: 12px;">🛍️ Thông tin đã sẵn sàng</h4>
          <div style="background: #f0fdf4; border-radius: 8px; padding: 12px; text-align: left; margin-bottom: 16px; font-size: 0.9rem;">
            <div style="margin-bottom: 4px;">👤 <b>${esc(d.name)}</b> - 📞 ${esc(d.phone)}</div>
            <div>📍 ${esc(d.address)}</div>
          </div>
          <div style="font-size: 1rem; font-weight: 700; color: #c62828; margin-bottom: 16px;">
            Tổng: ${API.utils.formatVND(d.total || 0)}
          </div>
          <a href="cart.html" class="btn ui-btn-block" style="background: #2E7D32; color: white; font-weight: bold; border-radius: 8px; padding: 12px;">
            Đến giỏ hàng thanh toán →
          </a>
        </div>`;
    },
  }
};
window.UICards = UICards; 

/* ---------- 12. EXPAND UI CARD (MODAL) ---------- */
/* ---------- 12. EXPAND UI CARD (MODAL) ---------- */
window.expandUICard = function(cardId) {
  try {
    const stored = window.UICards._store[cardId];
    if (!stored) return;
    const fn = window.UICards.renderers[stored.type];
    if (!fn) return;
    
    let fullHtml = fn.call(window.UICards, stored.data, false);
    
    let modal = document.getElementById('uiCardModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'uiCardModal';
      modal.className = 'ui-card-modal-overlay';
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 99999;';
      
      modal.innerHTML = `
        <div class="ui-card-modal-box" style="background: var(--white); border-radius: 16px; width: 90%; max-width: 550px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;">
          <div class="ui-card-modal-header" style="padding: 14px 18px; border-bottom: 1px solid var(--gray-light); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: var(--brown); font-size: 1.1rem;">Chi tiết</h3>
            <button id="closeUiCardModal" type="button" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray);">✕</button>
          </div>
          <div class="ui-card-modal-body" id="uiCardModalBody" style="padding: 16px; overflow-y: auto; background: var(--bg-body);"></div>
        </div>
      `;
      document.body.appendChild(modal);
      
      const closeModal = () => { modal.style.display = 'none'; };
      modal.querySelector('#closeUiCardModal').onclick = closeModal;
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }
    
    document.getElementById('uiCardModalBody').innerHTML = fullHtml;
    modal.style.display = 'flex'; 
  } catch(e) {
    console.error('Lỗi khi mở thẻ phóng to:', e);
  }
};

/* ---------- 13. ACTION BUTTONS ---------- */
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
  if (Auth.isStaff()) { showToast('Tài khoản nhân viên không dùng giỏ hàng', '#856404'); return; }

  try {
    API.cart.add({
      itemId: item.id, name: item.name, price: item.price,
      img: item.img, size: 'M', toppings: []
    });
    showToast(`✓ Đã thêm ${item.name} vào giỏ`);
    
    updateUserArea(); 

    const cartBtn = document.querySelector('.cart-icon');
    if (cartBtn) {
      cartBtn.classList.remove('bounce');
      void cartBtn.offsetWidth; 
      cartBtn.classList.add('bounce');
    }

    // ⚡ NÂNG CẤP: Upsell Bánh Flan tự động
    // ⚡ XÓA DÒNG NÀY: const item = API.menu.getById(itemId); 
    const flan = API.menu.getById('M503'); 
    
    if (item && item.categoryId !== 'other' && flan && flan.inStock) {
      const cart = API.cart.get();
      const hasFlan = cart.some(i => i.itemId === 'M503');
      
      if (!hasFlan) {
        showToast(`💡 Gợi ý: Thêm Bánh Flan (25k) ăn kèm ${item.name} cực ngon!`, '#856404');
      }
    }
  } catch (e) {
    console.error('[quickOrder] Lỗi thêm vào giỏ:', e);
    showToast('⚠ Chưa thêm được vào giỏ, anh/chị thử lại nhé', '#c62828');
  }
}
window.quickOrder = quickOrder;

function addComboToCart(comboId) {
  const combo = (typeof KB !== 'undefined' && KB.combos) ? KB.combos.find(c => c.id === comboId) : null;
  if (!combo) { showToast('Không tìm thấy combo', '#c62828'); return; }
  if (!Auth.isLoggedIn()) { showToast('🔒 Vui lòng đăng nhập', '#c62828'); return; }

  const items = (combo.itemIds || []).map(id => API.menu.getById(id)).filter(Boolean);
  if (!items.length) { showToast('Combo không còn món hợp lệ', '#c62828'); return; }

  API.cart.add({
    itemId: 'COMBO_' + combo.id,
    name: `${combo.name} — ${items.map(m => m.name).join(' + ')}`,
    price: combo.comboPrice,
    img: items[0].img, size: 'Combo', toppings: []
  });

  updateUserArea();
  const saved = combo.originalPrice - combo.comboPrice;
  showToast(`✓ Đã thêm combo "${combo.name}" (Tiết kiệm ${API.utils.formatVND(saved)})`);
}
window.addComboToCart = addComboToCart;

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav-href]');
  if (navBtn) {
    const href = navBtn.getAttribute('data-nav-href');
    const safe = _safeHref(href, ['http', 'https']);
    if (safe) window.location.href = safe;
    return;
  }
  const copyBtn = e.target.closest('[data-ui-copy]');
  if (copyBtn) {
    const code = copyBtn.dataset.uiCopy;
    const ok = () => showToast(`✓ Đã copy mã ${code}`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(ok, () => showToast(`Mã của bạn: ${code}`, '#856404'));
    } else { showToast(`Mã của bạn: ${code}`, '#856404'); }
    return;
  }
  
  const addBtn = e.target.closest('[data-ui-add]');
  if (addBtn) { quickOrder(addBtn.dataset.uiAdd); return; }
  
  const addItemBtn = e.target.closest('[data-ui-add-item]');
  if (addItemBtn) {
    const itemId = addItemBtn.dataset.uiAddItem;
    const item = API.menu.getById(itemId);
    if (item && item.inStock) {
      quickOrder(itemId);
      addItemBtn.textContent = '✅ Đã thêm';
      addItemBtn.disabled = true;
      addItemBtn.style.opacity = '0.6';
    } else { showToast('⚠ Món này hiện không khả dụng', '#c62828'); }
    return;
  }
  
  const cancelOrderBtn = e.target.closest('[data-ui-cancel-order]');
  if (cancelOrderBtn) {
    const orderId = cancelOrderBtn.dataset.uiCancelOrder;
    if (!confirm(`Hủy đơn ${orderId}? Chỉ hủy được trước khi quán bắt đầu pha chế.`)) return;
    const order = API.orders.getById(orderId);
    const u = API.users.getCurrent();
    if (!order || !u || order.userId !== u.id) { showToast('⚠ Không tìm thấy đơn', '#c62828'); return; }
    if (order.step >= 2) { showToast('⚠ Đơn đã qua bước chuẩn bị, vui lòng gọi 0366 444 038', '#c62828'); return; }
    API.orders.cancel(orderId);
    cancelOrderBtn.closest('.ui-order').innerHTML = '<div class="ui-step ui-red">Đã hủy</div>';
    showToast(`✓ Đã hủy đơn ${orderId}`);
    return;
  }

  const comboBtn = e.target.closest('[data-ui-combo]');
  if (comboBtn) { addComboToCart(comboBtn.dataset.uiCombo); return; }

  const sayBtn = e.target.closest('[data-ui-say]');
  if (sayBtn) {
    const text = sayBtn.dataset.uiSay;
    if (text.startsWith('Thêm ')) {
      const itemName = text.replace('Thêm ', '').replace(' vào giỏ', '');
      const item = API.menu.getAll().find(m => m.name === itemName);
      if (item) {
        quickOrder(item.id);
        sayBtn.closest('.ui-chips').innerHTML = '<span class="ui-sub">Đã thêm vào giỏ ✅</span>';
      }
    } else { sendQuickReply(text); }
    return;
  }
});

/* ---------- 14. SEND CHAT ---------- */
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
    document.querySelectorAll('.skeleton-msg').forEach(el => el.remove());   // ⚡ FIX skeleton kẹt
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

  showTypingIndicator('🧠 Đang phân tích…');

  /* ⚡ V7 PATCH A: Phase handler — wire _onPhaseChange vào AIBrain */
  AIBrain._onPhaseChange = (phase) => {
    try {
      if (phase === 'thinking') {
        showTypingIndicator('🧠 Đang phân tích…');
      } else if (phase === 'stream2') {
        removeCursor(); resetBubble(); showTypingIndicator();
      } else if (phase === 'tool') {
        removeCursor(); resetBubble();
        showTypingIndicator('⚙️ Đang lấy dữ liệu...');
        if (typeof UICards !== 'undefined' && UICards.showSkeletonInChat) {
          UICards.showSkeletonInChat();
        }
      }
    } catch (e) { console.warn('[main] phase change failed:', e); }
  };

  try {
    const raw = await AIBrain.streamReply(text, onChunk);
    document.querySelectorAll('.skeleton-msg').forEach(el => el.remove());   // ⚡ FIX skeleton kẹt (mọi path)
    const safe = (typeof AIOutput !== 'undefined' && AIOutput.isValidResponse(raw))
      ? raw
      : (typeof AIOutput !== 'undefined' ? AIOutput.build('error', { source: 'validation' }) : (raw || { type: 'text', message: '' }));

    hideTypingIndicator();
    removeCursor();

    if (safe.type === 'pending') {
      if (botDiv && botDiv.parentNode) botDiv.remove();
      botDiv = null;
      addConfirmButtons(safe.message, safe.toolName, safe.toolCallId, safe.args);
      return;
    }

    if (safe.cards && UICards.has(safe.cards)) {
      if (!firstChunkReceived) {
        ensureBubble();
        removeCursor();
        streamTxt.textContent = filterMarkdown(safe.message || '');
      }
      UICards.appendTo(safe.cards, text);
      if (botDiv) addFeedbackButtons(botDiv, text, safe.message || '');
      if (Array.isArray(safe.quickReplies)) addContextQuickReplies(safe.quickReplies);
      return;
    }

    if (safe.message && UICards.has(safe.message)) {
      if (botDiv && botDiv.parentNode) botDiv.remove();
      botDiv = null;
      UICards.appendTo(safe.message, text);
      /* ⚡ v6 — trước đây quickReplies bị bỏ sót ở nhánh này → giờ render đủ */
      if (Array.isArray(safe.quickReplies)) addContextQuickReplies(safe.quickReplies);
      return;
    }

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
    if (Array.isArray(safe.quickReplies)) addContextQuickReplies(safe.quickReplies);

    /* ⚡ V7 PATCH B: Handover — gọi Handover.observe (was missing → dead code) */
    try {
      if (typeof Handover !== 'undefined' && typeof Handover.observe === 'function') {
        const sid = AIBrain._getSessionId();
        const h = Handover.observe(text, safe, sid);
        if (h) {
          if (botDiv && botDiv.parentNode) botDiv.remove();
          addChatMsg(h.message, 'bot');
          if (typeof UICards !== 'undefined' && UICards.has(h.cards)) {
            UICards.appendTo(h.cards, text);
          }
          return;
        }
      }
    } catch (err) { console.warn('[main] Handover failed:', err); }
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

/* ---------- 15. RESTORE HISTORY & VOICE ---------- */
function restoreChatHistory() {
  try {
    if (typeof AIBrain === 'undefined') return false;
    const sid = AIBrain._getSessionId();
    const role = AIBrain._getRole();
    AIBrain._getHistory(sid, role);
    const history = AIBrain.histories[sid] || [];
    if (history.length <= 1) return false; 
    const body = document.getElementById('chatBody');
    if (!body) return false;

    body.innerHTML = '';
    let rendered = 0;
    history.forEach(item => {
      if (item.role === 'user') { addChatMsg(item.content, 'user'); rendered++; }
      else if (item.role === 'assistant' && item.content) {
        if (UICards.has(item.content)) UICards.appendTo(item.content);
        else addChatMsg(item.content, 'bot');
        rendered++;
      }
    });
    return rendered > 0; 
  } catch (e) { return false; }
}

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
    rec.lang = 'vi-VN'; rec.interimResults = true; rec.continuous = false;
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
    };
    rec.onend = () => { listening = false; btn.classList.remove('on'); input.placeholder = idle; input.focus(); };
    try { rec.start(); } catch (err) {}
  });
}

function refreshSeatCardsAfterBooking() {
  const box = document.getElementById('chatBox');
  if (!box || !box.classList.contains('open')) return;
  if (typeof API === 'undefined' || typeof UICards === 'undefined') return;

  setTimeout(() => {
    try {
      const avail = API.seats.getAvailable();
      if (!avail.length) { addChatMsg('Dạ sau khi đặt, hiện quán đã hết chỗ trống ạ.', 'bot'); return; }
      const byFloor = {};
      avail.forEach(s => { byFloor[s.floorId] = (byFloor[s.floorId] || 0) + 1; });
      const floors = Object.keys(byFloor).map(fid => ({ name: (API.floors.getById(fid) || {}).name || fid, available: byFloor[fid], total: API.seats.getByFloor(fid).length }));
      const card = `[UI_SEAT]${JSON.stringify({ available: avail.length, floors, seats: avail.slice(0, 6).map(s => ({ id: s.id, capacity: s.capacity, zone: s.zone, floor: (API.floors.getById(s.floorId) || {}).name || s.floorId })) })}[/UI_SEAT]`;
      UICards.appendTo(card);
    } catch (e) {}
  }, 400);
}
window.refreshSeatCardsAfterBooking = refreshSeatCardsAfterBooking;

/* ---------- 16. INIT KÉO GIÃN KHUNG CHAT ---------- */
function initChatResizer() {
  const chatBox = document.getElementById('chatBox');
  if (!chatBox) return; 
  if (document.getElementById('chatBoxResizer')) return; 

  const resizer = document.createElement('div');
  resizer.id = 'chatBoxResizer';
  resizer.className = 'chat-box-resizer';
  chatBox.appendChild(resizer);

  let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;

  const start = (clientX, clientY) => {
    resizing = true;
    sx = clientX; sy = clientY;
    sw = chatBox.offsetWidth; sh = chatBox.offsetHeight;
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  const move = (clientX, clientY) => {
    if (!resizing) return;
    const isMobile = window.innerWidth <= 768;
    const minW = isMobile ? 260 : 320; 
    const minH = isMobile ? 300 : 400;
    
    let w = sw + (sx - clientX);
    let h = sh + (sy - clientY);
    
    w = Math.max(minW, Math.min(w, window.innerWidth - 20));
    h = Math.max(minH, Math.min(h, window.innerHeight - 80));
    
    chatBox.style.setProperty('width',  w + 'px', 'important');
    chatBox.style.setProperty('height', h + 'px', 'important');
  };

  const end = () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('cappan_chat_customer_w', chatBox.offsetWidth);
    localStorage.setItem('cappan_chat_customer_h', chatBox.offsetHeight);
  };

  resizer.addEventListener('mousedown', (e) => { e.preventDefault(); start(e.clientX, e.clientY); });
  document.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  document.addEventListener('mouseup', end);

  resizer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches[0]) start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  
  document.addEventListener('touchmove', (e) => {
    if (resizing && e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);

const savedW = parseInt(localStorage.getItem('cappan_chat_customer_w'), 10);
const savedH = parseInt(localStorage.getItem('cappan_chat_customer_h'), 10);
if (savedW && savedH) {
  // ⚡ Clamp theo viewport hiện tại (tránh tràn màn hình mobile)
  const maxW = window.innerWidth - 40;
  const maxH = window.innerHeight - 100;
  const minW = window.innerWidth <= 768 ? 260 : 320;
  const minH = window.innerWidth <= 768 ? 300 : 400;
  chatBox.style.setProperty('width',  Math.max(minW, Math.min(savedW, maxW)) + 'px', 'important');
  chatBox.style.setProperty('height', Math.max(minH, Math.min(savedH, maxH)) + 'px', 'important');
}
}

if (document.readyState === 'complete') {
  initChatResizer();
} else {
  window.addEventListener('load', initChatResizer, { once: true });
}

document.addEventListener('DOMContentLoaded', async () => {
  updateUserArea();
  bindChatScroll(document.getElementById('chatBody'));
  initVoiceInput();

  // ⚡ PATCH 7.2: Bind keydown chuẩn cho IME (thay inline onkeypress)
  // — không gửi tin sớm khi đang gõ Telex/VNI (isComposing)
  // — preventDefault() chặn inline onkeypress → không double-send
  const chatInputEl = document.getElementById('chatInput');
  if (chatInputEl && !chatInputEl._cappanKeydownBound) {
    chatInputEl._cappanKeydownBound = true;
    chatInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        if (typeof sendChat === 'function') sendChat();
      }
    });
  }

  const chatBox = document.getElementById('chatBox');
  if (chatBox && localStorage.getItem('cappan_chat_is_open') === '1') { chatBox.classList.add('open'); }

  if (typeof AIMetrics !== 'undefined' && AIMetrics.installFlushHooks) { AIMetrics.installFlushHooks(); }

  if (document.getElementById('chatBox')) {
    const isStaffPage = (document.body.dataset.page || '').startsWith('staff-');
    
    if (!isStaffPage) {
      // 1. Khôi phục lịch sử chat hoặc chào mừng
      setTimeout(() => {
        const hasHistory = restoreChatHistory();
        if (!hasHistory) {
          const body = document.getElementById('chatBody');
          if (body) body.innerHTML = ''; 
          
          let hasSmartGreet = false;
          if (typeof LocalBrain !== 'undefined' && typeof UICards !== 'undefined') {
            try {
              const smartGreet = LocalBrain.getSmartGreeting();
              if (smartGreet && smartGreet.includes('[UI_WELCOME]')) { UICards.appendTo(smartGreet); hasSmartGreet = true; }
            } catch (e) {}
          }
          
          if (!hasSmartGreet) {
            const user = API.users.getCurrent();
            const hour = new Date().getHours();
            let timeGreet = 'Chào buổi sáng';
            if (hour >= 11 && hour < 14) timeGreet = 'Chào buổi trưa';
            else if (hour >= 14 && hour < 18) timeGreet = 'Chào buổi chiều';
            else if (hour >= 18) timeGreet = 'Chào buổi tối';

            const greeting = user ? `${timeGreet} ${user.name}! 👋\n\nEm là trợ lý ảo CAPPAN. Anh/chị muốn xem menu hay đặt bàn không ạ?` : `${timeGreet}! 👋 Tôi là trợ lý ảo CAPPAN.\nBạn có thể hỏi tôi về menu, chỗ ngồi, giờ mở cửa...`;
            addChatMsg(greeting, 'bot');
          }
        }
        
        // ⚡ FIX: Gọi vẽ nút gợi ý nhanh sau khi đã load xong lịch sử/lời chào
        if (typeof renderQuickReplies === 'function') {
          setTimeout(renderQuickReplies, 300);
        }
      }, 100);

            // 2. Proactive Greeting — CHỈ hiện khi user ĐÃ tương tác (click/scroll) + Chưa có greeting
      if (!sessionStorage.getItem('cappan_greeted') && !isStaffPage) {
        const body = document.getElementById('chatBody');
        const hasContent = body && body.children.length > 0;
        if (!hasContent) {
          let userInteracted = false;
          const markInteracted = () => { userInteracted = true; };
          document.addEventListener('click', markInteracted, { once: true, passive: true });
          document.addEventListener('scroll', markInteracted, { once: true, passive: true });

          const tryGreet = async () => {
            if (!userInteracted) { setTimeout(tryGreet, 2000); return; }
            if (sessionStorage.getItem('cappan_greeted')) return;
            sessionStorage.setItem('cappan_greeted', '1');

            const hour = new Date().getHours();
            const w = (typeof WeatherService !== 'undefined') ? await WeatherService.get().catch(() => null) : null;
            let suggest = '';
            if (w && w.isHot) suggest = 'Trời đang khá nóng, bạn có muốn thử một ly Trà Đào Cam Sả mát lạnh không?';
            else if (hour >= 11 && hour < 14) suggest = 'Đang là giờ ăn trưa, bạn có muốn gọi món kèm Bánh Flan không?';

            const box = document.getElementById('chatBox');
            if (box && !box.classList.contains('open')) toggleChat();
            if (suggest) setTimeout(() => addChatMsg(suggest, 'bot'), 800);
          };

          setTimeout(tryGreet, 8000); // Chờ 8s rồi check interaction
        }
      }
      
    }

  }
});

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
window.openAuth = function() { window.location.href = 'login.html'; };

// ⚡ Hàm xử lý Đánh giá (Rating)
window.submitRating = function(orderId, stars, el) {
  const container = el.parentNode;
  // Hiệu ứng đổi sao rỗng thành sao vàng
  container.innerHTML = `
    <span style="color:#C9A227; font-size:28px; letter-spacing:2px;">
      ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}
    </span> 
    <span style="font-size:14px; color:#2E7D32; margin-left:10px; font-weight:bold;">
      Cảm ơn bạn đã đánh giá!
    </span>`;
  
  // Ghi log vào hệ thống Metrics để Staff thống kê
  try {
  AIMetrics.logFeedback(`Đánh giá đơn ${orderId}`, `Rating ${stars} sao`, stars >= 4 ? 'up' : 'down');
  } catch(e) {}
};

/* Keyboard Shortcuts & Realtime Sync */
(function() {
  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !typing) {
      e.preventDefault();
      const box = document.getElementById('chatBox');
      if (box && !box.classList.contains('open')) toggleChat();
      setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
      return;
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      const box = document.getElementById('chatBox');
      if (box && box.classList.contains('open')) box.classList.remove('open');
      const modal = document.getElementById('uiCardModal');
      if (modal) modal.style.display = 'none';
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); if (typeof toggleChat === 'function') toggleChat(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const box = document.getElementById('chatBox');
      if (box && box.classList.contains('open')) { e.preventDefault(); if (typeof sendChat === 'function') sendChat(); }
    }
  });
})();

window.addEventListener('cappan:sync', () => { updatePageUI(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updatePageUI(); });
window.addEventListener('focus', () => { updatePageUI(); });

function updatePageUI() {
  const page = document.body.dataset.page;
  const call = (fnName) => { try { if (typeof window[fnName] === 'function') window[fnName](); } catch (err) {} };
  try {
    if (page === 'booking') { call('renderSeatMap'); call('renderFloorSwitch'); call('renderFloorSummary'); }
    else if (page === 'order') { call('renderOrderGrid'); call('renderCartMini'); }
    else if (page === 'cart') { call('renderCartPage'); }
    else if (page === 'profile') { if (typeof Profile !== 'undefined' && Profile.render) Profile.render(); }
    else if (page === 'staff-dashboard') { call('refreshAll'); }
    else if (page === 'staff-orders') { call('renderOrders'); }
    else if (page === 'staff-bookings') { call('renderBookings'); }
    else if (page === 'staff-menu') { call('renderMenu'); }
    else if (page === 'staff-promotions') { call('renderPromos'); }
    else if (page === 'staff-schedule') { call('renderSchedule'); call('renderPickerSide'); }
    else if (page === 'staff-stats') { call('renderAll'); }
    else if (page === 'staff-ai') { if (typeof render === 'function') render(); }
    call('updateUserArea');
  } catch (err) {}
}
/* ============================================================
   UX UPGRADES: MODAL SCROLL LOCK & STICKY CART
============================================================ */

// 1. Khóa cuộn trang khi mở Modal (Tránh bị trượt nền)
const originalOpenModal = window.openModal;
window.openModal = function(id) {
  if (typeof originalOpenModal === 'function') originalOpenModal(id);
  document.body.classList.add('modal-open');
};

const originalCloseModal = window.closeModal;
window.closeModal = function(id) {
  if (typeof originalCloseModal === 'function') originalCloseModal(id);
  // Chỉ mở khóa nếu không còn modal nào đang mở
  if (document.querySelectorAll('.modal-overlay.open').length === 0) {
    document.body.classList.remove('modal-open');
  }
};

// 2. Sticky Cart (Thanh thanh toán luôn dính dưới màn hình trên mobile)
document.addEventListener('DOMContentLoaded', () => {
  const checkoutBtn = document.querySelector('.cart-checkout .btn-block');
  const checkoutPanel = document.querySelector('.cart-checkout');
  
  if (checkoutBtn && checkoutPanel && window.innerWidth <= 900) {
    // Tạo một nút thanh toán nổi (Floating) cho mobile
    const floatBar = document.createElement('div');
    floatBar.className = 'mobile-checkout-bar';
    floatBar.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <div>
          <div style="font-size:0.8rem; color:#777;">Tổng cộng</div>
          <div style="font-size:1.2rem; font-weight:800; color:#2E7D32;" id="mobileTotal">0đ</div>
        </div>
        <button class="btn" style="padding:10px 24px; border-radius:12px;">Thanh toán</button>
      </div>
    `;
    floatBar.style.cssText = 'position:fixed; bottom:0; left:0; right:0; background:#fff; padding:16px; box-shadow:0 -4px 15px rgba(0,0,0,0.1); z-index:999; display:none; border-top:1px solid #eee;';
    
    // Chỉ hiển thị nếu đang ở trang giỏ hàng và có món
    if (document.body.dataset.page === 'cart') {
      document.body.appendChild(floatBar);
      
      // Cập nhật giá tiền
      const observer = new MutationObserver(() => {
        const totalEl = document.getElementById('sumTotal');
        if (totalEl && document.getElementById('mobileTotal')) {
          document.getElementById('mobileTotal').textContent = totalEl.textContent;
          floatBar.style.display = 'block';
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      
      // Nút thanh toán nổi kích hoạt hàm checkout
      floatBar.querySelector('button').onclick = () => {
        if (typeof checkout === 'function') checkout();
      };
    }
  }
});