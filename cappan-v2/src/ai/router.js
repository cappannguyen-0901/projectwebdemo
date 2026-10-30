import { authorize } from '../domain/policy.js';
import { match } from './rules.js';
import { checkInput, GUARD_MESSAGES } from './guards.js';

export const UNIFIED_DENIAL_MESSAGE =
  'Dạ anh/chị không có quyền truy cập thông tin này — chức năng chỉ dành cho nhân viên của quán ạ.';

const clean = (value) => String(value || '').trim().toLocaleLowerCase('vi').replace(/[.!?]+$/g, '');
const affirmative = (value) => /^(?:ok|okay|xác nhận|đồng ý|đồng ý nhé)$/.test(clean(value));
const negative = (value) => /^(?:hủy|thôi|không|không đồng ý|bỏ)$/.test(clean(value));

function resolveCapability(name, args, ctx) {
  if (!(ctx.registry || []).includes(name))
    return { type: 'reject-capability', data: { message: 'Yêu cầu dùng chức năng không được đăng ký.' } };
  const action = ctx.policyActions?.[name];
  if (action && !authorize(ctx.actor, action, ctx.resource || null).allowed)
    return { type: 'denied', data: { message: UNIFIED_DENIAL_MESSAGE, code: 'FORBIDDEN' } };
  return { type: 'capability', data: { name, args: args && typeof args === 'object' ? args : {} } };
}

export function route(input, state = {}, ctx = {}) {
  const text = String(input || '').trim();
  if (checkInput(text).blocked)
    return { type: 'denied', data: { message: GUARD_MESSAGES.injection, code: 'INJECTION' } };

  if (state.pendingToken) {
    if (affirmative(text)) return { type: 'confirm', data: { token: state.pendingToken } };
    if (negative(text)) return { type: 'cancel-confirmation', data: { token: state.pendingToken } };
    return { type: 'pending-confirmation', data: { message: 'Anh/chị hãy xác nhận hoặc bỏ thẻ đang chờ trước nhé ạ.' } };
  }
  if (state.draft && negative(text)) return { type: 'cancel-draft', data: {} };

  const local = ctx.localRule || match(text, { menu: ctx.menu || [], user: ctx.user || null });
  if (local) return { type: 'reply', data: { text: local.text } };
  if (affirmative(text)) return { type: 'reply', data: { text: 'Dạ, anh/chị cần em hỗ trợ gì ạ?' } };
  if (state.draft) return { type: 'draft-input', data: { text } };
  if (ctx.localIntent) return resolveCapability(ctx.localIntent.name, ctx.localIntent.args, ctx);
  if (ctx.llmResult) return resolveCapability(ctx.llmResult.name, ctx.llmResult.args, ctx);
  if (ctx.llmError && ctx.structuredIntent)
    return resolveCapability(ctx.structuredIntent.name, ctx.structuredIntent.args, ctx);
  if (ctx.requestLLM) return { type: 'select-capability', data: { text } };
  return { type: 'reply', data: { text: ctx.fallback || 'Dạ em chưa nhận ra yêu cầu. Anh/chị có thể hỏi món, xem bàn trống, đặt nước hoặc đặt bàn ạ.' } };
}
