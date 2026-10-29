/* Bước 2 & 3 — identity / auth / bookings / users (hợp đồng v1.1) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { SEED } from '../src/data/seed.js';
import { hashPassword, verifyPassword } from '../src/core/hash.js';

const fresh = () => new Storage(memoryDriver());
const mk = ({ identity = () => null, storage = fresh() } = {}) =>
  createApi({ storage, seed: SEED, identity });

const reg = async (api, phone = '0901111111', password = 'cappan123') =>
  api.users.create({ name: 'Người dùng ' + phone.slice(-4), phone, password });

/* ======================= core/hash.js ======================= */
test('hash: PBKDF2 roundtrip + sai mật khẩu → false', async () => {
  const cred = await hashPassword('cappan123');
  assert.ok(cred.salt && cred.hash && cred.algo === 'PBKDF2-SHA256');
  assert.notEqual(cred.hash, 'cappan123'); // không còn plaintext kiểu legacy
  assert.equal((await hashPassword('cappan123x', cred.salt)).hash !== cred.hash, true); // 1 ký tự khác → hash khác
  assert.equal(await verifyPassword('cappan123', cred), true);
  assert.equal(await verifyPassword('sai-rồi', cred), false);
  assert.equal(await verifyPassword('cappan123', null), false);
});

/* ======================= users (§3.7) ======================= */
test('users.create: hash mật khẩu, KHÔNG rò password/salt ra ngoài (public shape)', async () => {
  const api = mk();
  const u = await reg(api);
  assert.ok(u.id.startsWith('U'));
  assert.equal(typeof u.id, 'string');
  assert.deepEqual(
    Object.keys(u).filter((k) => /password|salt|hash/i.test(k)),
    []
  );
  assert.equal((await api.users.getAll())[0].passwordHash, undefined);
});

test('users: trùng SĐT CONFLICT · SĐT sai/ít mật khẩu VALIDATION', async () => {
  const api = mk();
  await reg(api, '0902222222');
  await assert.rejects(
    () => reg(api, '0902222222'),
    (e) => e.code === 'CONFLICT'
  );
  await assert.rejects(
    () => api.users.create({ name: 'n', phone: 'abc', password: 'cappan123' }),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.users.create({ name: 'n', phone: '0903333333', password: '123' }),
    (e) => e.code === 'VALIDATION'
  );
});

test('users.update: chỉ whitelist field — cố sửa passwordHash/role → VALIDATION', async () => {
  const api = mk();
  const u = await reg(api, '0914444444');
  await assert.rejects(
    () => api.users.update(u.id, { passwordHash: 'hack' }),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.users.update(u.id, { role: 'staff' }),
    (e) => e.code === 'VALIDATION'
  );
  const after = await api.users.update(u.id, { address: '12 Lê Lợi' });
  assert.equal(after.address, '12 Lê Lợi');
  assert.equal(after.role, 'customer'); // role không đổi
});

/* ======================= auth (§3.10) ======================= */
test('auth: login đúng/sai · session chỉ {userId} · logout', async () => {
  const store = fresh();
  const api = mk({ identity: () => null, storage: store });
  await reg(api, '0915555555');
  const u = await api.auth.login('0915555555', 'cappan123');
  assert.ok(u.id.startsWith('U'));

  const sess = await store.get('session');
  assert.deepEqual(Object.keys(sess), ['userId', 'at']); // KHÔNG chứa user object như legacy
  assert.deepEqual((await api.auth.current()).id, u.id);

  await assert.rejects(
    () => api.auth.login('0915555555', 'wrong pw'),
    (e) => e.code === 'UNAUTHORIZED'
  );
  await assert.rejects(
    () => api.auth.login('0999999999', 'cappan123'),
    (e) => e.code === 'UNAUTHORIZED'
  );
  assert.equal(await api.auth.logout(), true);
  assert.equal(await api.auth.current(), null);
});

test('auth.login: merge giỏ guest vào giỏ user (như legacy)', async () => {
  const store = fresh();
  const apiG = mk({ identity: () => null, storage: store });
  await apiG.users.seedDemo();
  await apiG.cart.add({ itemId: 'M001', qty: 2 });
  const u = await apiG.auth.login('0900000001', 'cappan123');

  const apiU = mk({ identity: () => u.id, storage: store });
  assert.equal((await apiU.cart.get())[0].qty, 2); // giỏ "sau login" của identity này
  assert.deepEqual(await apiG.cart.get(), []); // giỏ guest rỗng
});

