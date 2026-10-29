/*vá 8 bug vòng mới (hợp đồng v1.2.1) — test là bản chạy được của các sửa lỗi:
  #1 chính sách hủy (staff hủy hộ · guest chỉ với dữ liệu guest)
  #6 ensureSeeded/seedDemo chống chạy song song
  #7 WELCOME10 "đơn đầu tiên" áp cả guest
  #8 doanh thu theo completedAt
  (#2/#4/#5 là sửa UI entry-profile/cart/staff — nghiệm thu qua browser, không test node được) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { ApiError } from '../src/core/errors.js';
import { SEED } from '../src/data/seed.js';

const fresh = () => new Storage(memoryDriver());
const mk = ({ identity = () => null, storage = fresh(), now } = {}) =>
  createApi({ storage, seed: SEED, identity, ...(now ? { now } : {}) });

/* ---------- #1 — chính sách chạm dữ liệu ---------- */
test('#1a staff được hủy HỘ đơn + booking của khách (trước đây FORBIDDEN)', async () => {
  const store = fresh();
  const boot = mk({ storage: store });
  await boot.users.seedDemo();
  const staffId = (await boot.users.getAll()).find((u) => u.phone === '0900000002').id;
  const custId = (await boot.users.create({ name: 'Khách A', phone: '0900000005', password: 'cappan123' })).id;

  const staff = mk({ storage: store, identity: () => staffId });
  const cust = mk({ storage: store, identity: () => custId });

  const o = await cust.orders.create({
    items: [{ itemId: 'M001', qty: 1 }],
    address: '1 Lê Lợi',
    phone: '0900000005'
  });
  const c = await staff.orders.cancel(o.id); // staff hủy hộ — phải thành công
  assert.equal(c.status, 'cancelled');

  const bk = await cust.bookings.create({ seatId: 'A1', date: '2031-01-01', time: '10:00' });
  assert.equal(bk.status, 'confirmed');
  const cb = await staff.bookings.cancel(bk.id);
  assert.equal(cb.status, 'cancelled');
  assert.equal((await staff.seats.getById('A1')).status, 'available'); // vẫn trả ghế như contract
});

test('#1b guest (chưa login) KHÔNG hủy được đơn/booking có chủ — chặn lọt guard cũ', async () => {
  const store = fresh();
  const boot = mk({ storage: store });
  await boot.users.seedDemo();
  const custId = (await boot.users.create({ name: 'Khách B', phone: '0900000006', password: 'cappan123' })).id;
  const cust = mk({ storage: store, identity: () => custId });
  const guest = mk({ storage: store, identity: () => null });

  const o = await cust.orders.create({
    items: [{ itemId: 'M001', qty: 1 }],
    address: '1 Lê Lợi',
    phone: '0900000006'
  });
  await assert.rejects(
    () => guest.orders.cancel(o.id), // guard cũ: `o.userId && identity()` bỏ qua khi guest → hủy được đơn người khác
    (e) => e instanceof ApiError && e.code === 'FORBIDDEN'
  );

  const bk = await cust.bookings.create({ seatId: 'A2', date: '2031-01-02', time: '10:00' });
  await assert.rejects(
    () => guest.bookings.cancel(bk.id),
    (e) => e.code === 'FORBIDDEN'
  );
  await assert.rejects(
    () => guest.bookings.update(bk.id, { time: '11:00' }),
    (e) => e.code === 'FORBIDDEN'
  );
  // dữ liệu không rơi vãi: đơn + booking vẫn nguyên trạng
  assert.equal((await cust.orders.getById(o.id)).status, 'pending');
  assert.equal((await cust.bookings.getById(bk.id)).status, 'confirmed');
});

test('#1c guest vẫn hủy được DỮ LIỆU GUEST của mình (userId=null — không có chủ DNA)', async () => {
  const guest = mk({ identity: () => null });
  const o = await guest.orders.create({
    items: [{ itemId: 'M101', qty: 1 }],
    address: '2 Trân Hưng Đạo',
    phone: '0917777777'
  });
  const g = await guest.bookings.create({ seatId: 'A3', date: '2031-01-03', time: '10:00' });
  assert.equal((await guest.orders.cancel(o.id)).status, 'cancelled');
  assert.equal((await guest.bookings.cancel(g.id)).status, 'cancelled');
});

