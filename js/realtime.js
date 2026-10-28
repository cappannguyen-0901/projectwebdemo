(function() {
  // ⚡ HARDENING: mọi truy cập storage đều bọc try/catch — trình duyệt chặn storage
  // ("Block all cookies") không được giết module (trước đây hook realtime sẽ không cài).
  const _lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const _lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const _lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

  const channel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('cappan_sync') : null;

  let lastSyncTime = _lsGet('cappan_sync_ping') || '0';

  // ⚡ BẢN ĐỒ ÁNH XẠ SỰ KIỆN: Tách kênh lõi và kênh AI
  const ROUTABLE_EVENTS = {
    'data:changed': 'cappan:sync',
    'ai:metrics':   'cappan:ai-metrics',
    'ai:feedback':  'cappan:ai-feedback'
  };

  window.Realtime = {
emit(event, payload) {
  const ping = Date.now() + Math.random();
  lastSyncTime = String(ping);   // ⚡ FIX #3: chặn polling tự kích tab gốc
  _lsSet('cappan_sync_ping', String(ping));
  try {
    if (channel) channel.postMessage({ event, payload, ts: ping });
  } catch (e) {}
},
    on(event, handler) {
      const domEvent = ROUTABLE_EVENTS[event];
      if (!domEvent) { console.warn('[Realtime] unknown event:', event); return; }
      window.addEventListener(domEvent, () => handler({ event }));
    }
  };

  function routeSync(payload) {
    const evt = payload && payload.event;
    const domEvent = ROUTABLE_EVENTS[evt] || ROUTABLE_EVENTS['data:changed'];
    window.dispatchEvent(new CustomEvent(domEvent, { detail: { event: evt || 'data:changed' } }));
  }

  // Lớp 1: BroadcastChannel
  if (channel) {
    channel.addEventListener('message', (e) => { if (e.data) routeSync(e.data); });
  }

  // Lớp 2: Storage Event (Fallback)
  window.addEventListener('storage', (e) => {
    if (e.key === 'cappan_sync_ping') {
      routeSync({ event: 'data:changed' });
      lastSyncTime = e.newValue;
    }
  });

  // Lớp 3: Polling (Bảo hiểm)
  setInterval(() => {
    const currentPing = _lsGet('cappan_sync_ping') || '0';
    if (currentPing !== lastSyncTime) {
      lastSyncTime = currentPing;
      routeSync({ event: 'data:changed' });
    }
  }, 2000);

  // Hook API thay đổi dữ liệu lõi
  const hook = (obj, method) => {
    if (!obj || typeof obj[method] !== 'function') return;
    const orig = obj[method];
    obj[method] = function(...args) {
      const result = orig.apply(this, args);
      try { Realtime.emit('data:changed'); } catch (e) {}
      return result;
    };
  };

  if (typeof API !== 'undefined') {
    ['bookings', 'seats', 'orders', 'menu', 'promotions', 'users', 'cart', 'shifts', 'staff'].forEach(module => {
      if (API[module]) {
        Object.keys(API[module]).forEach(method => {
          if (typeof API[module][method] === 'function' && 
             !method.startsWith('get') && 
             !method.startsWith('_') && 
             method !== 'syncFromBookings') {
            hook(API[module], method);
          }
        });
      }
    });
  }
})();