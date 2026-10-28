/* ============================================================
   CHAT PANEL HYBRID — Resize + Collapse + Greet staff
============================================================ */

const ChatPanel = {

  STORAGE_WIDTH: 'cappan_chat_panel_width',
  STORAGE_COLLAPSED: 'cappan_chat_panel_collapsed',
  MIN_W: 280,
  MAX_W: 600,
  DEFAULT_W: 380,

  _inited: false,
  _unread: 0,

  init() {
    if (this._inited) return;
    const layout = document.getElementById('dashboardLayout');
    const panel = document.getElementById('chatPanel');
    if (!layout || !panel) return;
    this._inited = true;

    this.normalizeCollapseIcon();
    this.restoreWidth(panel);
    this.initResizer(layout, panel);
    this.initButtons(panel);
    this.initBadge(panel);
    this.restoreCollapsed(panel);

    const body = document.getElementById('chatBody');
    const showBody = () => body?.classList.add('ready');
    setTimeout(showBody, 1500);

    const ready = () => {
      try {
        const hasHistory = this.restoreHistory();
        if (!hasHistory) {
          this.greetStaffIfFirstVisit(() => {
            this.addQuickReplies();
            this.focusInput();
          });
        } else {
          this.addQuickReplies();
          this.focusInput();
        }
      } finally {
        showBody();
        this.releaseAnimations();
      }
    };

    if (typeof AIBrain !== 'undefined') ready();
    else window.addEventListener('load', ready);
  },

  releaseAnimations() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-anim');
    }));
  },

  setState(state) {
    document.documentElement.dataset.chat = state;
  },

  normalizeCollapseIcon() {
    const btn = document.getElementById('btnCollapseChat');
    if (!btn) return;
    btn.title = 'Thu gọn bảng chat';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>`;
  },

  restoreHistory() {
    try {
      if (typeof AIBrain === 'undefined' || typeof addChatMsg !== 'function') return false;
      const sid = AIBrain._getSessionId();
      if (!sid) return false;
      // ⚡ FIX #4: gọi _getHistory TRƯỚC để nạp histories[sid] từ localStorage
      const role = typeof AIBrain._getRole === 'function' ? AIBrain._getRole() : (sid.startsWith('staff_') ? 'staff' : 'guest');
      const history = AIBrain._getHistory(sid, role) || [];
      if (history.length <= 1) return false;

      const body = document.getElementById('chatBody');
      if (!body) return false;

      this._muteBadge = true;
      body.innerHTML = '';
      let rendered = 0;
      history.forEach(item => {
        if (item.role === 'user') {
          addChatMsg(item.content, 'user');
          rendered++;
        } else if (item.role === 'assistant' && item.content) {
          if (typeof UICards !== 'undefined' && UICards.has(item.content)) {
            UICards.appendTo(item.content);
          } else {
            addChatMsg(item.content, 'bot');
          }
          rendered++;
        }
      });
      setTimeout(() => { this._muteBadge = false; }, 0);
      const hasRealContent = history.some(item =>
        item.role === 'user' ||
        (item.role === 'assistant' && item.content) ||
        (item.role === 'assistant' && item.tool_calls && item.tool_calls.length > 0)
      );
      return rendered > 0 || hasRealContent;
    } catch (e) {
      this._muteBadge = false;
      console.error('[ChatPanel] Lỗi khôi phục history:', e);
      return false;
    }
  },

  addQuickReplies() {
    if (typeof renderQuickReplies === 'function') renderQuickReplies();
  },

  focusInput() {
    const panel = document.getElementById('chatPanel');
    if (!panel || panel.classList.contains('collapsed')) return;
    if (window.matchMedia('(max-width: 900px)').matches) return;
    document.getElementById('chatInput')?.focus();
  },

  clampWidth(w, layout) {
    const layoutW = (layout || document.getElementById('dashboardLayout'))?.clientWidth || 1200;
    const max = Math.min(this.MAX_W, Math.max(this.MIN_W, layoutW - 320));
    return Math.max(this.MIN_W, Math.min(max, w));
  },

  restoreWidth(panel) {
    const saved = parseInt(localStorage.getItem(this.STORAGE_WIDTH), 10);
    if (!saved || isNaN(saved)) return;
    panel.style.width = this.clampWidth(saved) + 'px';
  },

  initResizer(layout, panel) {
    const resizer = document.getElementById('panelResizer');
    if (!resizer) return;

    let startX = 0;
    let startWidth = 0;
    let isResizing = false;

    const start = (clientX) => {
      if (panel.classList.contains('collapsed')) return;
      isResizing = true;
      startX = clientX;
      startWidth = panel.offsetWidth;
      resizer.classList.add('active');
      layout.classList.add('resizing');
    };

    const move = (clientX) => {
      if (!isResizing) return;
      const next = this.clampWidth(startWidth + (startX - clientX), layout);
      panel.style.width = next + 'px';
    };

    const end = () => {
      if (!isResizing) return;
      isResizing = false;
      resizer.classList.remove('active');
      layout.classList.remove('resizing');
      localStorage.setItem(this.STORAGE_WIDTH, String(panel.offsetWidth));
    };

    resizer.addEventListener('mousedown', (e) => { start(e.clientX); e.preventDefault(); });
    document.addEventListener('mousemove', (e) => move(e.clientX));
    document.addEventListener('mouseup', end);

    resizer.addEventListener('touchstart', (e) => start(e.touches[0].clientX), { passive: true });
    document.addEventListener('touchmove', (e) => { if (isResizing) move(e.touches[0].clientX); }, { passive: true });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);

    resizer.addEventListener('dblclick', () => {
      panel.style.width = this.DEFAULT_W + 'px';
      localStorage.setItem(this.STORAGE_WIDTH, String(this.DEFAULT_W));
    });

    window.addEventListener('resize', () => {
      if (panel.classList.contains('collapsed') || !panel.style.width) return;
      panel.style.width = this.clampWidth(parseInt(panel.style.width, 10), layout) + 'px';
    });
  },

  initButtons(panel) {
    const floatBtn = document.getElementById('chatFloatBtn');
    const collapseBtn = document.getElementById('btnCollapseChat');
    const clearBtn = document.getElementById('btnClearChat');
    const sendBtn = document.getElementById('btnSendChat');
    const input = document.getElementById('chatInput');

    collapseBtn?.addEventListener('click', () => this.collapse(panel, floatBtn));
    floatBtn?.addEventListener('click', () => this.expand(panel, floatBtn));
    clearBtn?.addEventListener('click', () => this.clearChat());

    sendBtn?.addEventListener('click', () => {
      if (typeof sendChat === 'function') sendChat();
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        if (typeof sendChat === 'function') sendChat();
      }
    });
  },

  collapse(panel, floatBtn) {
    panel.classList.add('collapsed');
    floatBtn?.classList.add('show');
    this.setState('collapsed');
    localStorage.setItem(this.STORAGE_COLLAPSED, '1');
    if (typeof hideNewMsgPill === 'function') hideNewMsgPill();
  },

  expand(panel, floatBtn) {
    panel.classList.remove('collapsed');
    floatBtn?.classList.remove('show');
    this.setState('open');
    this.clearBadge();
    localStorage.setItem(this.STORAGE_COLLAPSED, '0');

    setTimeout(() => {
      const body = document.getElementById('chatBody');
      if (body) {
        body._stick = true;
        body.scrollTop = body.scrollHeight;
        if (typeof hideNewMsgPill === 'function') hideNewMsgPill();
      }
      this.focusInput();
    }, 250);
  },

  restoreCollapsed(panel) {
    if (localStorage.getItem(this.STORAGE_COLLAPSED) !== '1') { this.setState('open'); return; }
    this.setState('collapsed');
    panel.classList.add('collapsed');
    document.getElementById('chatFloatBtn')?.classList.add('show');
  },

  initBadge(panel) {
    const floatBtn = document.getElementById('chatFloatBtn');
    const body = document.getElementById('chatBody');
    if (!floatBtn || !body) return;

    let badge = floatBtn.querySelector('.chat-float-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'chat-float-badge';
      floatBtn.appendChild(badge);
    }

    new MutationObserver((mutations) => {
      if (this._muteBadge || !panel.classList.contains('collapsed')) return;
      let added = 0;
      mutations.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (!n.classList?.contains('msg') || !n.classList.contains('bot')) return;
        if (n.id === 'typingIndicator') return;
        if (n.classList.contains('typing-bubble')) return;
        if (n.querySelector('.typing-bubble')) return;
        added++;
      }));
      if (added > 0) {
        this._unread += added;
        this.renderBadge();
      }
    }).observe(body, { childList: true });
  },

  renderBadge() {
    const badge = document.querySelector('#chatFloatBtn .chat-float-badge');
    if (!badge) return;
    badge.textContent = this._unread > 9 ? '9+' : String(this._unread);
    badge.classList.toggle('show', this._unread > 0);
  },

  clearBadge() {
    this._unread = 0;
    const badge = document.querySelector('#chatFloatBtn .chat-float-badge');
    if (badge) {
      badge.textContent = '';
      badge.classList.remove('show');
    }
  },

  clearChat() {
    if (!confirm('Xóa toàn bộ lịch sử trò chuyện?')) return;
    try {
      if (typeof AIBrain !== 'undefined') {
        const sid = AIBrain._getSessionId();
        AIBrain._clearHistory(sid);
        sessionStorage.removeItem('cappan_greeted_' + sid);
      }
    } catch (e) { console.error('[ChatPanel] Lỗi xóa history:', e); }

    const body = document.getElementById('chatBody');
    if (body) {
      this._muteBadge = true;
      body.innerHTML = `
        <div class="msg bot">
          <div class="bubble">Đã xóa lịch sử. Anh/chị cần hỗ trợ gì ạ?</div>
        </div>
      `;
      if (typeof hideNewMsgPill === 'function') hideNewMsgPill();
      body._stick = true;
      body.scrollTop = 0;
      setTimeout(() => { this._muteBadge = false; }, 0);
    }
    this.clearBadge();
    this.addQuickReplies();
  },

  greetStaffIfFirstVisit(callback) {
    const done = () => { if (typeof callback === 'function') callback(); };

    let user = null;
    try { user = API.users.getCurrent(); } catch (e) {}
    if (!user || user.role !== 'staff' || typeof AIBrain === 'undefined') return done();

    const sid = AIBrain._getSessionId();
    const greetKey = 'cappan_greeted_' + sid;
    if (sessionStorage.getItem(greetKey)) return done();
    sessionStorage.setItem(greetKey, '1');

    const hour = new Date().getHours();
    let timeGreet = 'Chào buổi sáng';
    if (hour >= 11 && hour < 14) timeGreet = 'Chào buổi trưa';
    else if (hour >= 14 && hour < 18) timeGreet = 'Chào buổi chiều';
    else if (hour >= 18) timeGreet = 'Chào buổi tối';

    const greeting = `${timeGreet} ${user.name}!\n\nEm là trợ lý CAPPAN. Anh/chị cần hỗ trợ gì hôm nay?`;

    try {
      if (typeof addChatMsg === 'function') addChatMsg(greeting, 'bot');
    } catch (e) {
      console.warn('[chat-panel] greet failed:', e);
    }
    done();
  }
};

document.addEventListener('DOMContentLoaded', () => ChatPanel.init());