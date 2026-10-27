/* ============================================================
   PROACTIVE ENGINE — Heartbeat 90s, Gợi ý chủ động
============================================================ */
const ProactiveEngine = {
  INTERVAL_MS: 90 * 1000,
  _timer: null,
  _enabled: false,

  start() {
    if (this._enabled) return;
    this._enabled = true;
    this._timer = setInterval(() => this._tick(), this.INTERVAL_MS);
  },
  stop() {
    if (this._timer) clearInterval(this._timer);
    this._enabled = false;
  },

  _tick() {
    try {
      const user = API.users.getCurrent();
      if (!user || user.role !== 'customer') return;
      if (typeof LocalBrain !== 'undefined' && (LocalBrain.bookingDraft || LocalBrain.orderDraft)) return;

      const box = document.getElementById('chatBox');
      if (box && box.classList.contains('open')) return;
      if (!UserMemory.shouldNudge(user.id)) return;

      const lastOrder = API.orders.getByUser(user.id).slice(-1)[0];
      if (lastOrder && (Date.now() - new Date(lastOrder.createdAt).getTime() < 10 * 60 * 1000)) return;

      const trigger = this._detectTrigger(user);
      if (!trigger) return;

      this._fire(trigger);
      UserMemory.markNudged(user.id);
    } catch (e) {}
  },

  _detectTrigger(user) {
    const mem = UserMemory.get(user.id);
    const hour = new Date().getHours();
    const cart = API.cart.get();
    const lastOrderAt = lastOrderTime(user.id);

    // 1. Cart abandon > 20 phút
    if (cart.length >= 2) {
      const cartAt = parseInt(sessionStorage.getItem('cappan_cart_last_add') || '0', 10);
      if (cartAt && Date.now() - cartAt > 20 * 60 * 1000) {
        return { kind: 'cart_abandon', message: `Dạ giỏ hàng của anh/chị còn ${cart.length} món chưa thanh toán. Em giữ giá giúp anh/chị, bấm vào đây để hoàn tất nhé!`, action: { label: 'Thanh toán ngay', href: 'cart.html' } };
      }
    }

    // 2. Quay lại sau >= 3 ngày
    if (lastOrderAt && Date.now() - lastOrderAt > 3 * 24 * 60 * 60 * 1000) {
      const fav = mem.favCategory ? (API.categories.getById(mem.favCategory)?.name || '') : '';
      return { kind: 'returning', message: `Chào mừng anh/chị quay lại CAPPAN! ${fav ? `Món ${fav} vẫn đang chờ anh/chị.` : 'Quán có nhiều món mới, ghé xem nhé!'}`, action: { label: 'Xem menu', href: 'menu.html' } };
    }

    // 3. Giờ xế chiều (15-16h)
    if (hour >= 15 && hour <= 16 && !hasOrderedToday(user.id)) {
      return { kind: 'afternoon', message: `Dạ đang là giờ xế chiều, một ly trà hoặc cà phê sẽ giúp anh/chị tỉnh táo cho buổi còn lại ạ.`, action: { label: 'Xem gợi ý', href: 'menu.html' } };
    }
    return null;
  },

  _fire(trigger) {
    if (typeof toggleChat === 'function') toggleChat();
    setTimeout(() => {
      if (typeof addChatMsg === 'function') addChatMsg(trigger.message, 'bot');
      if (trigger.action && typeof UICards !== 'undefined') {
        const card = `[UI_WELCOME]${JSON.stringify({ title: '💡 Gợi ý nhanh', desc: '', options: [{ label: trigger.action.label, href: trigger.action.href }] })}[/UI_WELCOME]`;
        UICards.appendTo(card);
      }
    }, 300);
  }
};
window.ProactiveEngine = ProactiveEngine;

function lastOrderTime(userId) {
  const arr = API.orders.getByUser(userId);
  return arr.length ? new Date(arr[arr.length - 1].createdAt).getTime() : 0;
}
function hasOrderedToday(userId) {
  const today = API.utils.today();
  return API.orders.getByUser(userId).some(o => new Date(o.createdAt).toISOString().slice(0, 10) === today);
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-ui-add], .add-cart-btn, [data-ui-add-item]')) {
    try { sessionStorage.setItem('cappan_cart_last_add', String(Date.now())); } catch {}
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const user = API.users.getCurrent?.();
  if (user && user.role === 'customer') {
    setTimeout(() => ProactiveEngine.start(), 30000);
  }
});