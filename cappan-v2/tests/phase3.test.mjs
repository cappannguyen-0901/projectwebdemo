/* P3 — promotions / orders.create(promoCode) / stats / staff / shifts (hợp đồng v1.2) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { SEED } from '../src/data/seed.js';

const NOW = new Date('2026-10-29T12:00:00'); /* "hôm nay" cố định — Thursday 2026-10-29 */
const fresh = () => new Storage(memoryDriver());
const mk = (opts = {}) =>
  createApi({
    storage: opts.storage || fresh(),
    seed: SEED,
    identity: opts.identity || (() => null),
    now: () => NOW
  });

/* helper: 1 đơn COMPLETED ở "hôm nay" (step 4) bằng updateStep */
const completeOrder = async (api, input) => {
  const o = await api.orders.create({ address: '12 Lê Lợi', phone: '0901111111', ...input });
  await api.orders.updateStep(o.id, 4);
  return api.orders.getById(o.id);
};

/* ======================= promotions (§3.8 v1.2) ======================= */
test('promotions: seed đúng 3 mã legacy · status active/off · getActive', async () => {
  const api = mk();
  const all = await api.promotions.getAll();
  assert.deepEqual(
    all.map((p) => p.code),
    ['WELCOME10', 'FREESHIP', 'CAFE20']
  );

  assert.equal(await api.promotions.status(all[0]), 'active'); // 2026-10-29 trong 2026-01-01..2027-12-31
  assert.equal(await api.promotions.status({ ...all[0], active: false }), 'off');
  assert.equal(await api.promotions.status({ ...all[0], endDate: '2026-10-01' }), 'expired');
  assert.equal(await api.promotions.status({ ...all[0], startDate: '2030-01-01' }), 'upcoming');
  assert.equal((await api.promotions.getActive()).length, 3);
});

test('promotions.evaluate: 10% cap 30k · minOrder chặn · mã không tồn tại · expired', async () => {
  const api = mk();
  /* WELCOME10: 10% của 250.000 = 25.000 (< cap 30.000) */
  const w = await api.promotions.evaluate('welcome10', 250000, 15000, 'U-new');
  assert.equal(w.ok, true);
  assert.equal(w.discount, 25000);
  /* cap 10% của 500.000 = 50.000 → bị cắt còn maxDiscount 30.000 */
  assert.equal(
    (await api.promotions.evaluate('WELCOME10', 500000, 15000, 'U-new')).discount,
    30000
  );

  /* minOrder: FREESHIP cần 100.000 — đơn 90k sai → chặn */
  const f = await api.promotions.evaluate('FREESHIP', 90000, 15000, 'U-new');
  assert.equal(f.ok, false);
  assert.match(f.error, /tối thiểu 100\.000đ/);

  /* mã lạ + hết hạn */
  assert.equal((await api.promotions.evaluate('NOPE', 100, 0)).ok, false);
  /*Expired simulation: tự đặt endDate quá khứ*/
  await api.promotions.create({
    code: 'OLDCODE',
    name: 'Cũ',
    discount: '5%',
    endDate: '2020-01-01'
  });
  const oldEv = await api.promotions.evaluate('OLDCODE', 100000, 15000);
  assert.equal(oldEv.ok, false);
  assert.match(oldEv.error, /hết hạn/);
});

test('promotions.evaluate: FREESHIP chỉ giảm tối đa bằng phí ship · CAFE20 fixed 20k', async () => {
  const api = mk();
  /* FREESHIP: '15.000đ' nhưng ship chỉ 15.000 → min(15000, shipping=15000)=15000 */
  assert.equal((await api.promotions.evaluate('FREESHIP', 150000, 15000)).discount, 15000);
  /* ship giao 0 (đặt bàn uống tại chỗ) → FREESHIP không giảm gì */
  assert.equal((await api.promotions.evaluate('FREESHIP', 150000, 0)).discount, 0);
  /* CAFE20: fixed 20.000 khi minOrder đạt */
  assert.equal((await api.promotions.evaluate('CAFE20', 120000, 15000)).discount, 20000);
  /* clamp: discount không vượt subtotal+shipping */
  assert.ok((await api.promotions.evaluate('CAFE20', 150000, 15000)).discount <= 165000);
});

test('promotions.evaluate: WELCOME10 "đơn hàng đầu tiên" — có đơn chưa hủy → chặn', async () => {
  const api = mk({ identity: () => 'U001' });
  await completeOrder(api, { items: [{ itemId: 'M001', qty: 4 }] }); // 140.000, step4
  const ev = await api.promotions.evaluate('WELCOME10', 130000, 15000, 'U001');
  assert.equal(ev.ok, false);
  assert.match(ev.error, /đơn hàng đầu tiên/);
  /* user khác (chưa có đơn) vẫn dùng được */
  assert.equal((await api.promotions.evaluate('WELCOME10', 130000, 15000, 'U999')).ok, true);
  /* đơn CANCELLED không tính vào lịch sử "đã mua" */
  const api2 = mk({ identity: () => 'U002' });
  const o = await api2.orders.create({
    address: 'a',
    phone: '0901111111',
    items: [{ itemId: 'M001', qty: 1 }]
  });
  await api2.orders.cancel(o.id);
  assert.equal((await api2.promotions.evaluate('WELCOME10', 130000, 15000, 'U002')).ok, true);
});

