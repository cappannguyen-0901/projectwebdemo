(function() {
  const channel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('cappan_sync') : null;
  
  // Biến lưu trữ mốc thời gian đồng bộ cuối cùng
  let lastSyncTime = localStorage.getItem('cappan_sync_ping') || '0';

  window.Realtime = {
    emit(event, payload) {
      const ping = Date.now() + Math.random(); // Tạo ID độc nhất
      localStorage.setItem('cappan_sync_ping', String(ping));
      try {
        if (channel) channel.postMessage({ event, payload, ts: ping });
      } catch (e) {}
    }
  };

  // Hàm kích hoạt render giao diện
  function handleSync() {
    window.dispatchEvent(new CustomEvent('cappan:sync', { detail: { event: 'data:changed' } }));
  }

  // Lớp 1: Lắng nghe qua BroadcastChannel (Tốc độ mili-giây)
  if (channel) {
    channel.addEventListener('message', (e) => {
      if (e.data) handleSync();
    });
  }

  // Lớp 2: Lắng nghe qua Storage Event (Dự phòng)
  window.addEventListener('storage', (e) => {
    if (e.key === 'cappan_sync_ping') {
      handleSync();
      lastSyncTime = e.newValue;
    }
  });

  // Lớp 3: POLLING - Quét mỗi 1 giây (Bảo hiểm 100% không bao giờ trượt)
  setInterval(() => {
    const currentPing = localStorage.getItem('cappan_sync_ping') || '0';
    if (currentPing !== lastSyncTime) {
      lastSyncTime = currentPing;
      handleSync();
    }
  }, 2000);

  // Cắm cảm biến vào tất cả các API thay đổi dữ liệu
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
    ['bookings', 'seats', 'orders', 'menu', 'promotions', 'users', 'cart', 'shifts'].forEach(module => {
      if (API[module]) {
        Object.keys(API[module]).forEach(method => {
          // Chỉ hook các hàm có khả năng thay đổi dữ liệu (bỏ qua hàm get)
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

  if (typeof AIMetrics !== 'undefined') {
    hook(AIMetrics, 'log');
    hook(AIMetrics, 'clear');
    hook(AIMetrics, 'logFeedback');
  }
})();