/* ======================= identity + cart theo user (Bước 2) ======================= */
test('identity: giỏ tách bạch theo từng bản dạng — key per-uid', async () => {
  const store = fresh();
  const api = createApi({ storage: store, seed: SEED, identity: () => 'U001' });
  await api.cart.add({ itemId: 'M101' });
  const api2 = createApi({ storage: store, seed: SEED, identity: () => 'U002' });
  assert.deepEqual(await api2.cart.get(), []); // U002 KHÔNG thấy giỏ U001
  assert.equal((await api.cart.get()).length, 1);
});

/* ======================= bookings v1.3 + seats (§3.8 — đặt chỗ = giữ chỗ) ======================= */
/* giờ dùng chung cho test đặt chỗ: 2026-10-29T12:00 — mọi timer lùi/còn bằng setClock */
let clock = new Date('2026-10-29T12:00:00');
const setClock = (d) => (clock = new Date(d));
const mkAt = ({ identity = () => null, storage = fresh() } = {}) =>
  createApi({ storage, seed: SEED, identity, now: () => clock });
const BK = (o = {}) => ({ seatId: 'A1', date: '2026-10-30', time: '19:00', guests: 2, ...o });

test('bookings.create v1.3: pending_deposit + cọc ceil(cap/2)·35k · khóa cả ngày (giờ khác vẫn CONFLICT) · VALIDATION', async () => {
  setClock('2026-10-29T12:00:00'); // reset giờ — mỗi test bắt đầu 12:00 ngày 29/10
  const api = mkAt({ identity: () => 'U001' });
  const bk = await api.bookings.create(BK());
  assert.ok(bk.id.startsWith('bk-'));
  assert.equal(bk.status, 'pending_deposit'); // phải trả cọc mới GIỮ bàn
  assert.equal(bk.depositAmount, 35000); // 2 chỗ → 1 ly
  assert.ok(bk.depositExpiresAt); // hẹn trả cọc 15'

  await assert.rejects(
    () => api.bookings.create(BK({ time: '21:00' })), // cùng NGÀY, giờ khác — vẫn bị chặn (1 bàn 1 booking/ngày)
    (e) => e.code === 'CONFLICT'
  );
  const bk2 = await api.bookings.create(BK({ date: '2026-10-31', time: '21:00' })); // ngày khác → OK
  assert.equal(bk2.status, 'pending_deposit');

  await assert.rejects(
    () => api.bookings.create(BK({ seatId: 'B1', guests: 50 })),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.bookings.create(BK({ seatId: 'C5', guests: 9 })), // C5 sức 8
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.bookings.create({ seatId: 'NOPE', date: '2026-10-30', time: '19:00' }),
    (e) => e.code === 'NOT_FOUND'
  );
  await assert.rejects(
    () => api.bookings.create(BK({ time: '23:00' })), // ngoài giờ mở cửa
    (e) => e.code === 'VALIDATION' && e.extra?.field === 'time'
  );
  await assert.rejects(
    () => api.bookings.create(BK({ date: '2026-12-30' })), // quá 30 ngày
    (e) => e.code === 'VALIDATION' && e.extra?.field === 'date'
  );
  await assert.rejects(
    () => api.bookings.create(BK({ date: '2026-10-28' })), // ngày quá khứ
    (e) => e.code === 'VALIDATION'
  );
});

test('bookings vòng đời v1.3: payDeposit → checkIn → complete · chỉ staff được checkIn/complete · seated giữ bàn', async () => {
  setClock('2026-10-29T12:00:00'); // reset giờ — mỗi test bắt đầu 12:00 ngày 29/10
  const store = fresh();
  const boot = mkAt({ storage: store });
  await boot.users.seedDemo();
  const staffId = (await boot.users.getAll()).find((u) => u.phone === '0900000002').id;
  const staff = mkAt({ storage: store, identity: () => staffId });
  const cust = mkAt({ storage: store, identity: () => 'U-KH' });

  const bk = await cust.bookings.create(BK());
  assert.equal((await cust.bookings.getById(bk.id)).status, 'pending_deposit');

  const c = await staff.bookings.payDeposit(bk.id); // staff trả cọc HỘ khách (canTouch)
  assert.equal(c.status, 'confirmed');
  assert.equal(c.depositPaid, true);
  assert.ok(c.depositPaidAt);

  await assert.rejects(
    () => cust.bookings.checkIn(bk.id), // checkIn là việc nội bộ — khách gọi bị FORBIDDEN
    (e) => e.code === 'FORBIDDEN'
  );
  assert.equal((await staff.bookings.checkIn(bk.id)).status, 'seated');

  setClock('2026-10-30T23:00:00');
  assert.equal((await staff.bookings.getById(bk.id)).status, 'seated'); // seated giữ KHÔNG giới hạn — sweep không đụng
  const done = await staff.bookings.complete(bk.id);
  assert.equal(done.status, 'completed');
});

