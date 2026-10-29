/* ============================================================
   CAPPAN v2 — TẦNG STORAGE (docs/api-contract.md §5)

   Khối duy nhất chạm hạ tầng lưu trữ. Toàn bộ method ASYNC:
   hôm nay chạy trên localStorage, mai chỉ cần driver HTTP —
   chữ ký `get/set/remove/...` giữ nguyên.

   Khác legacy (js/api/index.js:13-21 nuốt QuotaExceededError):
   lỗi ở đây THẢ RA là StorageError — không bao giờ mất dữ liệu âm thầm.
   ============================================================ */
import { StorageError } from './errors.js';

export const DEFAULT_NAMESPACE = 'cappan:v2:';

/* ---------- Driver: browser localStorage (chỉ dùng trong trình duyệt) ---------- */
export function browserDriver() {
  const ls = window.localStorage;
  return {
    async get(key) {
      return ls.getItem(key);
    },
    async set(key, value) {
      ls.setItem(key, value); // QuotaExceededError nảy lên đây → gói thành StorageError ở Storage.set
    },
    async delete(key) {
      ls.removeItem(key);
    },
    async keys() {
      return Object.keys(ls);
    }
  };
}

/* ---------- Driver: in-memory (dùng cho unit test / SSR demo) ---------- */
export function memoryDriver() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
    async keys() {
      return [...map.keys()];
    }
  };
}

export class Storage {
  #driver;
  #ns;

  constructor(driver, { namespace = DEFAULT_NAMESPACE } = {}) {
    if (!driver || typeof driver.get !== 'function') throw new StorageError('Driver không hợp lệ');
    this.#driver = driver;
    this.#ns = namespace;
  }

  #k(key) {
    return this.#ns + key;
  }

  #bare(rawKey) {
    return rawKey.startsWith(this.#ns) ? rawKey.slice(this.#ns.length) : null;
  }

  async get(key, fallback = null) {
    const raw = await this.#driver.get(this.#k(key));
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback; // dữ liệu hỏng coi như không có — reader không nổ vì một key rác
    }
  }

  async set(key, value) {
    let raw;
    try {
      raw = JSON.stringify(value);
    } catch (e) {
      throw new StorageError(`Không serialize được key "${key}": ${e.message}`, e);
    }
    try {
      await this.#driver.set(this.#k(key), raw);
    } catch (e) {
      // VD: QuotaExceededError — legacy nuốt lỗi này và im lặng mất đơn; v2 dội lên.
      throw new StorageError(`Ghi "${key}" thất bại (driver lỗi): ${e.message}`, e);
    }
    return value;
  }

  async remove(key) {
    await this.#driver.delete(this.#k(key));
  }

  async keys(prefix = '') {
    const out = [];
    for (const raw of await this.#driver.keys()) {
      const bare = this.#bare(raw);
      if (bare !== null && bare.startsWith(prefix)) out.push(bare);
    }
    return out.sort();
  }

  async clear(prefix = '') {
    for (const k of await this.keys(prefix)) await this.remove(k);
  }

  /* ---------- Snapshot (docs/api-contract.md §4) — "dump chuẩn" prep-backend ---------- */
  async exportAll() {
    const data = {};
    for (const k of await this.keys()) data[k] = await this.get(k);
    return {
      format: 'cappan-snapshot',
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  async importAll(snapshot, { replace = true } = {}) {
    if (!snapshot || snapshot.format !== 'cappan-snapshot' || typeof snapshot.data !== 'object') {
      throw new StorageError('Snapshot sai format cappan-snapshot (docs/api-contract.md §4)');
    }
    if (replace) await this.clear();
    let count = 0;
    for (const [k, v] of Object.entries(snapshot.data)) {
      if (typeof k !== 'string') continue;
      await this.set(k, v);
      count += 1;
    }
    return count;
  }
}

export function createStorage(kind = 'browser', opts = undefined) {
  const driver = kind === 'memory' ? memoryDriver() : browserDriver();
  return new Storage(driver, opts);
}