/* ---------- #6 — chống chạy song song seed ---------- */
test('#6 seedDemo gọi đồng thời không nhân đôi user demo; readers song song cùng chờ 1 lần seed', async () => {
  const store = fresh();
  const api = mk({ storage: store });
  /* kịch bản thật: nhiều entry mở Promise.all cùng seedDemo + các reader */
  const [n] = await Promise.all([
    api.users.seedDemo(),
    api.users.seedDemo(),
    api.users.seedDemo(),
    api.menu.getAll(),
    api.staff.getAll(),
    api.stats.today(),
    api.orders.getAll()
  ]);
  assert.equal(n, 2); // đúng 2 user demo (trước đây có thể 4+)
  assert.equal((await api.users.getAll()).length, 2);
  assert.equal((await api.menu.getAll()).length, SEED.menu.length); // seed idempotent, không nhân đôi menu
  /* seedDemo sau đó: idempotent → 0 */
  assert.equal(await api.users.seedDemo(), 0);
});

/* ---------- #7 — WELCOME10 guest chỉ dùng 1 lần ---------- */
test('#7 guest dùng WELCOME10 đúng 1 lần — evaluate lẫn orders.create đều bị chặn sau đơn guest đầu', async () => {
  const store = fresh();
  const guest = mk({ storage: store, identity: () => null });

  const ev1 = await guest.promotions.evaluate('WELCOME10', 100000, 15000, null);
  assert.ok(ev1.ok); // trước đơn đầu: được dùng
  const o = await guest.orders.create({
    items: [{ itemId: 'M001', qty: 3 }], // 105k + ship — promoCode do facade evaluate
    address: '3 Nguyễn Huệ',
    phone: '0916666666',
    promoCode: 'WELCOME10'
  });
  assert.equal(o.promoCode, 'WELCOME10');
  assert.equal(o.discount, 10500); // 10% của 105000

  const ev2 = await guest.promotions.evaluate('WELCOME10', 100000, 15000, null); // BUG cũ: `&& userId` → KHÔNG đếm đơn guest
  assert.equal(ev2.ok, false);
  assert.match(ev2.error, /đầu tiên/);
  await assert.rejects(
    () =>
      guest.orders.create({
        items: [{ itemId: 'M001', qty: 1 }],
        address: '3 Nguyễn Huệ',
        phone: '0916666666',
        promoCode: 'WELCOME10'
      }),
    (e) => e.code === 'VALIDATION'
  );
  /* người đã login khác vẫn dùng được mã của riêng họ */
  const boot2 = mk({ storage: store, identity: () => 'U-KHAC' });
  assert.ok((await boot2.promotions.evaluate('WELCOME10', 100000, 15000, 'U-KHAC')).ok);
});

/* ---------- #8 — doanh thu theo ngày HOÀN TẤT ---------- */
test('#8 stats.today: đơn hoàn tất sáng nay vào doanh thu HÔM NAY dù tạo tối qua (theo completedAt)', async () => {
  const store = fresh();
  let clock = new Date('2026-11-01T23:50:00'); // tối 1/11 — tạo đơn
  const api = mk({ storage: store, identity: () => 'U001', now: () => clock });
  const o = await api.orders.create({
    items: [{ itemId: 'M001', qty: 2 }], // 70k + 15k ship = 85k
    address: '4 Lê Thánh Tôn',
    phone: '0918888888'
  });
  assert.equal((await api.stats.today()).total, 0); // chưa hoàn tất → chưa phải doanh thu

  clock = new Date('2026-11-02T00:05:00'); // 00:05 sáng 2/11 — hoàn tất
  await api.orders.updateStep(o.id, 4);
  const t = await api.stats.today(); /* BUG cũ: lọc theo createdAt (1/11) → today(2/11) bỏ sót đơn */
  assert.equal(t.total, 85000);
  assert.equal(t.completedCount, 1);
  assert.equal(t.count, 0); // tạo hôm qua → không nằm trong count hôm nay
  assert.equal(t.pendingCount, 0);

  clock = new Date('2026-11-03T09:00:00'); // ngày khác — doanh thu hoàn tất 2/11 KHÔNG còn ở today
  assert.equal((await api.stats.today()).total, 0);
  /* nhưng nằm trong tuần/tháng của 2/11 */
  clock = new Date('2026-11-02T12:00:00');
  const wk = await api.stats.thisWeek();
  assert.equal(wk.total, 85000);
  const mo = await api.stats.thisMonth();
  assert.equal(mo.total, 85000);
});
