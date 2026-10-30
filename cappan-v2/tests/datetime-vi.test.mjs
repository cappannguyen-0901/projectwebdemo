import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen } from '../src/ai/datetime-vi.js';

const now = new Date(2026, 9, 30, 10, 0);

test('hiểu ngày tương đối, thứ trong tuần và các cách ghi ngày', () => {
  assert.equal(parseWhen('hôm nay', now).date, '2026-10-30');
  assert.equal(parseWhen('mai', now).date, '2026-10-31');
  assert.equal(parseWhen('mốt', now).date, '2026-11-01');
  assert.equal(parseWhen('ngày kia', now).date, '2026-11-01');
  assert.equal(parseWhen('thứ sáu', now).date, '2026-11-06');
  assert.equal(parseWhen('chủ nhật', now).date, '2026-11-01');
  assert.equal(parseWhen('30/10', now).date, '2026-10-30');
  assert.equal(parseWhen('30-10', now).date, '2026-10-30');
  assert.equal(parseWhen('ngày 30', now).date, '2026-10-30');
});

test('hiểu giờ rõ nghĩa và hỏi lại giờ mơ hồ', () => {
  assert.equal(parseWhen('19h', now).time, '19:00');
  assert.equal(parseWhen('19h30', now).time, '19:30');
  assert.equal(parseWhen('19:30', now).time, '19:30');
  assert.equal(parseWhen('7h tối', now).time, '19:00');
  assert.equal(parseWhen('7 giờ sáng', now).time, '07:00');
  assert.equal(parseWhen('12h trưa', now).time, '12:00');
  assert.deepEqual(parseWhen('7h', now).ambiguous, ['date', 'time']);
});

test('tính lần kế tiếp qua nửa đêm, cuối tháng và chủ nhật', () => {
  assert.equal(parseWhen('mai 19h', new Date(2026, 11, 31, 23, 59)).date, '2027-01-01');
  assert.equal(parseWhen('ngày 31', new Date(2026, 0, 31, 23, 59)).date, '2026-01-31');
  assert.equal(parseWhen('thứ hai', new Date(2026, 10, 1, 23, 59)).date, '2026-11-02');
  assert.equal(parseWhen('chủ nhật', new Date(2026, 10, 1, 23, 59)).date, '2026-11-08');
});
