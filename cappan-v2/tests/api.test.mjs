/* Hợp đồng §3 — API facade: tính giá catalog, quy tắc đọc, guard order */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api/index.js';
import { Storage, memoryDriver } from '../src/core/storage.js';
import { ApiError } from '../src/core/errors.js';
import { SEED } from '../src/data/seed.js';
import { SHIPPING_FEE } from '../src/data/schema.js';

const fresh = () => new Storage(memoryDriver());
const mk = ({ identity = () => null, storage = fresh() } = {}) =>
  createApi({ storage, seed: SEED, identity });

/* ======================= §3.1/3.2/3.3 — READ CATALOG ======================= */
test('menu.getAll: đủ seed, sort theo category.order, reader trả null (§3.0)', async () => {
  const api = mk();
  const all = await api.menu.getAll();
  assert.equal(all.length, SEED.menu.length);
  assert.equal(all[0].categoryId, 'coffee');
  assert.equal((await api.menu.getById('M503'))?.id, 'M503');
  assert.equal(await api.menu.getById('M999'), null);
  assert.deepEqual((await api.menu.getByCategory('tea')).map((m) => m.id), ['M101', 'M102', 'M103', 'M104']);
  await assert.rejects(() => api.menu.getByCategory('nope'), (e) => e instanceof ApiError && e.code === 'NOT_FOUND');
});

test('menu flip stock + mutator throw NOT_FOUND', async () => {
  const api = mk();
  const out = await api.menu.markOutOfStock('M104');
  assert.equal(out.inStock, false);
  assert.ok((await api.menu.getOutOfStock()).some((m) => m.id === 'M104'));
  assert.ok(!(await api.menu.getAvailable()).some((m) => m.id === 'M104'));
  assert.equal((await api.menu.markInStock('M104')).inStock, true);
  await assert.rejects(() => api.menu.markOutOfStock('M999'), (e) => e.code === 'NOT_FOUND');
});

test('categories/floors/seats: seed đúng + tầng lạ NOT_FOUND (ghế mutation đã P2 — test ở phase2)', async () => {
  const api = mk();
  assert.equal((await api.categories.getAll())[0].id, 'coffee');
  assert.equal((await api.floors.getById('F2'))?.name, 'Lầu 1');
  assert.equal((await api.seats.getByFloor('F2')).length, 10);
  assert.equal((await api.seats.getAvailable()).length, 32);
  await assert.rejects(() => api.seats.getByFloor('F9'), (e) => e.code === 'NOT_FOUND');
});

/* ======================= §3.5 cart — GIÁ LUÔN TỪ CATALOG (§0.7) ======================= */
test('cart.add: giá tính server-side (size L + 2 topping), chuẩn hóa qty', async () => {
  const api = mk();
  const rows = await api.cart.add({ itemId: 'M001', size: 'L', toppings: ['Shot espresso', 'Kem'], qty: 2 });
  // M001 35k + L 10k + (10k + 8k) = 63k/ly — KHÔNG tin giá client
  assert.equal(rows[0].price, 63000);
  assert.equal(rows[0].size, 'L');
  assert.equal(rows[0].sizeExtra, 10000);
  assert.equal(rows[0].qty, 2);
  assert.equal(await api.cart.subtotal(), 126000);
});

test('cart.add: gộp dòng trùng itemId+size+toppings; size lạ → VALIDATION (giá client bị bỏ)', async () => {
  const api = mk();
  await api.cart.add({ itemId: 'M001', price: 1 }); // 'price: 1' — facade tự tính lại, không lỗi
  await api.cart.add({ itemId: 'M001' });
  await api.cart.add({ itemId: 'M001', toppings: ['Kem'] }); // M001 có topping "Kem"
  const rows = await api.cart.get();
  assert.equal(rows.filter((l) => l.itemId === 'M001').length, 2); // 1 dòng qty2 (đã gộp) + 1 dòng có Kem
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].price, 35000);

  await assert.rejects(() => api.cart.add({ itemId: 'M001', size: 'XXL' }), (e) => e.code === 'VALIDATION');
  await assert.rejects(() => api.cart.add({ itemId: 'NOPE' }), (e) => e.code === 'VALIDATION');
  await assert.rejects(() => api.cart.add({ itemId: 'M101', qty: 0 }), (e) => e.code === 'VALIDATION');
});

test('cart.remove/clear + mergeGuestToUser', async () => {
  const api = mk();
  await api.cart.add({ itemId: 'M001' });
  await api.cart.add({ itemId: 'M002', size: 'L' });
  const left = await api.cart.remove('M001');
  assert.ok(left.every((l) => l.itemId !== 'M001'));
  await api.cart.remove('M002', 'L');
  assert.deepEqual(await api.cart.get(), []);

  await api.cart.add({ itemId: 'M101', qty: 3 }); // giỏ guest
  const merged = await api.cart.mergeGuestToUser('U001');
  assert.equal(merged.find((l) => l.itemId === 'M101').qty, 3);
  assert.deepEqual(await api.cart.get(), []); // giỏ guest trở về rỗng sau merge
});

/* ======================= §3.6 orders ======================= */
test('orders.create: TÍNH LẠI GIÁ + TỔNG từ catalog, KHÔNG tin client (§0.7)', async () => {
  const api = mk();
  const order = await api.orders.create({
    items: [{ itemId: 'M101', qty: 2, price: 1 }], // 'price: 1' phải bị bỏ — M101 không có topping
    address: '12 Nguyễn Huệ, Q1',
    phone: '0901234567'
  });
  // M101 45k × 2 = 90k + ship 15k — giá client đã bị thay bằng catalog
  assert.equal(order.subtotal, 90000);
  assert.equal(order.shipping, SHIPPING_FEE);
  assert.equal(order.total, 105000);
  assert.equal(order.status, 'pending');
  assert.ok(order.id.startsWith('od-'));
  assert.deepEqual((await api.orders.getActive()).map((o) => o.id), [order.id]);
});