test('bookings sweep v1.3: hết 15\' chưa trả cọc → expired · confirmed quá +30\' → no_show + noShowCount++ · nhả bàn', async () => {
  setClock('2026-10-29T12:00:00'); // reset giờ — mỗi test bắt đầu 12:00 ngày 29/10
  const store = fresh();
  const boot = mkAt({ storage: store });
  const uid = (await boot.users.create({ name: 'K', phone: '0901010101', password: 'cappan123' })).id;
  const api = mkAt({ storage: store, identity: () => uid });

  const b1 = await api.bookings.create(BK({ seatId: 'A1', guests: 2 })); // pending — sẽ để quá hạn cọc
  const b2 = await api.bookings.create(BK({ seatId: 'B1', date: '2026-10-29', time: '19:00' })); // pending — sẽ trả cọc
  await api.bookings.payDeposit(b2.id);

  setClock('2026-10-30T19:31:00'); // b1 quá hạn cọc từ 12:15 · b2 quá +30' từ 19:30
  const rows = await api.bookings.getAll(); // sweep chạy ngầm lần đọc đầu
  assert.equal(rows.find((x) => x.id === b1.id).status, 'expired');
  assert.equal(rows.find((x) => x.id === b1.id).closedReason, 'deposit_timeout');
  assert.equal(rows.find((x) => x.id === b2.id).status, 'no_show');
  assert.equal(rows.find((x) => x.id === b2.id).closedReason, 'auto_cancel_30m');
  await assert.rejects(
    () => api.bookings.payDeposit(b1.id), // hết khung chờ cọc — muộn
    (e) => e.code === 'CONFLICT'
  );
  assert.equal((await api.users.getById(uid)).noShowCount, 1); // no_show bị đếm lên user

  const map = await api.seats.getMap('2026-10-30'); // nhả cả 2 bàn
  assert.equal(map.find((s) => s.id === 'A1').status, 'available');
  assert.equal(map.find((s) => s.id === 'B1').status, 'available');
});

test('bookings.cancel v1.3: trước 00:00 hoàn cọc 100% · từ 00:00 mất · hủy hộ seated → CONFLICT', async () => {
  setClock('2026-10-29T12:00:00'); // reset giờ — mỗi test bắt đầu 12:00 ngày 29/10
  const store = fresh();
  const boot = mkAt({ storage: store });
  await boot.users.seedDemo();
  const staffId = (await boot.users.getAll()).find((u) => u.phone === '0900000002').id;
  const staff = mkAt({ storage: store, identity: () => staffId });
  const uid = (await boot.users.create({ name: 'K', phone: '0902020202', password: 'cappan123' })).id;
  const cust = mkAt({ storage: store, identity: () => uid });

  /* trước 00:00 ngày D: hoàn 100% (đang 12:00 ngày 29 < 00:00 ngày 30) */
  const b1 = await cust.bookings.create(BK());
  await staff.bookings.payDeposit(b1.id);
  const c1 = await cust.bookings.cancel(b1.id);
  assert.equal(c1.status, 'cancelled');
  assert.equal(c1.refundAmount, 35000);
  assert.equal(c1.cancelledBy, uid);

  /* từ 00:00 ngày D: mất cọc */
  const b2 = await cust.bookings.create(BK()); // bàn A1 đã nhả sau hủy — đặt lại được
  await staff.bookings.payDeposit(b2.id);
  setClock('2026-10-30T00:00:00');
  const c2 = await cust.bookings.cancel(b2.id);
  assert.equal(c2.refundAmount, 0);

  /* seated → cancel CONFLICT (dùng complete) */
  const b3 = await cust.bookings.create(BK({ seatId: 'A2', date: '2026-10-30', time: '19:00' }));
  await staff.bookings.payDeposit(b3.id);
  await staff.bookings.checkIn(b3.id);
  await assert.rejects(
    () => cust.bookings.cancel(b3.id),
    (e) => e.code === 'CONFLICT' && /đang ngồi/.test(e.message)
  );
});

