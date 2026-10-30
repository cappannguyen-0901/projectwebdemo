import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftSession } from '../src/ai/draft.js';

test('bản nháp đặt bàn hỏi đúng các trường còn thiếu', () => {
  const draft = createDraftSession();
  draft.start('booking', { seatId: 'D8', date: '2026-11-01' });
  assert.deepEqual(draft.missing(), ['time', 'guests']);
  draft.fill({ time: '19:00', guests: 4 });
  assert.equal(draft.ready(), true);
  assert.deepEqual(draft.missing(), []);
});

test('bản nháp đơn lấy số điện thoại hồ sơ và cho sửa giờ, thêm món', () => {
  const draft = createDraftSession();
  draft.start('order', { time: '19:00', items: [{ name: 'cà phê', qty: 1 }], address: 'Quận 1' });
  draft.fill({ profile: { phone: '0901234567' } });
  draft.fill({ text: 'đổi sang 20h' });
  draft.fill({ text: 'thêm 1 ly cà phê' });
  assert.deepEqual(draft.get().data.items, [{ name: 'cà phê', qty: 2 }]);
  assert.equal(draft.get().data.time, '20:00');
  assert.equal(draft.ready(), true);
});

test('bản nháp hết hạn sau mười phút không hoạt động', () => {
  let clock = 1000;
  const draft = createDraftSession({ now: () => clock });
  draft.start('booking', { seatId: 'D8' });
  clock += 9 * 60 * 1000;
  draft.fill({ guests: 2 });
  clock += 10 * 60 * 1000;
  assert.equal(draft.get(), null);
  assert.deepEqual(draft.missing(), []);
});
