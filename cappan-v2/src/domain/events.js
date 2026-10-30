/* Event bus nội bộ, không phụ thuộc DOM hoặc storage. */
export function createEventBus({ logger = console } = {}) {
  const listeners = new Map();
  return Object.freeze({
    on(name, listener) {
      if (typeof listener !== 'function') throw new TypeError('listener phải là hàm');
      const rows = listeners.get(name) || new Set();
      rows.add(listener);
      listeners.set(name, rows);
      return () => rows.delete(listener);
    },
    emit(name, payload) {
      for (const listener of listeners.get(name) || []) {
        try {
          Promise.resolve(listener(payload)).catch((error) => {
            logger.error?.(`[CAPPAN event ${name}]`, error);
          });
        } catch (error) {
          logger.error?.(`[CAPPAN event ${name}]`, error);
        }
      }
    }
  });
}
