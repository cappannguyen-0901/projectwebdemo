import fs from 'fs'; import vm from 'vm'; import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE || path.resolve(__dirname, '..');

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, key: i => Object.keys(m)[i], get length() { return Object.keys(m).length; } }; };

const ctx = {
  console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
  fetch: () => Promise.reject(new Error('offline')),
  sessionStorage: mem(), localStorage: mem(),
  setTimeout, clearTimeout, setInterval, clearInterval,
  Date, JSON, Promise, Math, Object, Array, String, Number,
  parseInt, parseFloat, RegExp, Set, Map, performance,
  window: { addEventListener(){}, removeEventListener(){}, location: { href: '', replace(){} }, matchMedia() { return { matches: false, addEventListener(){} }; }, dispatchEvent(){ return true; } },
  document: { getElementById: () => null, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add(){}, remove(){} }, dataset: {} } }
};
vm.createContext(ctx);

const r = p => fs.readFileSync(path.join(ROOT, 'js', p), 'utf8');
vm.runInContext(
  ['data/schema.js', 'data/seed.js', 'data/recipes.js', 'data/kb.js', 'data/promotions.js',
   'api/index.js', 'auth.js', 'ai/ai-input.js', 'ai/ai-output.js', 'ai/item-lookup.js',
   'ai/brain-legacy.js', 'ai/brain.js', 'ai/multi-intent-splitter.js', 'ai/intent-authorization.js']
    .map(r).join('\n;\n') + ';this.Splitter=MultiIntentSplitter;this.Auth=IntentAuthorization;this.API=API;this.AIBrain=AIBrain;', ctx);

const { Splitter, Auth, API, AIBrain } = ctx;
let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, extra='') => { if (cond) pass++; else { fail++; fails.push(`${name}${extra ? ' → ' + extra : ''}`); } };

const customer = API.users.getAll().find(u => u.role === 'customer') || { id: 'U001', role: 'customer' };
const staff = API.users.getAll().find(u => u.role === 'staff') || { id: 'U002', role: 'staff' };
API.users.setCurrent(customer);

/* Test 1: câu multi-intent 3 ý → split thành ≥ 2 sub-intent */
{
  const r = await Splitter.split('Đặt bàn 4 người 7h tối nay và gợi ý 2 món ít ngọt, quán có gửi xe không?', 'customer');
  ok('T1: split câu 3 ý', r.isMultiIntent && r.subInputs.length >= 2, JSON.stringify(r));
}

/* Test 2: câu so sánh A và B KHÔNG được split */
{
  const r = await Splitter.split('So sánh trà đào cam sả và trà sen vàng', 'customer');
  ok('T2: không split câu so sánh', !r.isMultiIntent, JSON.stringify(r));
}

/* Test 3: câu đơn không split */
{
  const r = await Splitter.split('Giờ mở cửa thế nào', 'customer');
  ok('T3: câu đơn không split', !r.isMultiIntent && r.subInputs.length === 1);
}

/* Test 4: IntentAuthorization — customer hỏi doanh thu → blocked */
{
  const r = Auth.check('doanh thu hôm nay bao nhiêu', 'customer');
  ok('T4: customer không được xem doanh thu', r.allowed === false && r.requiredTool === 'get_revenue_stats');
}

/* Test 5: IntentAuthorization — staff hỏi doanh thu → allowed */
{
  const r = Auth.check('doanh thu hôm nay bao nhiêu', 'staff');
  ok('T5: staff được xem doanh thu', r.allowed === true);
}

/* Test 6: IntentAuthorization — customer hỏi menu → allowed */
{
  const r = Auth.check('menu có gì', 'customer');
  ok('T6: customer được xem menu', r.allowed === true);
}

/* Test 7: IntentAuthorization — customer hỏi công thức → blocked */
{
  const r = Auth.check('công thức cà phê muối', 'customer');
  ok('T7: customer không được xem công thức', r.allowed === false && r.requiredTool === 'get_recipe');
}

/* Test 8: end-to-end — partial refusal */
{
  API.users.setCurrent(customer);
  const res = await AIBrain._handleMultiIntent(['So sánh trà đào và trà sen', 'doanh thu hôm nay'], 'customer', 'test_sid', null);
  const msg = res.message || '';
  const hasCompare = /trà|so sánh/i.test(msg);
  const hasRefusal = /không có quyền|không được cấp quyền/i.test(msg);
  ok('T8: partial refusal — vừa trả lời vừa từ chối', hasCompare && hasRefusal, msg.slice(0, 200));
}

/* Test 9: end-to-end — multi-intent 3 ý đủ cả 3 */
{
  API.users.setCurrent(customer);
  const split = await Splitter.split('Đặt bàn 4 người 7h tối và gợi ý 2 món ít ngọt, quán có gửi xe không', 'customer');
  if (split.isMultiIntent) {
    const res = await AIBrain._handleMultiIntent(split.subInputs, 'customer', 'test_sid_2', null);
    const msg = res.message || '';
    ok('T9: 3 sub-intent đều có phản hồi', msg.length > 50, msg.slice(0, 200));
  } else {
    ok('T9: skip (splitter không nhận diện)', false, JSON.stringify(split));
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`RESULT: ${pass} PASS / ${fail} FAIL`);
if (fails.length) { console.log('\n❌ FAILED:'); fails.forEach(f => console.log('  • ' + f)); process.exit(1); }
console.log('✅ All multi-intent tests passed');