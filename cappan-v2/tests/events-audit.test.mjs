import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { SEED } from '../src/data/seed.js';

const makeStore = () => new Storage(memoryDriver());
const makeApi = (storage, { identity = () => null, channel = 'web', now, logger = { error() {} } } = {}) =>
  createApi({ storage, seed: SEED, identity, channel, now, logger });
const orderInput = {
  items: [{ itemId: 'M001', qty: 1 }],
  address: '1 Lê Lợi',
  phone: '0901111111'
};

test('events + audit theo dõi đúng các thao tác, kênh và các mốc đặt chỗ', async () => {
  const storage = makeStore();
  let clock = new Date('2026-10-29T12:00:00');
  const bootstrap = makeApi(storage, { now: () => clock });
  await bootstrap.users.seedDemo();
  const customer = await bootstrap.users.create({
    name: 'Khách',
    phone: '0908111001',
    password: 'cappan123'
  });
  const staffApi = makeApi(storage);
  const staffId = (await staffApi.users.getAll()).find((user) => user.role === 'staff').id;
  const names = [];
  const errors = [];
  const logger = { error: (...args) => errors.push(args) };
  const observed = makeApi(storage, { identity: () => customer.id, channel: 'web', now: () => clock, logger }).forChannel('chat');
  const staffObserved = makeApi(storage, { identity: () => staffId, channel: 'chat', now: () => clock, logger });
  for (const name of [
    'order.created', 'order.cancelled', 'order.step_changed', 'booking.created', 'booking.deposit_paid',
    'booking.late', 'booking.auto_cancelled', 'booking.seated', 'booking.completed', 'auth.login', 'auth.logout'
  ]) observed.events.on(name, () => names.push(name));
  for (const name of ['booking.seated', 'booking.completed'])
    staffObserved.events.on(name, () => names.push(name));
  observed.events.on('order.created', () => { throw new Error('listener lỗi'); });

  const order = await observed.orders.create(orderInput);
  await observed.orders.updateStep(order.id, 1);
  await observed.orders.cancel(order.id);

  const lateBooking = await observed.bookings.create({ seatId: 'A1', date: '2026-10-30', time: '19:00', guests: 2 });
  await observed.bookings.payDeposit(lateBooking.id);
  clock = new Date('2026-10-30T19:16:00');
  await observed.bookings.getLateCards(customer.id);
  clock = new Date('2026-10-30T19:31:00');
  await observed.seats.getMap('2026-10-30');

  const seated = await observed.bookings.create({ seatId: 'A2', date: '2026-10-30', time: '20:00', guests: 2 });
  await observed.bookings.payDeposit(seated.id);
  await staffObserved.bookings.checkIn(seated.id);
  await staffObserved.bookings.complete(seated.id);

  await observed.auth.login('0908111001', 'cappan123');
  await observed.auth.logout();
  assert.ok(errors.some((entry) => String(entry[0]).includes('order.created')));

  for (const name of [
    'order.created', 'order.cancelled', 'order.step_changed', 'booking.created', 'booking.deposit_paid',
    'booking.late', 'booking.auto_cancelled', 'booking.seated', 'booking.completed', 'auth.login', 'auth.logout'
  ]) assert.ok(names.includes(name), `thiếu sự kiện ${name}`);

  const rows = await storage.get('audit');
  assert.equal(rows.length, names.length); // có 1 dòng audit cho mỗi lần ghi nghiệp vụ, kể cả sweep
  assert.ok(rows.every((row) => row.ok === true && row.actor.channel === 'chat'));
  assert.ok(rows.every((row) => row.at && row.actor.userId));
  assert.deepEqual(new Set(rows.map((row) => row.actor.role)), new Set(['customer', 'staff']));

  const staff = makeApi(storage, { identity: () => staffId });
  const recent = await staff.audit.getRecent(500);
  assert.equal(recent.length, rows.length);
  assert.equal((await staff.audit.getRecent(1))[0].targetId, rows.at(-1).targetId);
  await assert.rejects(() => observed.audit.getRecent(), (error) => error.code === 'FORBIDDEN');
});

test('từ chối quyền có audit; lỗi ghi audit không chặn thao tác; giữ tối đa 500 dòng', async () => {
  const storage = makeStore();
  let logged = 0;
  const logger = { error: () => { logged += 1; } };
  const guest = makeApi(storage, { identity: () => null, channel: 'voice', logger });
  await assert.rejects(
    () => guest.bookings.create({ seatId: 'A1', date: '2026-10-30', time: '19:00', guests: 2 }),
    (error) => error.code === 'UNAUTHORIZED'
  );
  const denied = await storage.get('audit');
  assert.equal(denied.length, 1);
  assert.deepEqual(denied[0].actor, { userId: null, role: 'guest', channel: 'voice' });
  assert.equal(denied[0].ok, false);
  assert.equal(denied[0].code, 'UNAUTHORIZED');

  const originalSet = storage.set.bind(storage);
  storage.set = async (key, value) => {
    if (key === 'audit') throw new Error('audit storage lỗi');
    return originalSet(key, value);
  };
  const order = await guest.orders.create(orderInput);
  assert.ok(order.id);
  assert.equal(logged, 1);

  storage.set = originalSet;
  await storage.set('audit', Array.from({ length: 500 }, (_, i) => ({ at: String(i), actor: null, action: 'old', targetId: String(i), ok: true })));
  await guest.orders.create(orderInput);
  const capped = await storage.get('audit');
  assert.equal(capped.length, 500);
  assert.equal(capped.at(-1).action, 'order.created');
});
