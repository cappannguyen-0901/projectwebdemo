/* Hợp đồng §1.3 — Storage: driver-agnostic, không nuốt lỗi, snapshot format chuẩn */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Storage, memoryDriver, DEFAULT_NAMESPACE } from '../src/core/storage.js';
import { StorageError } from '../src/core/errors.js';

const mk = async () => {
  const s = new Storage(memoryDriver());
  return s;
};

test('set/get roundtrip + fallback cho key lạ', async () => {
  const s = await mk();
  await s.set('menu', [{ id: 'M001' }]);
  assert.deepEqual(await s.get('menu'), [{ id: 'M001' }]);
  assert.equal(await s.get('missing', 'FALLBACK'), 'FALLBACK');
  assert.equal(await s.get('missing'), null);
});

test('keys() trả key trần (không kèm namespace) + prefix lọc', async () => {
  const s = await mk();
  await s.set('cart:guest', [1]);
  await s.set('cart:U001', [2]);
  await s.set('menu', []);
  assert.deepEqual(await s.keys('cart:'), ['cart:U001', 'cart:guest']);
  assert.ok((await s.keys()).every((k) => !k.startsWith(DEFAULT_NAMESPACE)));
});

test('clear(prefix) chỉ xóa đúng dải — không đụng key khác', async () => {
  const s = await mk();
  await s.set('cart:guest', [1]);
  await s.set('menu', [{ id: 'M001' }]);
  await s.clear('cart:');
  assert.deepEqual(await s.get('menu'), [{ id: 'M001' }]);
  assert.deepEqual(await s.get('cart:guest'), null);
});

test('driver lỗi ( quota ) THẢ StorageError — không nuốt như legacy', async () => {
  const boom = {
    async get() {
      return null;
    },
    async set() {
      throw new Error('QuotaExceededError');
    },
    async delete() {},
    async keys() {
      return [];
    }
  };
  const s = new Storage(boom);
  await assert.rejects(
    () => s.set('orders', []),
    (e) => e instanceof StorageError && /Quota/.test(e.message)
  );
});

test('exportAll → format cappan-snapshot v1; importAll replace + merge', async () => {
  const a = await mk();
  await a.set('menu', [{ id: 'M001', price: 35000 }]);
  await a.set('cart:guest', [{ itemId: 'M001', qty: 2 }]);
  const snap = await a.exportAll();

  assert.equal(snap.format, 'cappan-snapshot');
  assert.equal(snap.version, 1);
  assert.ok(snap.exportedAt);
  assert.equal(snap.data.menu[0].id, 'M001');

  const b = await mk();
  await b.set('menu', [{ id: 'OLD' }]); // sẽ bị thay vì replace=true
  await b.set('orders', [{ id: 'od-x' }]);
  assert.equal(await b.importAll(snap), 2);
  assert.equal((await b.get('menu'))[0].id, 'M001');
  assert.equal(await b.get('orders'), null);

  const c = await mk();
  await c.set('menu', [{ id: 'OLD' }]); // merge: giữ key có sẵn
  await c.importAll(snap, { replace: false });
  assert.equal((await c.get('menu'))[0].id, 'M001'); // snapshot mới thắng nếu key chỉ có ở snapshot
});

test('snapshot crash-guard: import sai format phải ném ra và không phá dữ liệu', async () => {
  const s = await mk();
  await s.set('menu', [{ id: 'M001' }]);
  await assert.rejects(() => s.importAll({ garbage: true }), StorageError);
  assert.equal((await s.get('menu'))[0].id, 'M001'); // nguyên vẹn
});