test('orders.create: VALIDATION — items rỗng / thiếu địa chỉ / SĐT sai', async () => {
  const api = mk();
  await assert.rejects(() => api.orders.create({ items: [], address: 'a', phone: '0901234567' }), (e) => e.code === 'VALIDATION');
  await assert.rejects(
    () => api.orders.create({ items: [{ itemId: 'M101' }], address: '', phone: '0901234567' }),
    (e) => e.code === 'VALIDATION' && Boolean(e.extra?.address)
  );
  await assert.rejects(
    () => api.orders.create({ items: [{ itemId: 'M101' }], address: 'ok' }),
    (e) => e.code === 'VALIDATION' && Boolean(e.extra?.phone)
  );
});

test('orders guard: hủy đơn người khác FORBIDDEN — hủy đơn đang giao step≥2 CONFLICT (vá bug legacy)', async () => {
  /* identity khớp: owner hủy được đơn step 0 */
  const store = fresh();
  const owner = createApi({ storage: store, seed: SEED, identity: () => 'U777' });
  const o = await owner.orders.create({ items: [{ itemId: 'M101' }], address: 'A', phone: '0911111111' });
  const stranger = createApi({ storage: store, seed: SEED, identity: () => 'U999' });
  await assert.rejects(() => stranger.orders.cancel(o.id), (e) => e.code === 'FORBIDDEN');
  assert.equal((await owner.orders.cancel(o.id)).status, 'cancelled');

  /* step ≥ 2 (shipper đã lấy): cả owner cũng KHÔNG hủy được */
  const store2 = fresh();
  const own2 = createApi({ storage: store2, seed: SEED, identity: () => 'U001' });
  const o2 = await own2.orders.create({ items: [{ itemId: 'M102' }], address: 'B', phone: '0912222222' });
  await own2.orders.updateStep(o2.id, 2);
  await assert.rejects(() => own2.orders.cancel(o2.id), (e) => e.code === 'CONFLICT');
});

test('orders: cancel bước 0-1 OK + step lùi bị cấm + đơn hủy rồi CONFLICT', async () => {
  const api = mk();
  const o = await api.orders.create({ items: [{ itemId: 'M003' }], address: 'B', phone: '0913333333' });
  await api.orders.updateStep(o.id, 1);
  const c = await api.orders.cancel(o.id);
  assert.equal(c.status, 'cancelled');
  assert.ok(c.cancelledAt);
  await assert.rejects(() => api.orders.updateStep(o.id, 3), (e) => e.code === 'CONFLICT');

  const o2 = await api.orders.create({ items: [{ itemId: 'M004' }], address: 'B', phone: '0913333333' });
  await api.orders.updateStep(o2.id, 2);
  await assert.rejects(() => api.orders.updateStep(o2.id, 1), (e) => e.code === 'VALIDATION'); // lùi bước
});

test('orders.current: setCurrent/getCurrent, id lạ NOT_FOUND, null OK', async () => {
  const api = mk();
  assert.equal(await api.orders.getCurrent(), null);
  const o = await api.orders.create({ items: [{ itemId: 'M101' }], address: 'C', phone: '0914444444' });
  await api.orders.setCurrent(o.id);
  assert.equal((await api.orders.getCurrent()).id, o.id);
  await assert.rejects(() => api.orders.setCurrent('od-nope'), (e) => e.code === 'NOT_FOUND');
  await api.orders.setCurrent(null);
  assert.equal(await api.orders.getCurrent(), null);
});

/* ======================= §3.7/3.8 — P2 = NOT_IMPLEMENTED, chữ ký chốt ======================= */
test('P2/P3 lại còn NOT_IMPLEMENTED đúng hợp đồng (users/auth/bookings/seats đã P2 — test phase2)', async () => {
  const api = mk();
  await assert.rejects(() => api.users.setCurrent(null), (e) => e.code === 'NOT_IMPLEMENTED'); // ngoại lệ đã chốt trong §3.7
  await assert.rejects(() => api.promotions.getActive(), (e) => e.code === 'NOT_IMPLEMENTED');
  await assert.rejects(() => api.stats.today(), (e) => e.code === 'NOT_IMPLEMENTED');
  await assert.rejects(() => api.staff.getAll(), (e) => e.code === 'NOT_IMPLEMENTED');
  assert.equal((await api.users.getAll()).length, 0); // users đã P2, trống vì chưa seedDemo
});

/* ======================= §4 — export/import end-to-end ======================= */
test('exportAll → importAll 1-1 (dump chuẩn prep-backend, §4)', async () => {
  const apiA = mk();
  const o = await apiA.orders.create({ items: [{ itemId: 'M101', qty: 2 }], address: 'D', phone: '0915555555' });
  await apiA.cart.add({ itemId: 'M001', size: 'L' });

  const snap = await apiA.exportAll();
  assert.equal(snap.format, 'cappan-snapshot');
  assert.equal(snap.contract, '1.1');
  assert.ok(snap.data.orders.some((x) => x.id === o.id));

  /* "chuyển máy khác" = memory store riêng — đúng kịch bản RESTORE/backup */
  const apiB = createApi({ storage: fresh(), seed: SEED });
  const n = await apiB.importAll(snap);
  assert.ok(n > 0);
  assert.equal((await apiB.orders.getById(o.id)).total, o.total); // money không drift
  assert.equal((await apiB.cart.get())[0].size, 'L');
  await assert.rejects(() => apiB.importAll({ broken: 1 }), (e) => e.name === 'StorageError');
});
