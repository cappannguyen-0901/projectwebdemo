/* Sổ năng lực chỉ đọc. Mô-đun thuần, không DOM; mọi dữ liệu đi qua API facade. */
import { ApiError } from '../core/errors.js';
import { authorize } from '../domain/policy.js';

const CONFIRM_KEY = Symbol('capability-confirmation');
const guardedExecute = (handler) => async (api, args, actor, key) => {
  if (key !== CONFIRM_KEY) throw new ApiError('FORBIDDEN', 'Năng lực ghi chỉ chạy sau khi xác nhận');
  return handler(api, args, actor);
};

const publicRoles = Object.freeze(['guest', 'customer', 'staff', 'owner']);
const accountRoles = Object.freeze(['customer', 'staff', 'owner']);
const objectInput = (properties = {}, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false
});

export const CAPABILITIES = Object.freeze({
  'menu.search': Object.freeze({
    name: 'menu.search',
    description: 'Tìm món trong thực đơn đang bán.',
    input: objectInput({ query: { type: 'string', minLength: 1, maxLength: 80 } }, ['query']),
    roles: publicRoles,
    risk: 'read',
    async handler(api, args) {
      const query = normalize(args.query);
      const items = await api.menu.getAll();
      return { type: 'menu.items', data: { items: items.filter((item) => item.inStock && normalize(`${item.name} ${item.description || ''}`).includes(query)) } };
    }
  }),
  'menu.recommend': Object.freeze({
    name: 'menu.recommend',
    description: 'Gợi ý món còn bán theo sở thích.',
    input: objectInput({ preference: { type: 'string', maxLength: 80 } }),
    roles: publicRoles,
    risk: 'read',
    async handler(api, args) {
      const items = (await api.menu.getAll()).filter((item) => item.inStock);
      const term = args.preference ? normalize(args.preference) : '';
      const matches = term
        ? items.filter((item) => normalize(`${item.name} ${item.description || ''}`).includes(term))
        : [];
      return { type: 'menu.items', data: { items: (matches.length ? matches : items).slice(0, 5) } };
    }
  }),
  'booking.availability': Object.freeze({
    name: 'booking.availability',
    description: 'Xem bàn còn trống theo ngày.',
    input: objectInput({ date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } }, ['date']),
    roles: publicRoles,
    risk: 'read',
    async handler(api, args) {
      const seats = await api.seats.getMap(args.date);
      return { type: 'booking.seats', data: { seats: seats.map(({ id, floorId, capacity, status }) => ({ id, floorId, capacity, status })) } };
    }
  }),
  'booking.mine': Object.freeze({
    name: 'booking.mine',
    description: 'Xem đặt chỗ của tài khoản hiện tại.',
    input: objectInput(),
    roles: accountRoles,
    risk: 'read',
    async handler(api, _args, actor) {
      const bookings = await api.bookings.getByUser(actor.userId);
      return { type: 'booking.list', data: { bookings: bookings.filter((booking) => booking.userId === actor.userId) } };
    }
  }),
  'order.mine': Object.freeze({
    name: 'order.mine',
    description: 'Xem đơn hàng của tài khoản hiện tại.',
    input: objectInput(),
    roles: accountRoles,
    risk: 'read',
    async handler(api, _args, actor) {
      const orders = await api.orders.getByUser(actor.userId);
      return { type: 'order.list', data: { orders: orders.filter((order) => order.userId === actor.userId) } };
    }
  }),
  'order.status': Object.freeze({
    name: 'order.status',
    description: 'Xem trạng thái đơn theo mã.',
    input: objectInput({ id: { type: 'string', minLength: 1, maxLength: 100 } }, ['id']),
    roles: accountRoles,
    risk: 'read',
    async handler(api, args) {
      const order = await api.orders.getById(args.id);
      if (!order) throw new ApiError('NOT_FOUND', `Không tìm thấy đơn ${args.id}`);
      return { type: 'order.status', data: { order } };
    }
  }),
  'profile.me': Object.freeze({
    name: 'profile.me',
    description: 'Xem hồ sơ của tài khoản hiện tại.',
    input: objectInput(),
    roles: accountRoles,
    risk: 'read',
    async handler(api, _args, actor) {
      const profile = await api.users.getById(actor.userId);
      if (!profile) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ');
      return { type: 'profile.me', data: { profile } };
    }
  }),
  'order.queue': Object.freeze({
    name: 'order.queue', description: 'Xem các đơn đang được xử lý.',
    input: objectInput(), roles: ['staff', 'owner'], policyAction: 'order.queue.read', risk: 'read',
    async handler(api) {
      const orders = (await api.orders.getAll()).filter((order) => order.status !== 'cancelled' && order.step >= 0 && order.step < 4);
      return { type: 'order.queue', data: { orders } };
    }
  }),
  'booking.today': Object.freeze({
    name: 'booking.today', description: 'Xem các đặt chỗ hôm nay và nhóm trễ.',
    input: objectInput(), roles: ['staff', 'owner'], policyAction: 'booking.today.read', risk: 'read',
    async handler(api) {
      const today = api.utils.today();
      const rows = (await api.bookings.getAll()).filter((booking) => booking.date === today);
      const bookings = await Promise.all(rows.map(async (booking) => ({
        ...booking,
        phase: api.bookings.phase(booking),
        customerName: booking.userId ? (await api.users.getById(booking.userId))?.name || 'Khách hàng' : 'Khách'
      })));
      return { type: 'booking.today', data: { date: today, bookings, late: bookings.filter((booking) => booking.phase === 'late') } };
    }
  }),
  'stats.summary': Object.freeze({
    name: 'stats.summary', description: 'Xem số liệu tổng hợp theo ngày, tuần hoặc tháng.',
    input: objectInput({ period: { type: 'string', enum: ['day', 'week', 'month'] } }, ['period']),
    roles: ['staff', 'owner'], policyAction: 'stats.read', risk: 'read',
    async handler(api, args) { return { type: 'stats.summary', data: await api.stats.summary(args.period) }; }
  }),
  'shift.today': Object.freeze({
    name: 'shift.today', description: 'Xem lịch ca và nhân viên hôm nay.',
    input: objectInput(), roles: ['staff', 'owner'], policyAction: 'shift.today.read', risk: 'read',
    async handler(api) {
      const date = api.utils.today();
      const [shifts, schedule, staff] = await Promise.all([api.shifts.getAll(), api.shifts.getSchedule(), api.staff.getAll()]);
      const staffById = new Map(staff.map((person) => [person.id, person.name]));
      return { type: 'shift.today', data: { date, shifts: shifts.map((shift) => ({
        ...shift, staff: (schedule[date]?.[shift.id] || []).map((id) => ({ id, name: staffById.get(id) || 'Nhân viên' }))
      })) } };
    }
  }),
  'menu.outOfStock': Object.freeze({
    name: 'menu.outOfStock', description: 'Xem các món đang hết hàng.',
    input: objectInput(), roles: ['staff', 'owner'], policyAction: 'menu.stock.read', risk: 'read',
    async handler(api) { return { type: 'menu.outOfStock', data: { items: await api.menu.getOutOfStock() } }; }
  }),
  'order.create': Object.freeze({
    name: 'order.create', description: 'Tạo đơn giao món.',
    input: objectInput({ items: { type: 'array', minItems: 1 }, address: { type: 'string', minLength: 1, maxLength: 300 },
      phone: { type: 'string', minLength: 8, maxLength: 15 }, promoCode: { type: 'string', maxLength: 40 },
      note: { type: 'string', maxLength: 300 } }, ['items', 'address', 'phone']),
    roles: publicRoles, risk: 'write',
    async prepare(api, args) {
      const quote = await api.orders.previewCreate(args);
      return { title: 'Xác nhận đặt nước', lines: [
        ...quote.items.map((item) => `${item.qty} × ${item.name} — ${(item.price * item.qty).toLocaleString('vi-VN')}đ`),
        `Giao đến: ${quote.address}`, `Tổng cộng: ${quote.total.toLocaleString('vi-VN')}đ`
      ] };
    },
    execute: guardedExecute((api, args) => api.orders.create(args))
  }),
  'order.cancel': Object.freeze({
    name: 'order.cancel', description: 'Hủy đơn giao món.',
    input: objectInput({ id: { type: 'string', minLength: 1, maxLength: 100 } }, ['id']),
    roles: publicRoles, risk: 'destructive',
    async prepare(api, args) {
      const order = await api.orders.getById(args.id);
      if (!order) throw new ApiError('NOT_FOUND', `Không tìm thấy đơn ${args.id}`);
      return { title: 'Xác nhận hủy đơn', lines: [`Đơn ${order.id}`, `Trạng thái: ${order.status}`, `Tổng tiền: ${Number(order.total || 0).toLocaleString('vi-VN')}đ`] };
    },
    execute: guardedExecute((api, args) => api.orders.cancel(args.id))
  }),
  'booking.create': Object.freeze({
    name: 'booking.create', description: 'Đặt bàn.',
    input: objectInput({ seatId: { type: 'string', minLength: 1, maxLength: 20 }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      time: { type: 'string', pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$' }, guests: { type: 'number', minimum: 1, maximum: 20 },
      note: { type: 'string', maxLength: 300 } }, ['seatId', 'date', 'time', 'guests']),
    roles: accountRoles, risk: 'write',
    async prepare(api, args) {
      const preview = await api.bookings.previewCreate(args);
      return { title: `Xác nhận đặt bàn ${preview.seat.id}`, lines: [
        `${preview.booking.date} lúc ${preview.booking.time} · ${preview.booking.guests} khách`,
        `Tiền cọc: ${preview.depositAmount.toLocaleString('vi-VN')}đ`,
        `Hạn trả cọc: ${preview.depositExpiresAt.slice(11, 16)}`
      ] };
    },
    execute: guardedExecute((api, args) => api.bookings.create(args))
  }),
  'booking.cancel': Object.freeze({
    name: 'booking.cancel', description: 'Hủy đặt bàn.',
    input: objectInput({ id: { type: 'string', minLength: 1, maxLength: 100 } }, ['id']),
    roles: accountRoles, risk: 'destructive',
    async prepare(api, args) {
      const preview = await api.bookings.previewCancel(args.id);
      return { title: 'Xác nhận hủy đặt bàn', lines: [
        `Đặt chỗ ${args.id}`, `Giai đoạn: ${preview.phase}`,
        `Tiền hoàn: ${preview.refundAmount.toLocaleString('vi-VN')}đ (${Math.round(preview.refundRate * 100)}%)`
      ] };
    },
    execute: guardedExecute((api, args) => api.bookings.cancel(args.id))
  })
});

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi');
}

