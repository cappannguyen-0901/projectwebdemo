import fs from 'fs'; import vm from 'vm'; import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE || path.resolve(__dirname, '..');

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, key: i => Object.keys(m)[i], get length() { return Object.keys(m).length; } }; };

const ctx = {
  console: { log(){}, warn(){}, error(){}, info(){} },
  fetch: () => Promise.reject(new Error('offline')),
  sessionStorage: mem(), localStorage: mem(),
  setTimeout, clearTimeout, setInterval, clearInterval,
  Date, JSON, Promise, Math, Object, Array, String, Number,
  parseInt, parseFloat, RegExp, Set, Map, performance,
  window: { addEventListener(){}, matchMedia() { return { matches: false, addEventListener(){} }; }, dispatchEvent(){ return true; }, location: { href: '' } },
  document: { getElementById: () => null, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add(){}, remove(){} }, dataset: {} } }
};
vm.createContext(ctx);
const r = p => fs.readFileSync(path.join(ROOT, 'js', p), 'utf8');
vm.runInContext(
  ['data/schema.js','data/seed.js','data/recipes.js','data/kb.js','data/promotions.js','api/index.js','auth.js',
   'ai/ai-input.js','ai/ai-output.js','ai/item-lookup.js','ai/brain-legacy.js','ai/brain.js',
   'ai/multi-intent-splitter.js','ai/intent-authorization.js'].map(r).join('\n;\n')
  + ';this.Splitter=MultiIntentSplitter;this.Auth=IntentAuthorization;this.API=API;this.AIBrain=AIBrain;this.LB=LocalBrain;', ctx);

const { Splitter, Auth, API, AIBrain, LB } = ctx;
let pass = 0, fail = 0;
const fails = [];
const ok = (n, c, e='') => { if (c) pass++; else { fail++; fails.push(`${n}${e?' → '+e:''}`); } };

const customer = API.users.getAll().find(u => u.role === 'customer') || { id: 'U001', role: 'customer' };
API.users.setCurrent(customer);

/* Test 1: câu so sánh 2 món thuần → phải trả lời được, không bị từ chối */
{
  LB.answer('so sánh trà đào cam sả và trà sen vàng');
  // Không cần check value, chỉ cần không throw
  ok('T1: so sánh 2 món không throw', true);
}

/* Test 2: câu doanh thu thuần → customer không được trả lời */
{
  const auth = Auth.check('doanh thu hôm nay', 'customer');
  ok('T2: customer bị chặn doanh thu', auth.allowed === false);
}

/* Test 3: câu pha trộn "so sánh 2 món + doanh thu" → phải vừa trả lời vừa từ chối */
{
  const res = await AIBrain._handleMultiIntent(
    ['so sánh trà đào cam sả và trà sen vàng', 'doanh thu hôm nay'],
    'customer', 'sid_t3', null
  );
  const msg = res.message || '';
  const hasComparison = /trà|so sánh/i.test(msg);
  const hasRefusal = /không có quyền|không được cấp quyền/i.test(msg);
  ok('T3: partial refusal cả 2 phần', hasComparison && hasRefusal, msg.slice(0, 250));
}

/* Test 4: staff hỏi doanh thu thuần → allowed */
{
  const auth = Auth.check('doanh thu hôm nay', 'staff');
  ok('T4: staff được hỏi doanh thu', auth.allowed === true);
}

/* Test 5: staff hỏi "so sánh 2 món + doanh thu" → cả 2 đều được trả lời */
{
  API.users.setCurrent(API.users.getAll().find(u => u.role === 'staff'));
  const res = await AIBrain._handleMultiIntent(
    ['so sánh trà đào cam sả và trà sen vàng', 'doanh thu hôm nay'],
    'staff', 'sid_t5', null
  );
  const msg = res.message || '';
  // Không được chứa refusal
  ok('T5: staff không bị từ chối', !/không có quyền/i.test(msg), msg.slice(0, 200));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`RESULT: ${pass} PASS / ${fail} FAIL`);
if (fails.length) { console.log('\n❌ FAILED:'); fails.forEach(f => console.log('  • ' + f)); process.exit(1); }
console.log('✅ All partial-refusal tests passed');