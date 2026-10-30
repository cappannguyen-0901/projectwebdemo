import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { SEED } from '../src/data/seed.js';

function setup() {
  let clock = new Date(2026, 9, 29, 23, 59);
  const api = createApi({
    storage: new Storage(memoryDriver()), seed: SEED, identity: () => 'customer-1', now: () => clock,
    logger: { error() {} }
  });
  return { api, setTime: (value) => { clock = new Date(value); } };
}

async function makeBooking(api) {
  const booking = await api.bookings.create({ seatId: 'D8', date: '2026-10-30', time: '19:00', guests: 4 });
  await api.bookings.payDeposit(booking.id);
  return booking.id;
}

test('xem trước không ghi; số hoàn khớp thao tác hủy trước nửa đêm', async () => {
  const { api } = setup();
  const id = await makeBooking(api);
  const before = await api.exportAll();
  const preview = await api.bookings.previewCancel(id);
  const after = await api.exportAll();
  assert.deepEqual(after.data.bookings, before.data.bookings);
  const cancelled = await api.bookings.cancel(id);
  assert.equal(preview.refundRate, 1);
  assert.equal(preview.refundAmount, cancelled.refundAmount);
});

test('từ nửa đêm ngày đặt chỗ tiền hoàn là không', async () => {
  const { api, setTime } = setup();
  const id = await makeBooking(api);
  setTime(new Date(2026, 9, 30, 0, 0));
  const preview = await api.bookings.previewCancel(id);
  const cancelled = await api.bookings.cancel(id);
  assert.equal(preview.refundRate, 0);
  assert.equal(preview.refundAmount, cancelled.refundAmount);
});

test('thẻ trễ không được hoàn cọc', async () => {
  const { api, setTime } = setup();
  const id = await makeBooking(api);
  setTime(new Date(2026, 9, 30, 19, 16));
  const preview = await api.bookings.previewCancel(id);
  assert.equal(preview.phase, 'late');
  assert.equal(preview.refundRate, 0);
  assert.equal(preview.refundAmount, 0);
});