function validateInput(schema, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError('VALIDATION', 'Tham số phải là đối tượng');
  const allowed = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ApiError('VALIDATION', `Tham số không hỗ trợ: ${key}`);
  }
  for (const key of schema.required) {
    if (!(key in value)) throw new ApiError('VALIDATION', `Thiếu tham số: ${key}`);
  }
  for (const [key, rule] of Object.entries(schema.properties)) {
    if (!(key in value)) continue;
    const input = value[key];
    if (rule.type === 'string' && typeof input !== 'string')
      throw new ApiError('VALIDATION', `${key} phải là chuỗi`);
    if (rule.type === 'string' && rule.minLength && input.trim().length < rule.minLength)
      throw new ApiError('VALIDATION', `${key} quá ngắn`);
    if (rule.type === 'string' && rule.maxLength && input.length > rule.maxLength)
      throw new ApiError('VALIDATION', `${key} quá dài`);
    if (rule.type === 'number' && (typeof input !== 'number' || !Number.isFinite(input)))
      throw new ApiError('VALIDATION', `${key} phải là số`);
    if (rule.type === 'number' && (input < rule.minimum || input > rule.maximum))
      throw new ApiError('VALIDATION', `${key} nằm ngoài giới hạn`);
    if (rule.type === 'boolean' && typeof input !== 'boolean') throw new ApiError('VALIDATION', `${key} phải là đúng hoặc sai`);
    if (rule.enum && !rule.enum.includes(input)) throw new ApiError('VALIDATION', `${key} không nằm trong danh sách cho phép`);
    if (rule.type === 'array' && !Array.isArray(input)) throw new ApiError('VALIDATION', `${key} phải là danh sách`);
    if (rule.type === 'array' && rule.minItems && input.length < rule.minItems)
      throw new ApiError('VALIDATION', `${key} cần ít nhất ${rule.minItems} mục`);
    if (rule.type === 'array' && key === 'items') {
      for (const item of input) {
        if (!item || typeof item !== 'object' || typeof item.itemId !== 'string' || !item.itemId.trim())
          throw new ApiError('VALIDATION', 'Mỗi món cần mã món hợp lệ');
        if (Object.keys(item).some((field) => !['itemId', 'qty', 'size', 'toppings'].includes(field)))
          throw new ApiError('VALIDATION', 'Món có trường không được hỗ trợ');
        if (item.qty !== undefined && (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99))
          throw new ApiError('VALIDATION', 'Số lượng món không hợp lệ');
        if (item.size !== undefined && typeof item.size !== 'string') throw new ApiError('VALIDATION', 'Cỡ món không hợp lệ');
        if (item.toppings !== undefined && !Array.isArray(item.toppings)) throw new ApiError('VALIDATION', 'Topping phải là danh sách');
      }
    }
    if (rule.pattern && !(new RegExp(rule.pattern).test(input)))
      throw new ApiError('VALIDATION', `${key} không đúng định dạng`);
  }
}