test('promotions.create/remove: VALIDATION format · CONFLICT trùng mã · remove NOT_FOUND', async () => {
  const api = mk();
  await assert.rejects(
    () => api.promotions.create({ code: 'x!!', name: 'Sai', discount: '10%' }),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.promotions.create({ code: 'HIP10', name: '', discount: '10%' }),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.promotions.create({ code: 'HIP10', name: 'n', discount: '', minOrder: 0 }),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.promotions.create({ code: 'WELCOME10', name: 'Trùng', discount: '10%' }),
    (e) => e.code === 'CONFLICT'
  );
  const p = await api.promotions.create({
    code: 'HIP10',
    name: 'Mới',
    discount: '10%',
    maxDiscount: 10000
  });
  assert.equal(p.maxDiscount, 10000);
  assert.equal(await api.promotions.remove('HIP10'), true);
  await assert.rejects(
    () => api.promotions.remove('HIP10'),
    (e) => e.code === 'NOT_FOUND'
  );
});

/* ======================= orders.create(promoCode) — giảm giá do facade tính ======================= */
test('orders.create + promoCode: total giảm đúng 10% cap · mã lỗi → VALIDATION · discount lưu vào Order', async () => {
  const api = mk({ identity: () => 'U001' });
  /* subtotal 12×35.000=420.000 → WELCOME10 10% = 42.000 → cap 30.000. Total = 420k + 15k − 30k = 405.000 */
  const o = await api.orders.create({
    items: [{ itemId: 'M001', qty: 12 }],
    address: '12 Lê Lợi',
    phone: '0901111111',
    promoCode: 'welcome10'
  });
  assert.equal(o.promoCode, 'WELCOME10');
  assert.equal(o.discount, 30000);
  assert.equal(o.total, 405000);

  /* mã không minOrder theomons → VALIDATION bọc message thân tình */
  await assert.rejects(
    () =>
      api.orders.create({
        items: [{ itemId: 'M001', qty: 1 }],
        address: 'a',
        phone: '0901111111',
        promoCode: 'FREESHIP'
      }),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () =>
      api.orders.create({
        items: [{ itemId: 'M001', qty: 1 }],
        address: 'a',
        phone: '0901111111',
        promoCode: 'GHOST'
      }),
    (e) => e.code === 'VALIDATION'
  );
  /* KHÔNG truyền promoCode → total nguyên lệch như P1 */
  const raw = await api.orders.create({
    items: [{ itemId: 'M001', qty: 1 }],
    address: 'a',
    phone: '0901111111'
  });
  assert.equal(raw.total, 50000); // 35k + 15k ship
  assert.equal(raw.discount, 0);
  assert.equal(raw.promoCode, '');
});

/* ======================= stats (§3.8 v1.2) — doanh thu chỉ đếm step≥4 ======================= */
test('stats: today/thisWeek/thisMonth — completed chỉ step4, pending không vào doanh thu', async () => {
  const api = mk({ identity: () => 'U001' });
  await completeOrder(api, { items: [{ itemId: 'M001', qty: 4 }] }); // 140k + 15k = 155k
  await completeOrder(api, { items: [{ itemId: 'M101', qty: 2 }] }); // 90k + 15k = 105k
  await api.orders.create({
    items: [{ itemId: 'M002', qty: 5 }],
    address: 'a',
    phone: '0901111111'
  }); // pending → count có, revenue KHÔNG

  const t = await api.stats.today();
  assert.equal(t.total, 260000); // 155k + 105k
  assert.equal(t.completedCount, 2);
  assert.equal(t.pendingCount, 1);
  assert.equal(t.count, 3);

  /* cancelled loại hoàn toàn khỏi count */
  const o = await api.orders.create({
    items: [{ itemId: 'M002', qty: 1 }],
    address: 'a',
    phone: '0901111111'
  });
  await api.orders.cancel(o.id);
  assert.equal((await api.stats.today()).count, 3);

  /* thisWeek ≥ today (cùng 1 đơn "hôm nay" nhưng distinct completed) */
  const wk = await api.stats.thisWeek();
  assert.ok(wk.total >= t.total);
  /* đơn step<4 (preparing) không vào doanh thu */
  const prep = await api.orders.create({
    items: [{ itemId: 'M001', qty: 10 }],
    address: 'a',
    phone: '0901111111'
  });
  await api.orders.updateStep(prep.id, 1);
  assert.equal((await api.stats.today()).total, 260000);
  assert.equal((await api.stats.today()).pendingCount, 2);
});

