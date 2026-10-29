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
  assert.deepEqual(Object.keys(u).filter((k) => /password|salt|hash/i.test(k)), []);
  assert.equal(((await api.users.getAll())[0]).passwordHash, undefined);
});

test('users: trùng SĐT CONFLICT · SĐT sai/ít mật khẩu VALIDATION', async () => {
  const api = mk();
  await reg(api, '0902222222');
  await assert.rejects(() => reg(api, '0902222222'), (e) => e.code === 'CONFLICT');
  await assert.rejects(() => api.users.create({ name: 'n', phone: 'abc', password: 'cappan123' }), (e) => e.code === 'VALIDATION');
  await assert.rejects(() => api.users.create({ name: 'n', phone: '0903333333', password: '123' }), (e) => e.code === 'VALIDATION');
});

test('users.update: chỉ whitelist field — cố sửa passwordHash/role → VALIDATION', async () => {
  const api = mk();
  const u = await reg(api, '0914444444');
  await assert.rejects(() => api.users.update(u.id, { passwordHash: 'hack' }), (e) => e.code === 'VALIDATION');
  await assert.rejects(() => api.users.update(u.id, { role: 'staff' }), (e) => e.code === 'VALIDATION');
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

  await assert.rejects(() => api.auth.login('0915555555', 'wrong pw'), (e) => e.code === 'UNAUTHORIZED');
  await assert.rejects(() => api.auth.login('0999999999', 'cappan123'), (e) => e.code === 'UNAUTHORIZED');
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

/* ======================= bookings + seats (§3.8 P2) ======================= */
test('bookings.create: khóa ghế · trùng khung giờ CONFLICT · quá sức chứa VALIDATION', async () => {
  const api = mk({ identity: () => 'U001' });
  const bk = await api.bookings.create({ seatId: 'A1', date: '2030-01-01', time: '19:00', guests: 2 });
  assert.ok(bk.id.startsWith('bk-'));
  assert.equal(bk.status, 'confirmed');
  assert.equal((await api.seats.getById('A1')).status, 'booked'); // ghế bị khóa

  await assert.rejects(
    () => api.bookings.create({ seatId: 'A1', date: '2030-01-01', time: '19:00', guests: 2 }),
    (e) => e.code === 'CONFLICT'
  );
  await assert.rejects(
    () => api.bookings.create({ seatId: 'B1', date: '2030-01-01', time: '19:00', guests: 50 }),
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(
    () => api.bookings.create({ seatId: 'C5', date: '2030-01-01', time: '19:00', guests: 9 }), // C5 sức 8
    (e) => e.code === 'VALIDATION'
  );
  await assert.rejects(() => api.bookings.create({ seatId: 'NOPE', date: '2030-01-01', time: '19:00' }), (e) => e.code === 'NOT_FOUND');
});

test('bookings: giới hạn 3 slot hiệu lực/user · stranger FORBIDDEN · cancel/complete trả ghế', async () => {
  const api = mk({ identity: () => 'U001' });
  for (const i of [1, 2, 3]) await api.bookings.create({ seatId: 'A' + i, date: '2030-06-0' + i, time: '10:00' });
  await assert.rejects(
    () => api.bookings.create({ seatId: 'A4', date: '2030-06-04', time: '10:00' }),
    (e) => e.code === 'CONFLICT'
  );

  /* stranger: identity khác không sửa được booking người khác */
  const store2 = fresh();
  const owner = createApi({ storage: store2, seed: SEED, identity: () => 'U001' });
  const bk = await owner.bookings.create({ seatId: 'A1', date: '2030-01-05', time: '09:00' });
  const sneaky = createApi({ storage: store2, seed: SEED, identity: () => 'U999' });
  await assert.rejects(() => sneaky.bookings.cancel(bk.id), (e) => e.code === 'FORBIDDEN');
  await assert.rejects(() => sneaky.bookings.update(bk.id, { time: '11:00' }), (e) => e.code === 'FORBIDDEN');

  /* cancel → ghế trả lại available */
  const c = await owner.bookings.cancel(bk.id);
  assert.equal(c.status, 'cancelled');
  assert.equal((await owner.seats.getById('A1')).status, 'available');

  /* complete → ghế rảnh */
  const bk2 = await owner.bookings.create({ seatId: 'A1', date: '2030-01-05', time: '15:00' });
  const done = await owner.bookings.complete(bk2.id);
  assert.equal(done.status, 'completed');
  assert.equal((await owner.seats.getById('A1')).status, 'available');
});

test('bookings._sweepPast: confirmed quá hạn → completed + trả ghế', async () => {
  const store = fresh();
  const api = mk({ identity: () => 'U001', storage: store });
  const fakePast = {
    id: 'bk-old', userId: 'U001', seatId: 'A2', floorId: 'F1', date: '2020-01-01', time: '10:00',
    guests: 2, note: '', status: 'confirmed', createdAt: '2020-01-01T00:00:00.000Z'
  };
  const rows = (await store.get('bookings')) || [];
  rows.push(fakePast);
  await store.set('bookings', rows);

  await api.seats.book('A2');
  const swept = await api.bookings.getAll(); // sweep giải phóng A2
  const old = swept.find((b) => b.id === 'bk-old');
  assert.equal(old.status, 'completed');
  assert.equal((await api.seats.getById('A2')).status, 'available');
});

test('bookings.update: dời giờ có clash CONFLICT · sửa note/guests OK', async () => {
  const api = mk({ identity: () => 'U001' });
  const a = await api.bookings.create({ seatId: 'C1', date: '2030-03-01', time: '08:00' }); // C1 chứa tối đa 4
  await api.bookings.create({ seatId: 'C1', date: '2030-03-01', time: '10:00' });
  await assert.rejects(() => api.bookings.update(a.id, { time: '10:00' }), (e) => e.code === 'CONFLICT');
  const u = await api.bookings.update(a.id, { time: '09:30', guests: 4, note: 'gần cửa sổ' });
  assert.equal(u.time, '09:30');
  assert.equal(u.guests, 4);
  assert.equal(u.note, 'gần cửa sổ');
});

/* ======================= export/import không rò secret dễ sửa ======================= */
test('exportAll v1.1 có chứa users đã hash — KHÔNG plaintext password', async () => {
  const api = mk();
  await api.users.seedDemo();
  const snap = await api.exportAll();
  assert.equal(snap.contract, '1.2');
  const dump = JSON.stringify(snap);
  assert.equal(dump.includes('cappan123'), false); // legacy từng có password "123" gõ sạch trong localStorage
  assert.ok(snap.data.users[0].passwordHash.length >= 40);
});
