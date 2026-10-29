/* ============================================================
   CAPPAN v2 — AI GUARDS (thuần, không DOM)
   1) checkInput: chặn prompt-injection theo ngưỡng legacy
      (Cách C: ≥2 pattern → block, 1 → warn)
   2) checkIntent: ánh intent nhạy cảm (doanh thu/nhân viên/công thức/
      lịch ca/tìm khách) →'BAT chỉ role 'staff' được đi tiếp.
   Trả shape thống nhất — callers (chat UI) quyết định hiển thị.
   ============================================================ */

const INJECTION_PATTERNS = [
  /\b(ignore|ign0re|disregard|forget)\s+(all\s+)?(previous|prev1ous|above|earlier)\s+(instructions?|directives?|prompts?|rules?)/i,
  /\b(system\s*prompt|jailbreak|you\s+are\s+now|pretend\s+you|act\s+as\s+if|roleplay\s+as)\b/i,
  /\b(reveal|show|print|leak|dump)\s+(your\s+)?(system|initial|original)\s+(prompt|instructions?)/i,
  /\b(DAN\s+mode|developer\s+mode|admin\s+mode|god\s+mode)\b/i,
  /\b(bo\s+qua|quen)\s+(moi|tat\s+ca|nhung)\s+(huong\s+dan|chi\s+dan|lenh|quy\s+tac)/i, /* norm đã bỏ dấu */
  /\b(gia\s+vo|dong\s+vai)\s+(nhu|la)\b/i,
  /1gn[o0]r[e3]\s+[a@]ll/i,
  /pr[e3]v[i1][o0]us\s+[i1]nstruct/i,
  /syst[e3]m\s+pr[o0]mpt/i
];

const THRESHOLD_BLOCK = 2;
const THRESHOLD_WARN = 1;

/* intent nhạy cảm — CHỈ role 'staff' được đi tiếp (ánh xạ từ legacy intent-authorization.js) */
const STAFF_INTENTS = [
  { re: /\b(doanh thu|doanh so|doanh thu|kpi|thong ke|loi nhuan|bao cao|gia von)\b/, tool: 'get_revenue_stats', label: 'doanh thu/thống kê' },
  { re: /\b(danh sach nhan vien|nhan vien quan|staff list|co ai lam)\b/, tool: 'get_staff_list', label: 'danh sách nhân viên' },
  { re: /\b(lich ca|ca lam viec|phan ca|xep ca)\b/, tool: 'get_shift_schedule', label: 'lịch ca' },
  { re: /\b(cong thuc|nguyen lieu|pha che|cach pha|cach lam mon)\b/, tool: 'get_recipe', label: 'công thức pha chế' },
  { re: /\b(tra cuu khach|lich su khach|tim khach|ho so khach)\b/, tool: 'search_customer_history', label: 'tra cứu khách' },
  { re: /\b(reset cho|reset toan bo cho|reset ban)\b/, tool: 'reset_all_seats', label: 'reset ghế' },
  { re: /\b(danh dau het hang|tinh trang mon)\b/, tool: 'mark_out_of_stock', label: 'đánh dấu hết món' }
];

export function checkInput(text) {
  const t = String(text || '');
  if (!t) return { blocked: false, matched: [], score: 0, action: 'allow' };
  const norm = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matched = INJECTION_PATTERNS.filter((re) => re.test(t) || re.test(norm));
  const score = matched.length;
  const action = score >= THRESHOLD_BLOCK ? 'block' : score >= THRESHOLD_WARN ? 'warn' : 'allow';
  return { blocked: action === 'block', matched: matched.map((m) => m.source.slice(0, 50)), score, action };
}

export function checkIntent(text, role) {
  const n = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hit = STAFF_INTENTS.find((x) => x.re.test(n));
  if (!hit) return { required: null, allowed: true };
  return {
    required: hit.label,
    tool: hit.tool,
    allowed: role === 'staff'
  };
}

/* Hai câu từ sẵn để UI dùng chung — shape như rule ({ text }) */
export const GUARD_MESSAGES = {
  injection: 'Dạ em nhận ra câu hỏi này có phần cố "làm em quên hướng dẫn". Em không thể làm theo ạ; nếu là nhầm lẫn, anh/chị hỏi lại bình thường giúp em nhé ạ.',
  forbidden: 'Dạ anh/chị không có quyền truy cập thông tin này — chức năng chỉ dành cho nhân viên của quán ạ.'
};
