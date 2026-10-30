import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { createCapabilityRunner } from '../src/ai/capabilities.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { SEED } from '../src/data/seed.js';

function setup({ userId = null, initialTime = new Date(2026, 9, 30, 10) } = {}) {
  let time = new Date(initialTime);
  const storage = new Storage(memoryDriver());
  const api = createApi({ storage, seed: SEED, identity: () => userId,
    now: () => time, logger: { error() {} } });
  return { api, storage, setTime: (next) => { time = new Date(next); }, runner: createCapabilityRunner(api, { now: () => time.getTime() }) };
}

const orderArgs = { items: [{ itemId: 'M001', qty: 1, size: 'M' }], address: '12 Lê Lợi', phone: '0901234567' };
const bookingArgs = { seatId: 'D8', date: '2026-11-01', time: '19:00', guests: 4 };
const actor = (userId = null) => ({ userId, role: userId ? 'customer' : 'guest', channel: 'chat' });

test('chuẩn bị bốn năng lực chỉ tạo thẻ, xác nhận thực thi đúng một lần qua kênh trò chuyện', async () => {
  const { api, runner } = setup({ userId: 'U1' });
  await api.menu.getAll();
  await api.seats.getAll();
  const before = await api.exportAll();
  const who = actor('U1');

  const orderCard = await runner.prepare('order.create', orderArgs, who);
  assert.equal(orderCard.type, 'confirm-card');
  assert.match(orderCard.data.lines.join(' '), /Tổng cộng/);
  assert.deepEqual((await api.exportAll()).data.orders, before.data.orders);
  const orderResult = await runner.confirm(orderCard.data.token, who);
  assert.equal(orderResult.type, 'order.create.result');
  await assert.rejects(() => runner.confirm(orderCard.data.token, who));
  const createdOrder = orderResult.data;

  const orderCancel = await runner.prepare('order.cancel', { id: createdOrder.id }, who);
  await runner.confirm(orderCancel.data.token, who);
  const bookingCard = await runner.prepare('booking.create', bookingArgs, who);
  assert.match(bookingCard.data.lines.join(' '), /Tiền cọc/);
  await runner.confirm(bookingCard.data.token, who);
  const booking = (await api.bookings.getByUser('U1'))[0];
  const bookingCancel = await runner.prepare('booking.cancel', { id: booking.id }, who);
  assert.match(bookingCancel.data.lines.join(' '), /Tiền hoàn/);
  await runner.confirm(bookingCancel.data.token, who);

  const rows = (await api.exportAll()).data.audit;
  for (const action of ['order.created', 'order.cancelled', 'booking.created', 'booking.cancelled']) {
    const row = rows.find((entry) => entry.action === action && entry.ok);
    assert.ok(row, `${action} có nhật ký thành công`);
    assert.equal(row.actor.channel, 'chat');
  }
  assert.equal(rows.filter((entry) => entry.action === 'order.created' && entry.ok).length, 1);
});

test('chuẩn bị đơn và đặt bàn không ghi dữ liệu hay khởi tạo bộ nhớ lâu dài', async () => {
  const { runner, storage } = setup({ userId: 'U1' });
  assert.equal(await storage.get('orders'), null);
  assert.equal(await storage.get('bookings'), null);
  assert.equal(await storage.get('menu'), null);
  await runner.prepare('order.create', orderArgs, actor('U1'));
  await runner.prepare('booking.create', bookingArgs, actor('U1'));
  assert.equal(await storage.get('orders'), null);
  assert.equal(await storage.get('bookings'), null);
  assert.equal(await storage.get('menu'), null);
});

test('từ chối token giả, sai người, hết hạn và ghi nhật ký từ chối', async () => {
  const { api, runner, setTime } = setup({ userId: 'U1' });
  const who = actor('U1');
  await assert.rejects(() => runner.confirm('token-tu-bịa', who));
  const card = await runner.prepare('order.create', orderArgs, who);
  await assert.rejects(() => runner.confirm(card.data.token, actor('U2')), (error) => error.code === 'FORBIDDEN');
  const expired = await runner.prepare('order.create', orderArgs, who);
  setTime(new Date(2026, 9, 30, 10, 2));
  await assert.rejects(() => runner.confirm(expired.data.token, who), (error) => error.code === 'CONFLICT');
  const rows = (await api.exportAll()).data.audit;
  assert.ok(rows.some((entry) => !entry.ok && entry.code === 'FORBIDDEN' && entry.actor.channel === 'chat'));
  assert.ok(rows.some((entry) => !entry.ok && entry.code === 'CONFLICT' && entry.actor.channel === 'chat'));
});

test('mỗi phiên chỉ chuẩn bị tối đa năm thao tác ghi trong một phút; guest không được đặt bàn', async () => {
  const { runner } = setup({ userId: 'U1' });
  const who = actor('U1');
  for (let index = 0; index < 5; index += 1) await runner.prepare('order.create', orderArgs, who);
  await assert.rejects(() => runner.prepare('order.create', orderArgs, who), (error) => error.code === 'CONFLICT');
  const guest = setup();
  await assert.rejects(() => guest.runner.prepare('booking.create', bookingArgs, actor()), (error) => error.code === 'UNAUTHORIZED');
});

test('mọi đầu vào ghi vẫn qua kiểm tra lược đồ', async () => {
  const { runner } = setup({ userId: 'U1' });
  await assert.rejects(() => runner.prepare('order.create', { ...orderArgs, surprise: true }, actor('U1')), (error) => error.code === 'VALIDATION');
  await assert.rejects(() => runner.prepare('booking.create', { ...bookingArgs, guests: '4' }, actor('U1')), (error) => error.code === 'VALIDATION');
  await assert.rejects(() => runner.prepare('order.create', { ...orderArgs, items: [{ itemId: 'M001', extra: true }] }, actor('U1')), (error) => error.code === 'VALIDATION');
});
