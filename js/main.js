/* ============================================================
   MAIN.JS — FINAL v2
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
      <a href="staff-dashboard.html" class="user-link">👨‍💼 ${user.name}</a>
      <button onclick="handleLogout()">Đăng xuất</button>
    `;
    return;
  }

  el.innerHTML = `
    ${cartBtn}
    <a href="profile.html" class="user-link">👤 ${user.name}</a>
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

/* ---------- 8. ADD CHAT MSG ---------- */
function addChatMsg(text, who) {
  const body = document.getElementById('chatBody');
  if (!body) return;
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  const safe = escapeHtml(filterMarkdown(text));
  div.innerHTML = `<div class="bubble">${safe.replace(/\n/g, '<br>')}</div>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
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
      addChatMsg(res.message || res, 'bot');
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

/* ============================================================
   11. QUICK REPLIES — ⚡ ĐÃ ĐỊNH NGHĨA Ở ĐÂY
============================================================ */
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
   SEND CHAT — STREAMING MƯỢT (v2)
   - Typing indicator (3 chấm) khi chờ LLM
   - Bubble LAZY (chỉ tạo khi có chunk đầu)
   - Append text (không ghi lại toàn bộ)
   - Xử lý tool → typing → bubble mới
============================================================ */
async function sendChat() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  /* ---------- GUARD ---------- */
  if (typeof AIBrain === 'undefined' || typeof AIBrain.streamReply !== 'function') {
    addChatMsg(text, 'user');
    input.value = '';
    addChatMsg('Xin lỗi, em chưa sẵn sàng. Anh/chị thử lại sau nhé!', 'bot');
    return;
  }

  const qr = document.getElementById('quickReplies');
  if (qr) qr.remove();

  addChatMsg(text, 'user');
  input.value = '';

  const body = document.getElementById('chatBody');
  if (!body) return;

  /* ============================================================
     STATE
  ============================================================ */
  let botDiv = null;              // khung bot hiện tại
  let streamTxt = null;           // span chứa text
  let cursorEl = null;            // span cursor '|'
  let renderedLength = 0;         // độ dài đã render
  let firstChunkReceived = false; // đã nhận chunk đầu?

  /* ============================================================
     LAZY CREATE BUBBLE — chỉ tạo khi có chunk đầu tiên
  ============================================================ */
  const ensureBubble = () => {
    if (botDiv) return;           // đã có → không tạo lại

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
    cursorEl  = botDiv.querySelector('.streaming-cursor');
  };

  const removeCursor = () => {
    if (cursorEl && cursorEl.parentNode) cursorEl.remove();
    cursorEl = null;
  };

  const resetBubble = () => {
    // Xóa bubble cũ nếu có
    if (botDiv && botDiv.parentNode) botDiv.remove();
    botDiv = null;
    streamTxt = null;
    cursorEl = null;
    renderedLength = 0;
    firstChunkReceived = false;
  };

  /* ============================================================
     ONCHUNK — được gọi mỗi khi có token mới
     - Lần đầu: ẩn typing, tạo bubble
     - Các lần sau: append text mới
  ============================================================ */
  const onChunk = (delta, full) => {
    // ⚡ Lần đầu — ẩn typing, tạo bubble
    if (!firstChunkReceived) {
      firstChunkReceived = true;
      hideTypingIndicator();
      ensureBubble();
    }

    // ⚡ Chỉ append phần MỚI — không ghi lại toàn bộ
    const newPart = full.slice(renderedLength);
    if (!newPart) return;

    streamTxt.appendChild(document.createTextNode(newPart));
    renderedLength = full.length;
    body.scrollTop = body.scrollHeight;
  };

  /* ============================================================
     PHASE CALLBACK — brain báo khi chuyển sang stream 2
  ============================================================ */
  AIBrain._onPhaseChange = (phase) => {
    if (phase === 'stream2') {
      // Xóa bubble hiện tại (nếu có) — vì sẽ stream lần 2
      removeCursor();
      resetBubble();
      // Hiện typing cho stream 2
      showTypingIndicator();
    }
  };

  /* ============================================================
     BẮT ĐẦU — hiện typing ngay, KHÔNG hiện bubble
  ============================================================ */
  showTypingIndicator();

  try {
    const response = await AIBrain.streamReply(text, onChunk);

    /* ---------- PENDING CONFIRM ---------- */
    if (response && response.type === 'pending') {
      hideTypingIndicator();
      // Xóa bubble streaming (nếu có) — thay bằng nút
      if (botDiv && botDiv.parentNode) botDiv.remove();
      botDiv = null;

      addConfirmButtons(
        response.message,
        response.toolName,
        response.toolCallId,
        response.args
      );
      return;
    }

    /* ---------- XONG — ẨN TYPING + CURSOR ---------- */
    hideTypingIndicator();
    removeCursor();

    /* ---------- FALLBACK: KHÔNG CÓ CHUNK NÀO ---------- */
    if (!firstChunkReceived) {
      ensureBubble();
      streamTxt.textContent =
        'Xin lỗi, em chưa có câu trả lời cho câu hỏi này. Anh/chị hỏi lại giúp em nhé!';
      return;
    }

    /* ---------- FALLBACK: TEXT RỖNG ---------- */
    const finalMsg = (response && response.message) ? response.message : '';
    if (!finalMsg.trim() && streamTxt && !streamTxt.textContent.trim()) {
      streamTxt.textContent =
        'Xin lỗi, em chưa có câu trả lời cho câu hỏi này. Anh/chị hỏi lại giúp em nhé!';
    }

  } catch (e) {
    console.error('[sendChat] lỗi:', e);
    hideTypingIndicator();
    removeCursor();

    if (!firstChunkReceived) {
      ensureBubble();
      streamTxt.textContent =
        'Xin lỗi, em đang gặp sự cố kỹ thuật. Anh/chị thử lại nhé!';
    } else if (streamTxt && !streamTxt.textContent.trim()) {
      streamTxt.textContent =
        'Xin lỗi, em đang gặp sự cố kỹ thuật. Anh/chị thử lại nhé!';
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
        addChatMsg(item.content, 'bot');
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