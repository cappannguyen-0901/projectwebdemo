/* Bộ kiểm thử bộ não nội bộ: node tests/localbrain.test.mjs
   ⚡ Đã fix lỗi đường dẫn trên Windows (Error: ENOENT D:\D:\...) */
import fs from 'fs'; 
import vm from 'vm'; 
import path from 'path';
import { fileURLToPath } from 'url';

// ⚡ SỬA LỖI ĐƯỜNG DẪN: Dùng fileURLToPath để chuẩn hóa trên Windows
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = process.env.SITE || path.resolve(__dirname, '..');
const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
const ctx = { console: { log() {}, warn() {}, error() {} }, sessionStorage: mem(), localStorage: mem(), setTimeout, clearTimeout, Date, JSON, Promise, Math, Object, Array, String, Number, parseInt, RegExp, Set, Map, performance,
  window: {}, document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {} }, dataset: {} } } };
vm.createContext(ctx);
const r = p => fs.readFileSync(path.join(ROOT, 'js', p), 'utf8');
const lb = process.env.LB_FILE ? fs.readFileSync(process.env.LB_FILE, 'utf8') : '';
vm.runInContext(['data/schema.js', 'data/seed.js', 'data/recipes.js', 'data/kb.js', 'data/promotions.js', 'api/index.js', 'auth.js', 'main.js'].map(r).join('\n;\n') + '\n;' + (lb || r('ai/brain-legacy.js')) + ';this.LB=LocalBrain;this.A=API;', ctx);
const { LB, A } = ctx;
A.users.setCurrent(A.users.getAll()[0]);

const names = text => A.menu.getAll().filter(m => text.includes(m.name)).map(m => m.name);
const itemsOf = text => A.menu.getAll().filter(m => text.includes(m.name));
const seatsOf = text => (text.match(/Bàn ([A-D]\d+)/g) || []).map(s => A.seats.getById(s.slice(4)));
const has = (t, ...ws) => ws.every(w => t.includes(w));
const none = (t, ...ws) => ws.every(w => !t.includes(w));
const tagsOf = m => LB._tagsOf(m);

