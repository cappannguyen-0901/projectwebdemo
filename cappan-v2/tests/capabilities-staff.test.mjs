import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { createCapabilityRunner } from '../src/ai/capabilities.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { SEED } from '../src/data/seed.js';

const orderArgs = { items: [{ itemId: 'M001', qty: 1, size: 'M' }], address: '12 Lê Lợi', phone: '0901234567' };
const bookingArgs = { seatId: 'D8', date: '2026-10-30', time: '19:00', guests: 4 };
const staffActor = { userId: 'S1', role: 'staff', channel: 'chat' };
const customerActor = { userId: 'U1', role: 'customer', channel: 'chat' };

function setup() {
  let clock = new Date(2026, 9, 30, 18);
  const storage = new Storage(memoryDriver());
  const apiFor = (userId) => createApi({ storage, seed: SEED, identity: () => userId, now: () => clock, logger: { error() {} } });
  return { storage, apiFor, setClock: (value) => { clock = new Date(value); } };
}

async function makeOrder(api) { return api.orders.create(orderArgs); }
async function makeBooking(api) {
  const booking = await api.bookings.create(bookingArgs);
  await api.bookings.payDeposit(booking.id);
  return booking;
}

test('nhân viên xác nhận từng thao tác ghi và mỗi thao tác tạo đúng một nhật ký qua kênh trò chuyện', async () => {
  const { storage, apiFor } = setup();
  await storage.set('users', [
    { id: 'S1', name: 'Nhân viên An', role: 'staff', phone: '0900000001' },
    { id: 'U1', name: 'Khách Bình', role: 'customer', phone: '0901234567' }
  ]);
  const customerApi = apiFor('U1');
  const staffApi = apiFor('S1');
  const runner = createCapabilityRunner(staffApi);
  const order = await makeOrder(customerApi);
  const booking = await makeBooking(customerApi);
  for (const [name, args] of [
    ['order.advance', { id: order.id }],
    ['booking.checkIn', { id: booking.id }],
    ['booking.complete', { id: booking.id }],
    ['menu.setStock', { id: 'M001', inStock: false }]
  ]) {
    const card = await runner.prepare(name, args, staffActor);
    assert.equal(card.type, 'confirm-card');
    await runner.confirm(card.data.token, staffActor);
  }
  const rows = (await storage.get('audit')).filter((row) => row.ok && row.actor.role === 'staff' && row.actor.channel === 'chat');
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((row) => `${row.action}:${row.targetId}`)).size, 4);
  assert.equal((await customerApi.menu.getById('M001')).inStock, false);
  assert.equal((await customerApi.bookings.getById(booking.id)).status, 'completed');
  assert.equal((await customerApi.orders.getById(order.id)).step, 1);
});

test('hủy hộ có thẻ nêu rõ mã, khách, tiền hoàn; xác nhận lặp không chạy lần hai', async () => {
  const { storage, apiFor } = setup();
  await storage.set('users', [
    { id: 'S1', name: 'Nhân viên An', role: 'staff', phone: '0900000001' },
    { id: 'U1', name: 'Khách Bình', role: 'customer', phone: '0901234567' }
  ]);
  const customerApi = apiFor('U1');
  const runner = createCapabilityRunner(apiFor('S1'));
  const order = await makeOrder(customerApi);
  const booking = await makeBooking(customerApi);
  const orderCard = await runner.prepare('order.cancel', { id: order.id }, staffActor);
  assert.match(orderCard.data.lines.join(' '), new RegExp(order.id));
  assert.match(orderCard.data.lines.join(' '), /Khách Bình/);
  await runner.confirm(orderCard.data.token, staffActor);
  await assert.rejects(() => runner.confirm(orderCard.data.token, staffActor));
  const bookingCard = await runner.prepare('booking.cancel', { id: booking.id }, staffActor);
  assert.match(bookingCard.data.lines.join(' '), new RegExp(booking.id));
  assert.match(bookingCard.data.lines.join(' '), /Khách Bình/);
  assert.match(bookingCard.data.lines.join(' '), /Tiền hoàn/);
  await runner.confirm(bookingCard.data.token, staffActor);
  const rows = (await storage.get('audit')).filter((row) => row.actor.role === 'staff' && row.actor.channel === 'chat' && row.ok);
  assert.equal(rows.filter((row) => row.action === 'order.cancelled' && row.targetId === order.id).length, 1);
  assert.equal(rows.filter((row) => row.action === 'booking.cancelled' && row.targetId === booking.id).length, 1);
});

test('khách hàng không được gọi thao tác dành cho nhân viên; lược đồ món còn hàng được kiểm tra', async () => {
  const { apiFor } = setup();
  const runner = createCapabilityRunner(apiFor('U1'));
  for (const [name, args] of [
    ['order.advance', { id: 'O1' }], ['booking.checkIn', { id: 'B1' }],
    ['booking.complete', { id: 'B1' }], ['menu.setStock', { id: 'M001', inStock: true }]
  ]) {
    await assert.rejects(() => runner.prepare(name, args, customerActor), (error) => error.code === 'FORBIDDEN');
  }
  await assert.rejects(() => runner.prepare('menu.setStock', { id: 'M001', inStock: 'còn' }, staffActor),
    (error) => error.code === 'VALIDATION');
});
