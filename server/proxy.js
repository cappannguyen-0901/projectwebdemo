/* ============================================================
   CAPPAN AI PROXY v2 — khớp với brain.js dạng "slot" (Groq + Gemini)
   Node.js >= 18, KHÔNG cần cài thư viện.

   Chạy:   copy .env.example .env  (điền key)   →   node proxy.js
   Trong brain.js:   const AI_PROXY_URL = 'http://localhost:8787/api/chat';
   Trình duyệt gửi:  { provider: 'groq'|'gemini', keyIndex: 0.., ...payload }
   Server chọn key theo provider + keyIndex (key không bao giờ rời server).
============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

(function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
})();

const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

const PORT = parseInt(process.env.PORT, 10) || 8787;
const PROVIDERS = {
  groq: {
    keys: list(process.env.GROQ_KEYS),
    url: process.env.UPSTREAM_GROQ || 'https://api.groq.com/openai/v1/chat/completions'
  },
  gemini: {
    keys: list(process.env.GEMINI_KEYS),
    url: process.env.UPSTREAM_GEMINI || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
  }
};
/* ALLOWED_MODELS: để trống = chấp nhận mọi model hợp lệ của provider (đổi tên model trong brain.js không cần sửa proxy).
   Muốn siết chặt: ALLOWED_MODELS=openai/gpt-oss-20b,gemini-2.5-flash,... */
const MODELS = list(process.env.ALLOWED_MODELS);
const modelOk = (providerId, m) =>
  typeof m === 'string' && /^[\w.\/:\-]{2,80}$/.test(m) &&
  (MODELS.length ? MODELS.includes(m) : (providerId !== 'gemini' || m.startsWith('gemini')));

/* ALLOWED_ORIGINS:
   - "auto" (mặc định): cho phép mọi cổng của localhost / 127.0.0.1 và trang mở bằng file:// (Origin: null)
   - "*"               : cho phép tất cả (chỉ để thử)
   - danh sách         : https://ten-mien-cua-ban.com,http://localhost:5500 */
const ORIGIN_CFG = list(process.env.ALLOWED_ORIGINS || 'auto');
function originAllowed(origin) {
  if (!origin) return process.env.REQUIRE_ORIGIN !== '1';     // curl/server không có Origin; đặt REQUIRE_ORIGIN=1 trong .env để chặn khi đưa lên mạng
  if (ORIGIN_CFG.includes('*')) return true;
  if (ORIGIN_CFG.includes('auto') &&
      (origin === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin))) return true;
  return ORIGIN_CFG.includes(origin);
}

const MAX_BODY = (parseInt(process.env.MAX_BODY_KB, 10) || 256) * 1024;
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS, 10) || 1500;
const RATE_PER_MIN = parseInt(process.env.RATE_PER_MIN, 10) || 60;
/* ACCESS_TOKEN chỉ hữu ích khi gọi từ server khác; brain.js (chạy ở trình duyệt) không gửi token, nên để trống khi dùng với web này */
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const FIELDS = ['model', 'messages', 'tools', 'tool_choice', 'temperature', 'max_tokens',
                'stream', 'reasoning_effort', 'parallel_tool_calls'];

const total = Object.values(PROVIDERS).reduce((s, p) => s + p.keys.length, 0);
if (!total) { console.error('❌ Chưa có key nào. Điền GROQ_KEYS và/hoặc GEMINI_KEYS trong server/.env'); process.exit(1); }

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000); arr.push(now); hits.set(ip, arr);
  return arr.length > RATE_PER_MIN;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Access-Token');
  res.setHeader('Access-Control-Max-Age', '600');
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('big'), { code: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const route = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && (route === '/health' || route === '/')) {
    return send(res, 200, {
      ok: true,
      providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.keys.length])),   // chỉ số lượng, không lộ key
      note: 'Trong brain.js: proxyKeyCount của mỗi provider không được lớn hơn số key ở đây'
    });
  }
  if (req.method !== 'POST' || !['/api/chat', '/chat', '/'].includes(route)) return send(res, 404, { error: 'Sai đường dẫn. Dùng POST /api/chat' });

  if (!originAllowed(req.headers.origin)) {
    console.warn(`🚫 Origin bị chặn: ${req.headers.origin}  → thêm vào ALLOWED_ORIGINS trong .env rồi khởi động lại proxy`);
    return send(res, 403, { error: `Origin ${req.headers.origin} chưa được phép (ALLOWED_ORIGINS)` });
  }
  if (ACCESS_TOKEN && req.headers['x-access-token'] !== ACCESS_TOKEN) return send(res, 401, { error: 'Sai access token' });
  if (limited(req.socket.remoteAddress || 'x')) { res.setHeader('Retry-After', '20'); return send(res, 429, { error: 'Quá nhiều yêu cầu, thử lại sau' }); }

  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'Body quá lớn' : 'JSON không hợp lệ' }); }

  const providerId = String(body.provider || 'groq');
  const provider = PROVIDERS[providerId];
  if (!provider) return send(res, 400, { error: `Provider "${providerId}" không tồn tại` });
  const keyIndex = Number.isInteger(body.keyIndex) ? body.keyIndex : 0;
  const key = provider.keys[keyIndex];
  if (!key) return send(res, 400, { error: `Proxy chỉ có ${provider.keys.length} key cho ${providerId}, nhưng brain.js yêu cầu key số ${keyIndex}. Hãy chỉnh proxyKeyCount trong brain.js hoặc thêm key vào .env` });
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 80) return send(res, 400, { error: 'messages không hợp lệ' });
  if (!modelOk(providerId, body.model)) return send(res, 400, { error: `Model "${body.model}" không hợp lệ cho ${providerId}` + (MODELS.length ? ' (không nằm trong ALLOWED_MODELS)' : '') });

  const payload = {};
  FIELDS.forEach(f => { if (body[f] !== undefined) payload[f] = body[f]; });
  payload.max_tokens = Math.min(parseInt(payload.max_tokens, 10) || MAX_TOKENS, MAX_TOKENS);

  try {
    const up = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, Accept: 'text/event-stream' },
      body: JSON.stringify(payload)
    });
    const h = { 'Content-Type': up.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-cache' };
    if (up.headers.get('retry-after')) h['Retry-After'] = up.headers.get('retry-after');
    res.writeHead(up.status, h);                                // giữ nguyên 429/400... để brain.js tự xử lý cooldown
    if (!up.body) return res.end();
    const stream = Readable.fromWeb(up.body);
    req.on('close', () => stream.destroy());
    stream.on('error', () => res.end());
    stream.pipe(res);
  } catch (e) {
    console.error(`Upstream ${providerId} lỗi:`, e.message);
    send(res, 502, { error: `Proxy không kết nối được tới ${providerId}: ${e.message}` });
  }
});

server.listen(PORT, () => {
  const info = Object.entries(PROVIDERS).map(([k, p]) => `${k}: ${p.keys.length} key`).join(' · ');
  console.log(`✅ CAPPAN AI proxy: http://localhost:${PORT}/api/chat   (${info})`);
  console.log(`   Kiểm tra nhanh: mở http://localhost:${PORT}/health trên trình duyệt`);
});