const cases = [
  ['gợi ý cho mình món vị béo ngậy', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => tagsOf(m).includes('beo'))],
  ['trời nóng uống gì cho mát', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => !tagsOf(m).includes('nong'))],
  ['trời mưa uống gì cho ấm', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => tagsOf(m).includes('nong'))],
  ['mình buồn ngủ cần món tỉnh táo', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => tagsOf(m).includes('cafein'))],
  ['không uống được cà phê thì nên uống gì', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => !tagsOf(m).includes('cafe'))],
  ['có món nào ít ngọt không, gợi ý giúp mình', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => !tagsOf(m).includes('ngot'))],
  ['món nào chua chua thanh mát', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => tagsOf(m).includes('chua') || tagsOf(m).includes('thanh'))],
  ['gợi ý món rẻ dưới 40k', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => m.price <= 40000)],
  ['uống gì dưới 45 nghìn mà có trái cây', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => m.price <= 45000 && tagsOf(m).includes('traicay'))],
  ['gợi ý nước cho bé', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => !tagsOf(m).includes('cafein'))],
  ['món nào bán chạy nhất', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => m.badge)],
  ['có món mới nào không', (t) => has(t, 'Cà Phê Muối')],
  ['đang chạy deadline nên uống gì', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => tagsOf(m).includes('tinhtao') || tagsOf(m).includes('cafein'))],
  ['gợi ý trà ngon', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => m.categoryId === 'tea')],
  ['mình thích đồ ngọt béo', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => tagsOf(m).includes('ngot') && tagsOf(m).includes('beo'))],
  ['mình cần món tỉnh táo để học bài, không quá ngọt', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => !tagsOf(m).includes('ngot') && tagsOf(m).includes('cafein'))],
  ['uong gi cho mat', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => !tagsOf(m).includes('nong'))],
  ['goi y mon beo ngay khong ngot lam', (t) => itemsOf(t).length >= 1 && itemsOf(t).every(m => !tagsOf(m).includes('ngot'))],
  ['trà đào cam sả giá bao nhiêu', (t) => has(t, 'Trà Đào Cam Sả', '45.000')],
  ['tra dao gia sao', (t) => has(t, 'Trà Đào Cam Sả')],
  ['cà phê muối có hết chưa', (t) => has(t, 'Cà Phê Muối', 'còn hàng')],
  ['so sánh trà đào cam sả và trà sen vàng', (t) => has(t, 'Trà Đào Cam Sả', 'Trà Sen Vàng')],
  ['macha giá bao nhiêu', (t) => has(t, 'Matcha')],
  ['món nào rẻ nhất', (t) => has(t, 'Bánh Flan') || itemsOf(t)[0]?.price <= 35000],
  ['món đắt nhất là gì', (t) => has(t, 'Matcha', '58.000')],
  ['cà phê giá bao nhiêu', (t) => has(t, 'từ', 'đến')],
  ['còn chỗ yên tĩnh để học không', (t) => seatsOf(t).length >= 1 && seatsOf(t).every(s => s.zone === 'quiet')],
  ['cần chỗ cho 6 người họp nhóm', (t) => seatsOf(t).length >= 1 && seatsOf(t).every(s => s.capacity >= 6)],
  ['chỗ ngồi 2 người có view đẹp', (t) => seatsOf(t).length >= 1 && seatsOf(t).every(s => s.capacity >= 2 && s.zone === 'window')],
  ['muốn ngồi ngoài trời', (t) => seatsOf(t).length >= 1 && seatsOf(t).every(s => s.floorId === 'F4')],
  ['có ổ cắm không', (t) => has(t, 'ổ cắm')],
  ['cần phòng có máy chiếu để thuyết trình', (t) => seatsOf(t).length >= 1 && seatsOf(t).every(s => /máy chiếu/.test(s.description))],
  ['nhóm 12 người đặt chỗ được không', (t) => has(t, 'hotline')],
  ['còn chỗ không', (t) => has(t, 'chỗ trống')],
  ['mình bị dị ứng sữa uống được món nào', (t) => has(t, 'nhân viên') && none(t, 'Bạc Xỉu', 'Latte')],
  ['mình bị tiểu đường nên uống gì', (t) => has(t, 'nhân viên')],
  ['không-xử-lý', null],
];
const nullCases = [
  'công thức bạc xỉu', 'cách làm cà phê muối', 'hôm nay doanh thu bao nhiêu', 'danh sách nhân viên',
  'cách đặt chỗ như thế nào', 'wifi là gì', 'mấy giờ quán mở cửa', 'xin chào', 'cảm ơn bạn',
  'chỗ ở đâu vậy',
  'có chỗ đậu xe không', 'mình quên mật khẩu', 'tư vấn giúp mình với', 'mật khẩu là gì', 'mình mất ngủ cả đêm',
  'quán có bán đồ ăn không', 'mười người ngồi được không', 'chủ quán là ai', 'tôi muốn đặt bàn', 'có wifi không'
];

let pass = 0, fail = 0; const failures = [];
for (const [q, check] of cases) {
  if (!check) continue;
  LB.reset();
  const res = LB.answer(q);
  const ok = !!(res && res.confidence >= LB.MIN_CONF && check(res.text));
  if (ok) pass++; else { fail++; failures.push({ q, res }); }
}
for (const q of nullCases) {
  LB.reset();
  const res = LB.answer(q);
  const ok = !res || res.confidence < LB.MIN_CONF;
  if (ok) pass++; else { fail++; failures.push({ q: q + '  (phải để cho nơi khác xử lý)', res }); }
}