test('stats: ordersByStatus · topItems · bookingsByStatus · occupancyRate', async () => {
  const api = mk({ identity: () => 'U001' });
  await completeOrder(api, {
    items: [
      { itemId: 'M001', qty: 2 },
      { itemId: 'M002', qty: 1 }
    ]
  }); // 140k+15k
  const o2 = await api.orders.create({
    items: [{ itemId: 'M002', qty: 3 }],
    address: 'a',
    phone: '0901111111'
  });
  await api.orders.updateStep(o2.id, 1); // preparing
  const o3 = await api.orders.create({
    items: [{ itemId: 'M001', qty: 1 }],
    address: 'a',
    phone: '0901111111'
  });
  await api.orders.cancel(o3.id); // hủy ở step 0 (step≥2 cấm hủy — đúng guard facade)
  const o4 = await api.orders.create({
    items: [{ itemId: 'M001', qty: 1 }],
    address: 'a',
    phone: '0901111111'
  });
  await api.orders.updateStep(o4.id, 3); // shipping

  const st = await api.stats.ordersByStatus();
  assert.equal(st.completed, 1);
  assert.equal(st.preparing, 1);
  assert.equal(st.shipping, 1); // o4 step 3 chưa hủy
  assert.equal(st.cancelled, 1); // o3 hủy ở step 0
  assert.equal(st.pending, 0);

  const top = await api.stats.topItems(5);
  assert.deepEqual(top[0], { name: 'Bạc Xỉu', qty: 4, revenue: 160000 }); // (1 + 3) × 40k — cancelled không tính
  assert.equal(top[1].name, 'Cà Phê Sữa Đá'); // M001
  assert.deepEqual(
    top.map((x) => x.name),
    ['Bạc Xỉu', 'Cà Phê Sữa Đá']
  );

  /* v1.3: create → pending_deposit; trả cọc → confirmed; occ tính từ getMap HÔM NAY */
  await api.bookings.create({ seatId: 'A1', date: '2026-10-30', time: '19:00', guests: 2 }); // ngày mai — chưa chạm sơ đồ hôm nay
  const b2 = await api.bookings.create({
    seatId: 'A2',
    date: '2026-10-29',
    time: '19:00',
    guests: 2
  }); // hôm nay
  await api.bookings.payDeposit(b2.id);
  const bs = await api.stats.bookingsByStatus();
  assert.equal(bs.pendingDeposit, 1);
  assert.equal(bs.confirmed, 1);
  /* occupancy: ghế hôm nay có booking hiệu lực (b2) → booked > 0 */
  const occ = await api.stats.occupancyRate();
  assert.ok(occ > 0 && occ <= 100);
});

/* ======================= staff & shifts (§3.8 v1.2) ======================= */
test('staff: getAll seed 6 người · getById · addFromUser vẫn NOT_IMPLEMENTED', async () => {
  const api = mk();
  const all = await api.staff.getAll();
  assert.equal(all.length, 6);
  assert.equal((await api.staff.getById('S001')).name, 'Nguyễn Văn An');
  assert.equal(await api.staff.getById('NOPE'), null);
  await assert.rejects(
    () => api.staff.addFromUser({ id: 'U1', role: 'staff' }),
    (e) => e.code === 'NOT_IMPLEMENTED'
  );
});

test('shifts: schedule thêm/xóa · CONFLICT 2 ca cùng ngày · VALIDATION/NOT_FOUND', async () => {
  const api = mk();
  let s = await api.shifts.getSchedule();
  assert.deepEqual(s, {});

  s = await api.shifts.addStaffToShift('2026-10-30', 'morning', 'S001');
  assert.deepEqual(s['2026-10-30'].morning, ['S001']);
  /* thêm thêm người vào cùng ca */
  await api.shifts.addStaffToShift('2026-10-30', 'morning', 'S002');
  /* CONFLICT: đã có ca khác ngày đó (P2-6 legacy) */
  await assert.rejects(
    () => api.shifts.addStaffToShift('2026-10-30', 'evening', 'S001'),
    (e) => e.code === 'CONFLICT'
  );
  /* CONFLICT: trùng chính ca này */
  await assert.rejects(
    () => api.shifts.addStaffToShift('2026-10-30', 'morning', 'S001'),
    (e) => e.code === 'CONFLICT'
  );
  /* ngày khác thì được */
  await api.shifts.addStaffToShift('2026-10-31', 'morning', 'S001');
  /* removeStaffFromShift: idempotent */
  await api.shifts.removeStaffFromShift('2026-10-30', 'morning', 'S001');
  await api.shifts.removeStaffFromShift('2026-10-30', 'morning', 'GHOST');
  s = await api.shifts.getSchedule();
  assert.deepEqual(s['2026-10-30'].morning, ['S002']);
  assert.deepEqual(s['2026-10-31'].morning, ['S001']);

  await assert.rejects(
    () => api.shifts.addStaffToShift('30-10-2026', 'morning', 'S001'),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.shifts.addStaffToShift('2026-10-30', 'nope', 'S001'),
    (e) => e.code === 'NOT_FOUND'
  );
  await assert.rejects(
    () => api.shifts.addStaffToShift('2026-11-01', 'morning', 'NOPE'),
    (e) => e.code === 'NOT_FOUND'
  );
});
