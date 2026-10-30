const IDLE_LIMIT_MS = 10 * 60 * 1000;
const clone = (value) => structuredClone(value);

function normalize(action, value = {}) {
  const draft = clone(value);
  if (action === 'booking') {
    if (!draft.seatId && draft.capacity) draft.capacity = Number(draft.capacity);
  }
  if (action === 'order') {
    draft.items = Array.isArray(draft.items) ? draft.items : [];
    if (!draft.phone && draft.profile?.phone) draft.phone = draft.profile.phone;
  }
  return draft;
}

export function createDraftSession({ now = () => Date.now() } = {}) {
  let state = null;

  const expireIfNeeded = () => {
    if (state && now() - state.updatedAt >= IDLE_LIMIT_MS) state = null;
  };
  const touch = () => { if (state) state.updatedAt = now(); };

  return {
    start(action, initial = {}) {
      if (!['booking', 'order'].includes(action)) throw new TypeError('Loại bản nháp không hợp lệ');
      state = { action, data: normalize(action, initial), updatedAt: now() };
      return this.get();
    },
    fill(parsed = {}) {
      expireIfNeeded();
      if (!state) return null;
      const input = clone(parsed || {});
      if (typeof input.text === 'string') {
        const time = input.text.match(/(?:đổi\s+sang|chuyển\s+sang)\s*(\d{1,2}(?:h\d{0,2}|:\d{2}))/i);
        if (time) input.time = time[1].replace('h', ':').replace(/:$/, ':00');
        const add = input.text.match(/thêm\s+(\d+)\s+(?:ly|phần)\s+(.+)/i);
        if (add && state.action === 'order') {
          const itemName = add[2].trim();
          const found = state.data.items.find((item) => item.name?.toLocaleLowerCase('vi') === itemName.toLocaleLowerCase('vi'));
          if (found) found.qty = Number(found.qty || 0) + Number(add[1]);
          else state.data.items.push({ name: itemName, qty: Number(add[1]) });
        }
        delete input.text;
      }
      if (state.action === 'order' && input.profile?.phone && !state.data.phone) {
        state.data.phone = input.profile.phone;
      }
      delete input.profile;
      state.data = { ...state.data, ...input };
      touch();
      return this.get();
    },
    missing() {
      expireIfNeeded();
      if (!state) return [];
      const data = state.data;
      const absent = (field, value) => value === undefined || value === null || value === '';
      if (state.action === 'booking') {
        return [
          ...(absent('seatId', data.seatId) && absent('capacity', data.capacity) ? ['seatId hoặc capacity'] : []),
          ...(absent('date', data.date) ? ['date'] : []),
          ...(absent('time', data.time) ? ['time'] : []),
          ...(absent('guests', data.guests) ? ['guests'] : [])
        ];
      }
      return [
        ...(data.items.length ? [] : ['items']),
        ...(absent('address', data.address) ? ['address'] : []),
        ...(absent('phone', data.phone) ? ['phone'] : [])
      ];
    },
    ready() {
      const missing = this.missing();
      return Boolean(state) && missing.length === 0;
    },
    cancel() { state = null; return true; },
    get() {
      expireIfNeeded();
      return state ? { action: state.action, data: clone(state.data), updatedAt: state.updatedAt } : null;
    }
  };
}
