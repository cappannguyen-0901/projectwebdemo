/* Kiểm tra injection thuần, không phụ thuộc giao diện hoặc vai trò. */
const INJECTION_PATTERNS = [
  /\b(ignore|ign0re|disregard|forget)\s+(all\s+)?(previous|prev1ous|above|earlier)\s+(instructions?|directives?|prompts?|rules?)/i,
  /\b(system\s*prompt|jailbreak|you\s+are\s+now|pretend\s+you|act\s+as\s+if|roleplay\s+as)\b/i,
  /\b(reveal|show|print|leak|dump)\s+(your\s+)?(system|initial|original)\s+(prompt|instructions?)/i,
  /\b(DAN\s+mode|developer\s+mode|admin\s+mode|god\s+mode)\b/i,
  /\b(bo\s+qua|quen)\s+(moi|tat\s+ca|nhung)\s+(huong\s+dan|chi\s+dan|lenh|quy\s+tac)/i,
  /\b(gia\s+vo|dong\s+vai)\s+(nhu|la)\b/i,
  /1gn[o0]r[e3]\s+[a@]ll/i,
  /pr[e3]v[i1][o0]us\s+[i1]nstruct/i,
  /syst[e3]m\s+pr[o0]mpt/i
];

const THRESHOLD_BLOCK = 2;
const THRESHOLD_WARN = 1;

export function checkInput(text) {
  const value = String(text || '');
  if (!value) return { blocked: false, matched: [], score: 0, action: 'allow' };
  const normalized = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matched = INJECTION_PATTERNS.filter((pattern) => pattern.test(value) || pattern.test(normalized));
  const score = matched.length;
  const action = score >= THRESHOLD_BLOCK ? 'block' : score >= THRESHOLD_WARN ? 'warn' : 'allow';
  return { blocked: action === 'block', matched: matched.map((pattern) => pattern.source.slice(0, 50)), score, action };
}

export const GUARD_MESSAGES = Object.freeze({
  injection: 'Dạ em nhận ra câu hỏi này có phần cố "làm em quên hướng dẫn". Em không thể làm theo ạ; nếu là nhầm lẫn, anh/chị hỏi lại bình thường giúp em nhé ạ.'
});
