/* Chat UI chỉ nhận dữ liệu có cấu trúc từ facade và sổ năng lực. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';
import { match } from './ai/rules.js';
import { checkInput, checkIntent, GUARD_MESSAGES } from './ai/guards.js';
import { parseWhen } from './ai/datetime-vi.js';
import { createDraftSession } from './ai/draft.js';
import { CAPABILITIES, createCapabilityRunner } from './ai/capabilities.js';
import { AI_CONFIG } from './config.js';

const { api, user } = await createAppApi();
const log = document.getElementById('log');
const form = document.getElementById('f');
const input = document.getElementById('q');
const actor = { userId: user?.id || null, role: user?.role || 'guest', channel: 'chat' };
const runner = createCapabilityRunner(api);
const drafts = createDraftSession();
let menuCache = [];
let pendingToken = null;
let pendingCard = null;

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');

function message(role, text) {
  const node = document.createElement('div');
  node.className = `msg ${role}`;
  node.textContent = text;
  log.appendChild(node);
  log.scrollTop = log.scrollHeight;
  return node;
}

function button(label, onClick, kind = '') {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `btn ${kind}`.trim();
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

function showConfirmCard(result) {
  const card = result.data;
  const node = message('bot', '');
  node.classList.add('chat-card');
  const title = document.createElement('strong');
  title.textContent = card.title;
  node.appendChild(title);
  for (const line of card.lines || []) {
    const row = document.createElement('div');
    row.textContent = line;
    node.appendChild(row);
  }
  const expiry = document.createElement('small');
  expiry.textContent = `Thẻ hết hạn lúc ${new Date(card.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.`;
  node.appendChild(expiry);
  const actions = document.createElement('div');
  actions.className = 'chat-card-actions';
  actions.append(button('Xác nhận', () => confirmPending(), 'primary'));
  actions.append(button('Bỏ bản nháp', () => cancelPending()));
  node.appendChild(actions);
  pendingToken = card.token;
  pendingCard = node;
}

function showLateCard(result) {
  const data = result.data;
  const node = message('bot', '');
  node.classList.add('chat-card');
  const title = document.createElement('strong');
  title.textContent = `Đặt bàn ${data.seatId} đang trễ`;
  node.appendChild(title);
  const details = document.createElement('div');
  details.textContent = `${data.date} lúc ${data.time} · ${data.guests} khách`;
  node.appendChild(details);
  const link = document.createElement('a');
  link.href = '/booking.html';
  link.textContent = 'Mở trang đặt chỗ';
  node.appendChild(link);
}

function showResult(result) {
  if (result?.type === 'confirm-card') return showConfirmCard(result);
  if (result?.type === 'booking-late') return showLateCard(result);
  const node = message('bot', '');
  node.classList.add('chat-card');
  const { type, data } = result || {};
  if (type === 'menu.items') {
    node.textContent = data.items.length
      ? data.items.map((item) => `${item.name} — ${Number(item.price).toLocaleString('vi-VN')}đ${item.inStock ? '' : ' (hết món)'}`).join('\n')
      : 'Em chưa tìm thấy món phù hợp.';
  } else if (type === 'booking.seats') {
    node.textContent = data.seats.map((seat) => `${seat.id} · ${seat.capacity} chỗ · ${seat.status}`).join('\n') || 'Chưa có bàn.';
  } else if (type === 'booking.create.result') {
    node.textContent = `Đã tạo yêu cầu đặt bàn ${data.seatId} ngày ${data.date} lúc ${data.time}. Tiền cọc ${Number(data.depositAmount).toLocaleString('vi-VN')}đ.`;
    const link = document.createElement('a');
    link.href = '/booking.html';
    link.textContent = 'Mở trang đặt chỗ để thanh toán cọc';
    node.appendChild(link);
  } else if (type === 'order.create.result') {
    node.textContent = `Đã đặt đơn ${data.id}, tổng tiền ${Number(data.total).toLocaleString('vi-VN')}đ.`;
  } else if (type?.endsWith('.result')) {
    node.textContent = data?.status === 'cancelled'
      ? `Đã hủy ${data.id}${data.refundAmount !== undefined ? ` · hoàn ${Number(data.refundAmount).toLocaleString('vi-VN')}đ` : ''}.`
      : `Đã xử lý ${data?.id || 'yêu cầu'}.`;
  } else if (type === 'booking.list' || type === 'order.list') {
    const rows = data.bookings || data.orders || [];
    node.textContent = rows.length ? rows.map((row) => `${row.id} · ${row.status || row.date || ''}`).join('\n') : 'Tài khoản chưa có dữ liệu.';
  } else if (type === 'order.status') {
    node.textContent = `Đơn ${data.order.id}: ${data.order.status}.`;
  } else if (type === 'profile.me') {
    node.textContent = `Hồ sơ: ${data.profile.name || 'Khách hàng'} · ${data.profile.phone || 'chưa có số điện thoại'}.`;
  } else {
    node.textContent = 'Em đã nhận được yêu cầu.';
  }
}

async function confirmPending() {
  if (!pendingToken) return;
  const token = pendingToken;
  pendingToken = null;
  try {
    showResult(await runner.confirm(token, actor));
    pendingCard?.remove();
    pendingCard = null;
  } catch (error) {
    pendingCard?.remove();
    pendingCard = null;
    message('bot', error.message || 'Mã xác nhận không còn dùng được.');
  }
}

function cancelPending() {
  if (pendingToken) runner.cancel(pendingToken, actor);
  pendingToken = null;
  pendingCard?.remove();
  pendingCard = null;
  message('bot', 'Em đã bỏ thẻ xác nhận.');
}

function isAffirmative(text) {
  return /^(?:ok|okay|xác nhận|đồng ý|đồng ý nhé)[.! ]*$/i.test(text.trim());
}
function isNegative(text) {
  return /^(?:hủy|thôi|không|không đồng ý|bỏ)[.! ]*$/i.test(text.trim());
}

function parseLocalIntent(text) {
  const clean = normalize(text);
  const id = text.match(/\b(?:od|bk)-[a-z0-9-]+\b/i)?.[0];
  if (/huy|bo/.test(clean) && /dat ban|booking/.test(clean) && id) return { name: 'booking.cancel', args: { id } };
  if (/huy|bo/.test(clean) && /don|nuoc|mon/.test(clean) && id) return { name: 'order.cancel', args: { id } };
  if (/dat ban|giu ban/.test(clean)) return { name: 'booking.create', args: {} };
  if (/dat nuoc|dat mon|giao hang/.test(clean)) return { name: 'order.create', args: {} };
  if (/goi y|nen uong|mon nao ngon/.test(clean)) return { name: 'menu.recommend', args: { preference: text } };
  if (/tim mon|co mon|menu/.test(clean)) return { name: 'menu.search', args: { query: text } };
  if (/ban trong|so do ban/.test(clean)) {
    const when = parseWhen(text);
    if (when.date) return { name: 'booking.availability', args: { date: when.date } };
  }
  if (/dat cho cua toi|lich dat ban|booking cua toi/.test(clean)) return { name: 'booking.mine', args: {} };
  if (/don hang cua toi|don cua toi/.test(clean)) return { name: 'order.mine', args: {} };
  if (/trang thai don|don nay/.test(clean) && id?.startsWith('od-')) return { name: 'order.status', args: { id } };
  if (/ho so cua toi|thong tin cua toi/.test(clean)) return { name: 'profile.me', args: {} };
  return null;
}

function getMenuItem(text) {
  const clean = normalize(text);
  return menuCache.find((item) => item.inStock && clean.includes(normalize(item.name))) || null;
}

function parseDraftFields(text, action) {
  const when = parseWhen(text);
  const fields = { text };
  if (when.date) fields.date = when.date;
  if (when.time) fields.time = when.time;
  const seatId = text.match(/\b([a-f]\d{1,2})\b/i)?.[1];
  if (seatId) fields.seatId = seatId.toUpperCase();
  const guests = text.match(/(\d+)\s*(?:người|khách)/i);
  if (guests) fields.guests = Number(guests[1]);
  const capacity = text.match(/(?:bàn|chỗ)\s+cho\s+(\d+)\s*(?:người|khách)/i);
  if (capacity) fields.capacity = Number(capacity[1]);
  const phone = text.match(/(?:\+?\d[\d .-]{7,14}\d)/)?.[0]?.replace(/[ .-]/g, '');
  if (phone) fields.phone = phone;
  const address = text.match(/(?:địa chỉ|giao đến|đến địa chỉ)\s*[:：]?\s*(.+)$/i)?.[1];
  if (address) fields.address = address.trim();
  if (action === 'order') {
    const item = getMenuItem(text);
    if (item) {
      const count = text.match(/(?:^|\s)(\d+)\s*(?:ly|cốc|phần)\s+/i);
      fields.items = [{ itemId: item.id, name: item.name, qty: count ? Number(count[1]) : 1, size: item.sizes?.[0]?.name || 'M', toppings: [] }];
    }
  }
  return fields;
}

function missingPrompt(draft) {
  const missing = drafts.missing();
  if (draft.action === 'booking' && missing.includes('time')) {
    const hour = draft.data && (log.lastChild?.textContent.match(/\b(\d{1,2})\s*h\b/i)?.[1]);
    if (hour) return `Bạn nói ${hour} giờ sáng hay tối ạ?`;
  }
  const labels = { seatId: 'mã bàn', 'seatId hoặc capacity': 'mã bàn hoặc sức chứa mong muốn', date: 'ngày', time: 'giờ có ghi sáng, trưa hoặc tối', guests: 'số khách', items: 'món và số lượng', address: 'địa chỉ giao hàng', phone: 'số điện thoại' };
  return `Em cần thêm ${missing.map((field) => labels[field] || field).join(', ')} ạ.`;
}

async function prepareDraft() {
  const draft = drafts.get();
  if (!draft || !drafts.ready()) return message('bot', missingPrompt(draft || { action: '' }));
  const args = { ...draft.data };
  if (draft.action === 'booking' && !args.seatId && args.capacity) {
    const seats = await api.seats.getMap(args.date);
    const seat = seats.find((row) => row.capacity >= args.capacity && row.status === 'available');
    if (!seat) return message('bot', `Em chưa tìm thấy bàn còn trống cho ${args.capacity} người ngày ${args.date} ạ.`);
    args.seatId = seat.id;
  }
  if (draft.action === 'order') args.items = args.items.map(({ itemId, qty, size, toppings }) => ({ itemId, qty, size, toppings }));
  drafts.cancel();
  try {
    showResult(await runner.prepare(`${draft.action}.create`, args, actor));
  } catch (error) {
    message('bot', error.message || 'Em chưa chuẩn bị được thẻ xác nhận.');
  }
}

async function startOrFillDraft(action, text, initial = {}) {
  if (action === 'booking' && !CAPABILITIES['booking.create'].roles.includes(actor.role)) {
    message('bot', 'Anh/chị vui lòng đăng nhập để đặt bàn ạ.');
    return;
  }
  const active = drafts.get();
  if (!active || active.action !== action) drafts.start(action, initial);
  const fields = parseDraftFields(text, action);
  if (action === 'order' && user?.phone) fields.profile = { phone: user.phone };
  const draft = drafts.fill(fields);
  if (drafts.ready()) return prepareDraft();
  message('bot', missingPrompt(draft));
}

function permittedCapabilities() {
  return Object.values(CAPABILITIES)
    .filter((capability) => capability.roles.includes(actor.role))
    .map(({ name, description, input, risk }) => ({ name, description, input, risk }));
}

async function selectCapability(question) {
  const allowed = permittedCapabilities();
  const visibleMenu = menuCache.filter((item) => item.inStock).map(({ id, name }) => ({ id, name }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_CONFIG.timeoutMs);
  try {
    const response = await fetch(AI_CONFIG.proxyUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ model: AI_CONFIG.model, max_tokens: 250,
        messages: [
          { role: 'system', content: `Chọn duy nhất một năng lực từ danh sách được phép và trích đối số. Trả đúng JSON dạng {"name":string|null,"args":object}. Không tạo tên ngoài danh sách. Không trả token. Danh sách: ${JSON.stringify(allowed)}. Thực đơn đang bán: ${JSON.stringify(visibleMenu)}. Nếu không phù hợp, trả {"name":null,"args":{}}.` },
          { role: 'user', content: question }
        ] })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw.replace(/^```(?:json)?\s*|\s*```$/g, '') : '';
    const selected = JSON.parse(text);
    if (!selected || !allowed.some((capability) => capability.name === selected.name) || !selected.args || typeof selected.args !== 'object' || Array.isArray(selected.args)) return null;
    return selected;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runCapability(name, args) {
  const capability = CAPABILITIES[name];
  if (!capability || !capability.roles.includes(actor.role)) {
    message('bot', actor.role === 'guest' ? 'Anh/chị vui lòng đăng nhập để dùng chức năng này ạ.' : GUARD_MESSAGES.forbidden);
    return;
  }
  if (capability.risk !== 'read') {
    if (name === 'booking.create' || name === 'order.create') return startOrFillDraft(name.startsWith('booking') ? 'booking' : 'order', '', args);
    try { showResult(await runner.prepare(name, args, actor)); }
    catch (error) { message('bot', error.message || 'Em chưa chuẩn bị được thẻ xác nhận.'); }
    return;
  }
  try { showResult(await runner.run(name, args, actor)); }
  catch (error) { message('bot', error.message || 'Em chưa lấy được thông tin này.'); }
}

function acknowledgePending(text) {
  if (!pendingToken) return false;
  if (isAffirmative(text)) { confirmPending(); return true; }
  if (isNegative(text)) { cancelPending(); return true; }
  return false;
}

async function respond(text) {
  message('me', text);
  const shortAck = pendingToken && (isAffirmative(text) || isNegative(text));
  if (!shortAck) {
    const inputGuard = checkInput(text);
    if (inputGuard.blocked) { message('bot', GUARD_MESSAGES.injection); return; }
    const intentGuard = checkIntent(text, actor.role);
    if (!intentGuard.allowed) { message('bot', GUARD_MESSAGES.forbidden); toast('Chức năng này chỉ dành cho nhân viên.', 'err'); return; }
  }
  if (acknowledgePending(text)) return;
  if (pendingToken) { message('bot', 'Anh/chị hãy xác nhận hoặc bỏ thẻ đang chờ trước nhé ạ.'); return; }

  const localRule = match(text, { menu: menuCache, user });
  if (localRule) { message('bot', localRule.text); return; }
  if (drafts.get()) {
    if (/^(?:hủy|thôi|bỏ bản nháp)[.! ]*$/i.test(text.trim())) { drafts.cancel(); message('bot', 'Em đã bỏ bản nháp.'); return; }
    const draft = drafts.get();
    const fields = parseDraftFields(text, draft.action);
    const adding = draft.action === 'order' && /thêm\s+(\d+)\s+(?:ly|phần)\s+(.+)/i.exec(text);
    if (adding) {
      delete fields.items;
      const item = getMenuItem(adding[2]);
      if (item) {
        const items = [...draft.data.items];
        const existing = items.find((line) => line.itemId === item.id);
        if (existing) existing.qty = Number(existing.qty || 0) + Number(adding[1]);
        else items.push({ itemId: item.id, name: item.name, qty: Number(adding[1]), size: item.sizes?.[0]?.name || 'M', toppings: [] });
        fields.items = items;
      }
    }
    if (draft.action === 'order' && user?.phone) fields.profile = { phone: user.phone };
    drafts.fill(fields);
    if (drafts.ready()) return prepareDraft();
    return message('bot', missingPrompt(drafts.get()));
  }

  const localIntent = parseLocalIntent(text);
  if (localIntent) {
    if ((localIntent.name === 'order.create' || localIntent.name === 'booking.create') && !Object.keys(localIntent.args).length)
      return startOrFillDraft(localIntent.name.startsWith('booking') ? 'booking' : 'order', text);
    return runCapability(localIntent.name, localIntent.args);
  }
  if (/^(?:ok|okay)[.! ]*$/i.test(text.trim())) { message('bot', 'Dạ, anh/chị cần em hỗ trợ gì ạ?'); return; }
  const selected = await selectCapability(text);
  if (selected?.name) return runCapability(selected.name, selected.args);
  message('bot', 'Dạ em chưa nhận ra yêu cầu. Anh/chị có thể hỏi món, xem bàn trống, đặt nước hoặc đặt bàn ạ.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await respond(text);
});

async function init() {
  renderHeader(document.getElementById('hdr'), { user });
  try { menuCache = (await api.menu.getAll()).slice(0, 80); }
  catch (error) { toast(`Không nạp được thực đơn: ${error.message}`, 'err'); }
  message('bot', 'Dạ em có thể tìm món, xem bàn trống, đặt nước hoặc đặt bàn. Mọi thao tác ghi đều hiện thẻ để anh/chị xác nhận ạ.');
  try {
    const late = await api.bookings.getLateCards(user?.id || undefined);
    for (const card of late) showResult({ type: 'booking-late', data: card });
  } catch { /* Guest không có thẻ đặt bàn cần xem. */ }
}

init();
