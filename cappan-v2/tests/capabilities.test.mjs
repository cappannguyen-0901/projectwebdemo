import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES, createCapabilityRunner } from '../src/ai/capabilities.js';
import { POLICY, ROLES } from '../src/domain/policy.js';

const validArgs = {
  'menu.search': { query: 'ca phe' },
  'menu.recommend': { preference: 'ngọt' },
  'booking.availability': { date: '2026-10-30' },
  'booking.mine': {},
  'order.mine': {},
  'order.status': { id: 'O1' },
  'profile.me': {}
};

function mockApi() {
  const orders = [
    { id: 'O1', userId: 'U1', status: 'pending', step: 0, phone: '0901' },
    { id: 'O2', userId: 'U2', status: 'completed', step: 4, phone: '0902' }
  ];
  const bookings = [
    { id: 'B1', userId: 'U1', seatId: 'A1' },
    { id: 'B2', userId: 'U2', seatId: 'A2' }
  ];
  return {
    menu: {
      async getAll() {
        return [
          { id: 'M1', name: 'Cà phê sữa', description: 'ngọt', inStock: true },
          { id: 'M2', name: 'Trà đào', description: '', inStock: true },
          { id: 'M3', name: 'Cà phê hết món', inStock: false }
        ];
      }
    },
    seats: { async getMap() { return [{ id: 'A1', floorId: 'F1', capacity: 2, status: 'available', secret: 'drop' }]; } },
    bookings: { async getByUser() { return bookings; } },
    orders: {
      async getByUser() { return orders; },
      async getById(id) { return orders.find((order) => order.id === id) || null; }
    },
    users: { async getById(id) { return { id, name: 'Khách của tôi', phone: '0901' }; } }
  };
}

test('mọi năng lực × mọi vai trò: kết quả theo roles và policy, không có HTML', async () => {
  const runner = createCapabilityRunner(mockApi());
  for (const [name, capability] of Object.entries(CAPABILITIES)) {
    for (const role of ROLES) {
      const actor = { userId: role === 'guest' ? null : 'U1', role, channel: 'web' };
      const allowed = capability.roles.includes(role) && POLICY[name][role].length > 0;
      if (!allowed) {
        await assert.rejects(
          () => runner.run(name, validArgs[name], actor),
          (error) => ['FORBIDDEN', 'UNAUTHORIZED'].includes(error.code),
          `${name} × ${role}`
        );
        continue;
      }
      const result = await runner.run(name, validArgs[name], actor);
      assert.equal(typeof result.type, 'string');
      assert.equal(typeof result.data, 'object');
      assert.equal(JSON.stringify(result).includes('<'), false, `${name} không trả HTML`);
    }
  }
});

test('năng lực kiểm tra input sai bằng VALIDATION trước khi gọi handler', async () => {
  const runner = createCapabilityRunner(mockApi());
  const actor = { userId: 'U1', role: 'customer', channel: 'web' };
  const invalid = {
    'menu.search': {},
    'menu.recommend': { preference: 42 },
    'booking.availability': { date: 'mai' },
    'booking.mine': { extra: true },
    'order.mine': { extra: true },
    'order.status': { id: '' },
    'profile.me': { extra: true }
  };
  for (const name of Object.keys(CAPABILITIES)) {
    await assert.rejects(() => runner.run(name, invalid[name], actor), (error) => error.code === 'VALIDATION');
  }
});

test('khách chỉ nhận đặt chỗ/đơn của mình; không tra được đơn của người khác', async () => {
  const runner = createCapabilityRunner(mockApi());
  const actor = { userId: 'U1', role: 'customer', channel: 'chat' };
  const bookings = await runner.run('booking.mine', {}, actor);
  const orders = await runner.run('order.mine', {}, actor);
  assert.deepEqual(bookings.data.bookings.map((booking) => booking.id), ['B1']);
  assert.deepEqual(orders.data.orders.map((order) => order.id), ['O1']);
  await assert.rejects(
    () => runner.run('order.status', { id: 'O2' }, actor),
    (error) => error.code === 'FORBIDDEN'
  );
  await assert.rejects(
    () => runner.run('order.mine', {}, { userId: null, role: 'guest', channel: 'chat' }),
    (error) => error.code === 'UNAUTHORIZED'
  );
});