async function execute(name, args, actor, api) {
  const capability = CAPABILITIES[name];
  if (!capability) throw new ApiError('NOT_FOUND', `Không có năng lực ${name}`);
  if (capability.risk !== 'read') throw new ApiError('FORBIDDEN', 'Năng lực ghi phải đi qua bước xác nhận');
  validateInput(capability.input, args);

  let resource = null;
  if (name === 'order.status') {
    const order = await api.orders.getById(args.id);
    if (!order) throw new ApiError('NOT_FOUND', `Không tìm thấy đơn ${args.id}`);
    resource = { ownerId: order.userId };
  } else if (capability.input.required.includes('id')) {
    resource = { ownerId: actor.userId };
  } else if (['booking.mine', 'order.mine', 'profile.me'].includes(name)) {
    resource = { ownerId: actor?.userId };
  }
  const access = authorize(actor, capability.policyAction || name, resource);
  if (!access.allowed) throw new ApiError(actor?.role === 'guest' ? 'UNAUTHORIZED' : 'FORBIDDEN', access.reason);

  return capability.handler(api, args, actor);
}

export function createCapabilityRunner(api, { now = () => Date.now() } = {}) {
  const pending = new Map();
  const windows = new Map();
  const canonical = (value) => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  };
  const hash = async (value) => {
    const bytes = new TextEncoder().encode(canonical(value));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  const actorKey = (actor) => JSON.stringify([actor?.userId || null, actor?.role || 'guest', actor?.channel || 'chat']);
  const denied = async (actor, action, code, targetId = null) => {
    try { await api.audit?.recordDenied?.(actor, action, targetId, code); } catch { /* audit không được chặn thao tác */ }
  };
  const auth = async (name, args, actor) => {
    const capability = CAPABILITIES[name];
    if (!capability) throw new ApiError('NOT_FOUND', `Không có năng lực ${name}`);
    const targetId = args?.id || null;
    validateInput(capability.input, args);
    let resource = null;
    if (['order.status', 'order.cancel'].includes(name)) {
      const row = await api.orders.getById(args.id);
      if (!row) throw new ApiError('NOT_FOUND', `Không tìm thấy đơn ${args.id}`);
      resource = { ownerId: row.userId };
    } else if (name === 'booking.cancel') {
      const row = await api.bookings.getById(args.id);
      if (!row) throw new ApiError('NOT_FOUND', `Không tìm thấy đặt chỗ ${args.id}`);
      resource = { ownerId: row.userId };
    } else if (['booking.mine', 'order.mine', 'profile.me'].includes(name)) resource = { ownerId: actor?.userId };
    const access = authorize(actor, capability.policyAction || name, resource);
    if (!access.allowed) {
      const code = actor?.role === 'guest' ? 'UNAUTHORIZED' : 'FORBIDDEN';
      await denied(actor, name, code, targetId);
      throw new ApiError(code, access.reason);
    }
    return capability;
  };
  const chatApi = typeof api.forChannel === 'function' ? api.forChannel('chat') : api;
  return Object.freeze({
    run: (name, args, actor) => execute(name, args, actor, api),
    async prepare(name, args, actor) {
      const capability = await auth(name, args, actor);
      if (capability.risk === 'read') throw new ApiError('VALIDATION', 'Năng lực chỉ đọc không cần xác nhận');
      const key = actorKey(actor);
      const recent = (windows.get(key) || []).filter((at) => now() - at < 60000);
      if (recent.length >= 5) {
        await denied(actor, name, 'CONFLICT', args.id || null);
        throw new ApiError('CONFLICT', 'Bạn đã thực hiện đủ 5 thao tác trong một phút. Vui lòng thử lại sau.');
      }
      recent.push(now());
      windows.set(key, recent);
      const safeArgs = structuredClone(args);
      const argsHash = await hash(safeArgs);
      const token = globalThis.crypto.randomUUID();
      const expiresAt = now() + 2 * 60 * 1000;
      const card = await capability.prepare(api, safeArgs, actor);
      pending.set(token, { name, args: safeArgs, argsHash, actor: actorKey(actor), expiresAt, used: false });
      return { type: 'confirm-card', data: { ...card, token, expiresAt: new Date(expiresAt).toISOString() } };
    },
    async confirm(token, actor) {
      const draft = pending.get(token);
      const name = draft?.name || 'chat.confirm';
      const fail = async (code, targetId = null) => {
        pending.delete(token);
        await denied(actor, name, code, targetId);
        throw new ApiError(code, code === 'UNAUTHORIZED' || code === 'FORBIDDEN'
          ? 'Mã xác nhận không thuộc phiên của bạn.'
          : 'Mã xác nhận không hợp lệ, đã hết hạn hoặc đã được dùng.');
      };
      if (!draft || draft.used) return fail('FORBIDDEN');
      if (draft.actor !== actorKey(actor)) return fail('FORBIDDEN', draft.args.id || null);
      if (now() >= draft.expiresAt) return fail('CONFLICT', draft.args.id || null);
      if (await hash(draft.args) !== draft.argsHash) return fail('FORBIDDEN', draft.args.id || null);
      draft.used = true;
      pending.delete(token);
      const capability = CAPABILITIES[draft.name];
      const result = await capability.execute(chatApi, structuredClone(draft.args), actor, CONFIRM_KEY);
      return { type: `${draft.name}.result`, data: result };
    },
    cancel(token, actor) {
      const draft = pending.get(token);
      if (!draft || draft.actor !== actorKey(actor)) return false;
      pending.delete(token);
      return true;
    }
  });
}
