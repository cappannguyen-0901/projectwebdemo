/* LUẬT ĐẶT CHỖ v1.3 — THUẦN (không facade). Test nguồn từ docs/booking-policy-v1.3.md.
   Mọi mốc thời gian chốt bằng `toLocal` — không dùng Date.now. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/domain/booking-rules.js';

const T = (d, t) => R.toLocal(d, t);
const bk = (o = {}) => ({
  id: 'bk-1',
  seatId: 'A1',
  date: '2026-10-30',
  time: '19:00',
  status: 'confirmed',
  depositPaid: true,
  depositAmount: 35000,
  ...o
});

test('cọc: 2→1, 4→2, 6→3, 8→4 ly', () => {
  assert.deepEqual([2, 4, 6, 8].map(R.depositDrinks), [1, 2, 3, 4]);
  assert.equal(R.depositAmount(8, 30000), 120000);
});

test('mốc +15 và +30 phút', () => {
  const b = bk();
  assert.equal(R.phase(b, T('2026-10-30', '19:14')), 'upcoming');
  assert.equal(R.phase(b, T('2026-10-30', '19:15')), 'late');
  assert.equal(R.phase(b, T('2026-10-30', '19:29')), 'late');
  assert.equal(R.phase(b, T('2026-10-30', '19:30')), 'no_show');
});

test('đặt cả ngày: 19:00 nhưng 08:00 sáng bàn đã bị giữ', () => {
  const m = R.mapStatus('A1', '2026-10-30', [bk()], T('2026-10-30', '08:00'));
  assert.equal(m.status, 'booked');
});

test('sơ đồ: trước 00:00 ngày D là reserved, từ 00:00 là booked', () => {
  const b = bk();
  const before = new Date(T('2026-10-30', '00:00').getTime() - 1000);
  assert.equal(R.mapStatus('A1', '2026-10-30', [b], before).status, 'reserved');
  assert.equal(R.mapStatus('A1', '2026-10-30', [b], T('2026-10-30', '00:00')).status, 'booked');
});

test('bàn đã đặt thì không ai đặt thêm (chặn ngay, kể cả đặt trước)', () => {
  const now = T('2026-10-25', '10:00');
  assert.ok(R.holderOf('A1', '2026-10-30', [bk()], now));
  assert.equal(R.holderOf('A2', '2026-10-30', [bk()], now), null);
  assert.equal(R.holderOf('A1', '2026-10-31', [bk()], now), null); // ngày khác
});

test('no_show / expired / cancelled nhả bàn', () => {
  const now = T('2026-10-30', '20:00');
  assert.equal(R.holderOf('A1', '2026-10-30', [bk()], now), null); // quá +30
  assert.equal(R.holderOf('A1', '2026-10-30', [bk({ status: 'cancelled' })], now), null);
  const pend = bk({ status: 'pending_deposit', depositExpiresAt: T('2026-10-30', '10:15').toISOString() });
  assert.equal(R.holderOf('A1', '2026-10-30', [pend], T('2026-10-30', '10:15')), null);
  assert.ok(R.holderOf('A1', '2026-10-30', [pend], T('2026-10-30', '10:14')));
});

test('seated giữ bàn không giới hạn trong ngày', () => {
  const b = bk({ status: 'seated' });
  assert.ok(R.isHolding(b, T('2026-10-30', '23:59')));
});

test('hoàn cọc: trước 00:00 = 100%, từ 00:00 = 0', () => {
  const b = bk();
  const before = new Date(T('2026-10-30', '00:00').getTime() - 1000);
  assert.equal(R.refundAmount(b, before), 35000);
  assert.equal(R.refundAmount(b, T('2026-10-30', '00:00')), 0);
  assert.equal(R.refundAmount(b, T('2026-10-30', '19:20')), 0); // thẻ trễ
  assert.equal(R.refundAmount(bk({ depositPaid: false }), before), 0);
});

test('validateSlot', () => {
  const now = T('2026-10-29', '10:00');
  assert.equal(R.validateSlot('2026-10-29', '12:00', now), null);
  assert.equal(R.validateSlot('2026-10-29', '09:00', now).field, 'time'); // đã qua
  assert.equal(R.validateSlot('2026-10-28', '12:00', now).field, 'date');
  assert.equal(R.validateSlot('2026-10-30', '06:00', now).field, 'time'); // ngoài giờ
  assert.equal(R.validateSlot('2026-10-30', '23:00', now).field, 'time');
  assert.equal(R.validateSlot('2026-12-30', '12:00', now).field, 'date'); // quá xa
});

test('sweepPlan', () => {
  const now = T('2026-10-30', '20:00');
  const rows = [
    bk({ id: 'a' }),
    bk({ id: 'b', status: 'pending_deposit', depositExpiresAt: T('2026-10-30', '19:00').toISOString() }),
    bk({ id: 'c', status: 'seated', date: '2026-10-29' }),
    bk({ id: 'd', status: 'seated' })
  ];
  assert.deepEqual(R.sweepPlan(rows, now).map((x) => [x.id, x.to]),
    [['a', 'no_show'], ['b', 'expired'], ['c', 'completed']]);
});

test('thẻ trễ chỉ xuất hiện trong khoảng 15–30 phút', () => {
  const seat = { id: 'A1', img: 'x.jpg', description: 'Bàn 2 người' };
  assert.equal(R.lateCard(bk(), seat, T('2026-10-30', '19:10')), null);
  const c = R.lateCard(bk(), seat, T('2026-10-30', '19:16'));
  assert.equal(c.type, 'booking-late');
  assert.equal(c.data.autoCancelAt, '19:30');
  assert.equal(c.data.minutesLate, 16);
  assert.equal(R.lateCard(bk(), seat, T('2026-10-30', '19:31')), null);
});
