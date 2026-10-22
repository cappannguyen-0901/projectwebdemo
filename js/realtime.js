(function() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('cappan_sync');
  window.Realtime = {
    emit(event, payload) {
      try { channel.postMessage({ event, payload, ts: Date.now() }); } catch (e) {}
    },
    on(event, handler) {
      channel.addEventListener('message', e => {
        if (e.data && e.data.event === event) handler(e.data.payload);
      });
    }
  };
  const hook = (obj, method, eventName, payloadFn) => {
    if (!obj || typeof obj[method] !== 'function') return;
    const orig = obj[method];
    obj[method] = function(...args) {
      const result = orig.apply(this, args);
      try { Realtime.emit(eventName, payloadFn ? payloadFn(args, result) : { args }); } catch (e) {}
      return result;
    };
  };
  if (typeof API !== 'undefined') {
    hook(API.bookings, 'create', 'booking:changed');
    hook(API.bookings, 'cancel', 'booking:changed');
    hook(API.bookings, 'complete', 'booking:changed');
    hook(API.orders, 'create', 'order:changed');
    hook(API.orders, 'updateStep', 'order:changed');
  }
})();