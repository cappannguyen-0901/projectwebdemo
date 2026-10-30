/* Sổ năng lực chỉ đọc. Mô-đun thuần, không DOM; mọi dữ liệu đi qua API facade. */
import { ApiError } from '../core/errors.js';
import { authorize } from '../domain/policy.js';

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
    if (rule.pattern && !(new RegExp(rule.pattern).test(input)))
      throw new ApiError('VALIDATION', `${key} không đúng định dạng`);
  }
}

async function execute(name, args, actor, api) {
  const capability = CAPABILITIES[name];
  if (!capability) throw new ApiError('NOT_FOUND', `Không có năng lực ${name}`);
  if (!capability.roles.includes(actor?.role)) {
    const code = actor?.role === 'guest' ? 'UNAUTHORIZED' : 'FORBIDDEN';
    throw new ApiError(code, `Vai trò không được dùng ${name}`);
  }
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
  const access = authorize(actor, name, resource);
  if (!access.allowed) throw new ApiError('FORBIDDEN', access.reason);

  return capability.handler(api, args, actor);
}

export function createCapabilityRunner(api) {
  return Object.freeze({ run: (name, args, actor) => execute(name, args, actor, api) });
}
