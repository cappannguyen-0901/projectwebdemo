/* Chính sách quyền thuần: không đọc storage, không DOM. */
export const ROLES = Object.freeze(['guest', 'customer', 'staff', 'owner']);
export const OWNERSHIP = Object.freeze(['own', 'other', 'none']);

const roles = (guest = [], customer = [], staff = [], owner = []) =>
  Object.freeze({ guest, customer, staff, owner });

/* Mỗi ô liệt kê own, any (mọi quan hệ sở hữu) hoặc none cho action đó. */
export const POLICY = Object.freeze({
  'menu.search': roles(['none'], ['none'], ['none'], ['none']),
  'menu.recommend': roles(['none'], ['none'], ['none'], ['none']),
  'seat.map': roles(['none'], ['none'], ['none'], ['none']),
  'booking.availability': roles(['none'], ['none'], ['none'], ['none']),
  'booking.mine': roles([], ['own'], ['own'], ['own']),
  'order.mine': roles([], ['own'], ['own'], ['own']),
  'order.status': roles([], ['own'], ['any'], ['any']),
  'profile.me': roles([], ['own'], ['own'], ['own']),
  'order.create': roles(['none'], ['none'], ['none'], ['none']),
  'order.cancel': roles(['none'], ['own'], ['any'], ['any']),
  'order.step': roles([], [], ['any'], ['any']),
  'booking.create': roles([], ['none'], ['none'], ['none']),
  'booking.payDeposit': roles([], ['own'], ['any'], ['any']),
  'booking.cancel': roles([], ['own'], ['any'], ['any']),
  'booking.checkIn': roles([], [], ['any'], ['any']),
  'booking.complete': roles([], [], ['any'], ['any']),
  'booking.lateCards': roles([], ['own'], ['any'], ['any']),
  'stats.read': roles([], [], ['none'], ['none']),
  'audit.read': roles([], [], ['none'], ['none'])
});

export function ownershipOf(actor, resource) {
  if (!resource || resource.ownerId === null || resource.ownerId === undefined) return 'none';
  return actor?.userId !== null && actor?.userId !== undefined && resource.ownerId === actor.userId
    ? 'own'
    : 'other';
}

export function authorize(actor, action, resource = null) {
  const role = ROLES.includes(actor?.role) ? actor.role : 'guest';
  const allowedRelations = POLICY[action]?.[role];
  if (!allowedRelations) return { allowed: false, reason: `Không có chính sách cho ${action}` };
  const ownership = ownershipOf(actor, resource);
  const allowed = allowedRelations.includes(ownership) || allowedRelations.includes('any');
  return {
    allowed,
    reason: allowed ? 'Được phép' : `Vai trò ${role} không được ${action} với tài nguyên ${ownership}`
  };
}
