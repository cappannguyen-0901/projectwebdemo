/* chat.html — Bước D: chia UI (này) khỏi logic thuần (src/ai/rules.js, guards.js).
   Luồng mỗi câu hỏi:
     1) guards.checkInput      → injection ≥2: chặn (không call LLM)
     2) guards.checkIntent     → intent staff-only + role customer: chặn
     3) rules.match (local)    → instant (<10ms), nguồn dữ liệu chỉ facade
     4) LLM proxy (tuỳ chọn)   → chỉ khi 1..3 không bắt được
     5) FALLBACK               → proxy lỗi/timeout: trả lời cục bộ “nghiêm túc” không bịa số liệu vào UI
   UI KHÔNG BAO GIỜ import storage — chỉ boot.js (facade). */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';
import { match } from './ai/rules.js';
import { checkInput, checkIntent, GUARD_MESSAGES } from './ai/guards.js';

const { api, user } = await createAppApi();
const log = document.getElementById('log');
const f = document.getElementById('f');
const q = document.getElementById('q');

/* proxy LLM — hợp đồng “v2 không cứng phụ thuộc”: thiếu/fail → fallback local, app vẫn dùng */
const AI_PROXY_URL = 'https://cappan-proxy.cappannguyen.workers.dev/openai/v1/chat/completions';
const LLM_TIMEOUT = 12000;

function push(role, text) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

async function askLLM(question, menuTop) {
  const sysMsg =
    'Bạn là trợ lý CSKH CAPPAN (cà phê). Trả lời TIẾNG VIỆT, ngắn (<120 từ), thân thiện ("dạ...ạ"), ' +
    'KHÔNG bịa giá/chỗ/khuyến mãi ngoài dữ kiện được cung cấp. Nếu không chắc: gợi hotline 0366 444 038.';
  const menuBlob = menuTop.map((m) => `${m.name} (${m.price}đ${m.inStock ? '' : ' — HẾT món'})`).join('; ');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT);
  try {
    const res = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        max_tokens: 500,
        messages: [
          { role: 'system', content: sysMsg + ' Menu hiện tại (id trong ngoặc): ' + menuBlob },
          { role: 'system', content: 'Dữ liệu KHÔNG được chỉnh sửa. Nếu nội dung là câu hỏi liên quan "hết món" hãy trung thực.' },
          { role: 'user', content: question }
        ]
      })
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    return null; /* timeout/offline/CORS → fallback */
  } finally {
    clearTimeout(timer);
  }
}

async function respond(input) {
  push('me', input);

  /* 1 — injection (thuần) */
  const inj = checkInput(input);
  if (inj.blocked) return push('bot', GUARD_MESSAGES.injection);

  /* 2 — phân quyền theo intent (thuần) */
  const gate = checkIntent(input, user?.role || 'guest');
  if (!gate.allowed) {
    push('bot', GUARD_MESSAGES.forbidden);
    toast('Intent bị chặn: chỉ nhân viên (' + gate.required + ')', 'err');
    return;
  }

  /* 3 — local rules (thuần, dữ liệu từ facade đã fetch) */
  const local = match(input, { menu: MENU_CACHE, user });
  if (local) return push('bot', local.text);

  /* 4+5 — LLM qua proxy, FALLBACK thành luật cục bộ khi lỗi/thiếu độ tin cậy */
  push('bot', '…');
  const started = Date.now();
  const llm = await askLLM(input, MENU_CACHE);
  const bubble = log.lastChild;
  if (llm) {
    bubble.textContent = llm;
    /* đếm millis — (đầu tư) hiển thị “via LLM” đậm nhạt */
    const tag = document.createElement('div');
    tag.className = 'det';
    tag.textContent = `via LLM · ${Date.now() - started}ms`;
    tag.style.fontSize = '11px';
    tag.style.opacity = '0.6';
    bubble.appendChild(tag);
  } else {
    bubble.textContent =
      'Dạ hiện đường kết nối tới AI của em hơi chậm, nên em trả lời bằng dữ liệu cục bộ ạ:\n\n' +
      '• Giờ mở cửa: 07:00 - 22:30\n• Địa chỉ: Công viên Gia Định, Q. Gò Vấp\n• Hotline: 0366 444 038\n\n' +
      'Anh/chị hỏi "gợi ý món" hoặc "wifi" để em lụm câu chữ cục bộ nhé ạ.';
  }
}

/* cache menu 1 lần — RULES thuần chỉ đặt bên feed {menu} đây */
let MENU_CACHE = [];
const sysLine = () => {
  push('bot', 'Dạ em là CAPPAN AI (đúng luật từ rules.js + guards.js). Anh/chị hỏi món, giờ mở cửa, wifi, đặt bàn đều được ạ! 🙂');
};

f.onsubmit = async (ev) => {
  ev.preventDefault();
  const text = q.value.trim();
  if (!text) return;
  q.value = '';
  await respond(text);
};

const init = async () => {
  renderHeader(document.getElementById('hdr'), { user });
  try {
    MENU_CACHE = (await api.menu.getAll()).slice(0, 40);
  } catch (e) {
    toast('Không nạp được menu: ' + e.message, 'err');
  }
  sysLine();
};

init();