// ----- nối tiếp -----
{
  LB.reset();
  const a = LB.answer('gợi ý cho mình món vị béo ngậy');
  const firstMin = Math.min(...itemsOf(a.text).map(m => m.price));
  const b = LB.answer('còn món nào rẻ hơn không');
  const okB = b && (itemsOf(b.text).every(m => m.price < firstMin) || /chưa có món nào rẻ hơn/.test(b.text));
  okB ? pass++ : (fail++, failures.push({ q: 'nối tiếp: rẻ hơn', res: b }));
  const c = LB.answer('món khác đi');
  const okC = c && itemsOf(c.text).every(m => !itemsOf(a.text).map(x => x.name).includes(m.name));
  okC ? pass++ : (fail++, failures.push({ q: 'nối tiếp: món khác', res: c }));
}
{
  LB.reset();
  const a = LB.answer('còn chỗ yên tĩnh để học không');
  const b = LB.answer('chỗ khác đi');
  const okB = b && seatsOf(b.text).length >= 1 && seatsOf(b.text).every(s => !seatsOf(a.text).map(x => x.id).includes(s.id));
  okB ? pass++ : (fail++, failures.push({ q: 'nối tiếp: chỗ khác', res: b }));
}
// ----- không nói sai khi hết phòng có máy chiếu -----
{
  LB.reset();
  const a = LB.answer('cần phòng có máy chiếu để thuyết trình');
  const b = LB.answer('chỗ khác đi');
  const claimsProjector = /phù hợp[^\n]*máy chiếu/.test(b.text);
  const allHave = seatsOf(b.text).every(s => /máy chiếu/.test(s.description));
  (!claimsProjector || allHave) ? pass++ : (fail++, failures.push({ q: 'không được ghi "có máy chiếu" cho bàn không có', res: b }));
}
// ----- hết hàng không được gợi ý -----
{
  LB.reset(); A.menu.markOutOfStock('M006');
  const res = LB.answer('gợi ý cho mình món vị béo ngậy');
  const ok = res && !res.text.includes('Cà Phê Muối');
  ok ? pass++ : (fail++, failures.push({ q: 'món hết hàng không được gợi ý', res }));
  A.menu.markInStock('M006');
}
// ----- không lộ công thức -----
{
  LB.reset();
  const all = ['gợi ý món béo', 'cà phê muối là gì', 'so sánh bạc xỉu và latte', 'bạc xỉu giá bao nhiêu'].map(q => (LB.answer(q) || {}).text || '').join('\n');
  const leak = /(\d+\s?g\b|\d+\s?ml|shot|cốt|syrup|chiết xuất|kem béo thực vật)/i.test(all);
  !leak ? pass++ : (fail++, failures.push({ q: 'không được lộ công thức/định lượng', res: { text: all } }));
}

/* ⚡ FIX W1: test hồi quy tên món — không được trả lời sai về ổ cắm */
{
  LB.reset();
  const res = LB.answer('trà đào cam sả');
  const wrong = res && res.confidence >= LB.MIN_CONF && /ổ cắm/i.test(res.text);
  !wrong ? pass++ : (fail++, failures.push({
    q: 'W1: trà đào cam sả không được trả lời về ổ cắm',
    res
  }));
}

/* ⚡ FIX W1: test hồi quy tên món — nếu KBFast/LocalBrain trả lời thì phải đúng món */
{
  const menuNames = A.menu.getAll().map(m => m.name);
  let wrongNames = [];
  for (const name of menuNames) {
    LB.reset();
    const res = LB.answer(name);
    if (res && res.confidence >= LB.MIN_CONF) {
      const lower = name.toLowerCase();
      const text = res.text.toLowerCase();
      // Cho phép câu trả lời không nhắc lại tên món nếu intent là extreme/stock (món rẻ nhất etc)
      const okIntent = ['extreme', 'stock'].includes(res.intent);
      if (!text.includes(lower) && !okIntent) {
        wrongNames.push({ name, got: res.text.slice(0, 80) });
      }
    }
  }
  wrongNames.length === 0
    ? pass++
    : (fail++, failures.push({
        q: `W1: ${wrongNames.length} tên món bị trả lời lệch`,
        res: { text: JSON.stringify(wrongNames.slice(0, 3)) }
      }));
}

console.log(`\nKẾT QUẢ: ${pass}/${pass + fail} đạt` + (fail ? `  (${fail} không đạt)` : '  ✅'));
failures.forEach(f => console.log(`\n✗ "${f.q}"\n   → ${f.res ? `[${f.res.intent} · ${f.res.confidence}] ` + f.res.text.replace(/\n/g, ' ⏎ ').slice(0, 230) : '(null)'}`));
process.exitCode = fail ? 1 : 0;