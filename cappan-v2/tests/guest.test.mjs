/* v1.3.1 — đặt chỗ bắt buộc đăng nhập + mã "đầu tiên" cần userId */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { ApiError } from '../src/core/errors.js';
import { SEED } from '../src/data/seed.js';

const soon = (d = 3) => {
  const t = new Date(Date.now() + d * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};

const fresh = () => new Storage(memoryDriver());
const mk = ({ identity = () => null, storage = fresh(), now } = {}) =>
  createApi({ storage, seed: SEED, identity, ...(now ? { now } : {}) });

const unauth = (e) => e instanceof ApiError && e.code === 'UNAUTHORIZED';

test('guest không tạo / trả cọc / hủy / check-in / hoàn tất đặt chỗ — UNAUTHORIZED', async () => {
  const store = fresh();
  const custId = (
    await mk({ storage: store }).users.create({
      name: 'Khách',
      phone: '0903000001',
      password: 'cappan123'
    })
  ).id;
  const cust = mk({ storage: store, identity: () => custId });
  const bk = await cust.bookings.create({ seatId: 'A1', date: soon(), time: '19:00', guests: 2 });

  const guest = mk({ storage: store, identity: () => null });
  await assert.rejects(
    () => guest.bookings.create({ seatId: 'A2', date: soon(), time: '19:00', guests: 2 }),
    unauth
  );
  await assert.rejects(() => guest.bookings.payDeposit(bk.id), unauth);
  await assert.rejects(() => guest.bookings.cancel(bk.id), unauth);
  await assert.rejects(() => guest.bookings.checkIn(bk.id), unauth);
  await assert.rejects(() => guest.bookings.complete(bk.id), unauth);
  assert.equal((await cust.bookings.getById(bk.id)).status, 'pending_deposit');
});

test('guest vẫn xem được sơ đồ seats.getMap', async () => {
  const guest = mk({ identity: () => null });
  const map = await guest.seats.getMap(soon());
  assert.ok(Array.isArray(map));
  assert.ok(map.length > 0);
  assert.equal(map[0].status, 'available');
});

test('guest evaluate mã "đầu tiên" → cần đăng nhập; FREESHIP vẫn dùng được', async () => {
  const guest = mk({ identity: () => null });
  const first = await guest.promotions.evaluate('WELCOME10', 100000, 15000, null);
  assert.equal(first.ok, false);
  assert.equal(first.error, 'Cần đăng nhập để dùng mã này');

  await assert.rejects(
    () =>
      guest.orders.create({
        items: [{ itemId: 'M001', qty: 3 }],
        address: '1 Lê Lợi',
        phone: '0910000000',
        promoCode: 'WELCOME10'
      }),
    (e) => e.code === 'VALIDATION' && /đăng nhập/.test(e.message)
  );

  const ship = await guest.promotions.evaluate('FREESHIP', 100000, 15000, null);
  assert.equal(ship.ok, true);
});