test('seats.getMap v1.3: reserved trước 00:00 ngày D · booked từ 00:00 · nhả bàn sau no_show', async () => {
  setClock('2026-10-29T12:00:00'); // reset giờ — mỗi test bắt đầu 12:00 ngày 29/10
  const api = mkAt();
  const b = await api.bookings.create(BK({ time: '19:00' })); // pending — đang giữ bàn từ lúc đặt
  let m = await api.seats.getMap('2026-10-30');
  assert.equal(m.find((s) => s.id === 'A1').status, 'reserved'); // 12:00 ngày 29 < 00:00 ngày 30
  assert.equal(m.find((s) => s.id === 'A1').bookingId, b.id);
  m = await api.seats.getMap('2026-10-31');
  assert.equal(m.find((s) => s.id === 'A1').status, 'available'); // ngày khác trống

  await api.bookings.payDeposit(b.id);
  setClock('2026-10-30T00:00:00');
  assert.equal((await api.seats.getMap('2026-10-30')).find((s) => s.id === 'A1').status, 'booked'); // từ 00:00
  setClock('2026-10-30T19:31:00'); // không ai đến
  assert.equal(
    (await api.seats.getMap('2026-10-30')).find((s) => s.id === 'A1').status,
    'available'
  );
});

test('bookings v1.3: giới hạn 3 hiệu lực/user · stranger FORBIDDEN · guest đặt & hủy được booking guest', async () => {
  setClock('2026-10-29T12:00:00'); // reset giờ — mỗi test bắt đầu 12:00 ngày 29/10
  const api = mkAt({ identity: () => 'U001' });
  for (const dt of ['2026-10-30', '2026-10-31', '2026-11-01'])
    await api.bookings.create(BK({ seatId: 'A2', date: dt, time: '10:00' }));
  await assert.rejects(
    () => api.bookings.create(BK({ seatId: 'A3', date: '2026-11-02', time: '10:00' })),
    (e) => e.code === 'CONFLICT' && /hiệu lực/.test(e.message)
  );

  /* stranger: identity khác không được hủy booking người khác */
  const store = fresh();
  const owner = mkAt({ storage: store, identity: () => 'U001' });
  const bk = await owner.bookings.create(BK());
  const sneaky = mkAt({ storage: store, identity: () => 'U999' });
  await assert.rejects(
    () => sneaky.bookings.cancel(bk.id),
    (e) => e.code === 'FORBIDDEN'
  );
  const c = await owner.bookings.cancel(bk.id); // chủ hủy được
  assert.equal(c.status, 'cancelled');

  /* guest: đặt được (userId=null) và hủy được booking guest của mình */
  const guest = mkAt({ storage: store, identity: () => null });
  const g = await guest.bookings.create(BK({ seatId: 'A4' }));
  assert.equal(g.userId, null);
  assert.equal((await guest.bookings.cancel(g.id)).status, 'cancelled');
});

test('bookings.getLateCards v1.3: thẻ trễ giữa +15\'..+30\' · guest chỉ xem thẻ của mình', async () => {
  setClock('2026-10-29T12:00:00'); // reset giờ — mỗi test bắt đầu 12:00 ngày 29/10
  const api = mkAt({ identity: () => 'U-LT' });
  const b = await api.bookings.create(BK());
  await api.bookings.payDeposit(b.id);

  setClock('2026-10-30T19:10:00');
  assert.deepEqual(await api.bookings.getLateCards('U-LT'), []); // chưa trễ
  setClock('2026-10-30T19:16:00');
  const cards = await api.bookings.getLateCards('U-LT');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].type, 'booking-late');
  assert.equal(cards[0].data.bookingId, b.id);
  assert.equal(cards[0].data.autoCancelAt, '19:30');
  assert.equal(cards[0].data.minutesLate, 16);
  assert.equal(cards[0].data.depositLostOnCancel, 35000);
  assert.deepEqual(cards[0].data.actions, ['cancel']);
  setClock('2026-10-30T19:31:00'); // quá +30 — tự hủy, không còn thẻ
  assert.deepEqual(await api.bookings.getLateCards('U-LT'), []);

  /* người lạ không xem được thẻ của người khác */
  setClock('2026-10-30T19:16:00');
  const other = await api.bookings.create(BK({ seatId: 'B2', date: '2026-10-31', time: '19:00' })); // ngày mai — không rơi vào thẻ trễ hôm nay
  await api.bookings.payDeposit(other.id);
  const stranger = mkAt({ identity: () => 'U-NG' });
  await assert.rejects(
    () => stranger.bookings.getLateCards('U-LT'),
    (e) => e.code === 'FORBIDDEN'
  );
});


/* ======================= export/import không rò secret dễ sửa ======================= */
test('exportAll v1.1 có chứa users đã hash — KHÔNG plaintext password', async () => {
  const api = mk();
  await api.users.seedDemo();
  const snap = await api.exportAll();
  assert.equal(snap.contract, '1.3');
  const dump = JSON.stringify(snap);
  assert.equal(dump.includes('cappan123'), false); // legacy từng có password "123" gõ sạch trong localStorage
  assert.ok(snap.data.users[0].passwordHash.length >= 40);
});
