/* ============================================================
   AI OUTPUT LAYER v5.0 — SMART BUILDER + CARD HYGIENE
============================================================ */
const AI_OUTPUT_CONFIG = { MAX_TEXT: 800, MAX_CARDS: 12, MAX_CARD_BYTES: 4096, SUFFIX: '…' };

const AIOutput = {
  build(type, payload = {}) {
    if (!type || typeof type !== 'string') type = 'text';
    payload = payload || {};
    const base = { type, source: payload.source || 'unknown', timestamp: Date.now(), meta: payload.meta || {} };
    if (type === 'pending') return { ...base, toolName: payload.toolName || null, toolCallId: payload.toolCallId || null, args: payload.args || {}, message: payload.message || 'Anh/chị xác nhận thao tác này ạ?' };
    if (type === 'error') return { ...base, message: payload.message || this._fallbackMessage() };
    let text = this.truncate(String(payload.message || '').trim(), AI_OUTPUT_CONFIG.MAX_TEXT);
    let cards = this.validateCards(payload.cards || '');
    if (!text && cards) text = this._introFor(cards);
    if (!text && !cards) text = this._fallbackMessage();
    return { ...base, message: text, cards, confidence: payload.confidence ?? 1 };
  },

  validateCards(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const re = /\[UI_(\w+)\]([\s\S]*?)\[\/UI_\1\]/g;
    const parts = [], seen = new Set(); let m, count = 0;
    while ((m = re.exec(raw)) !== null) {
      if (count >= AI_OUTPUT_CONFIG.MAX_CARDS) break;
      try {
        const type = m[1]; const jsonStr = m[2].trim(); if (!jsonStr) continue;
        const parsed = JSON.parse(jsonStr);
        const key = type + '::' + JSON.stringify(parsed);
        if (seen.has(key)) continue;
        seen.add(key);
        const normalized = JSON.stringify(parsed);
        if (normalized.length > AI_OUTPUT_CONFIG.MAX_CARD_BYTES) continue;
        parts.push(`[UI_${type}]${normalized}[/UI_${type}]`); count++;
      } catch(e) {}
    }
    return parts.join('\n');
  },

  truncate(text, max) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    if (text.length <= max) return text;
    const targetLen = max - AI_OUTPUT_CONFIG.SUFFIX.length;
    const cut = Math.max(text.lastIndexOf('.', targetLen), text.lastIndexOf('?', targetLen), text.lastIndexOf('!', targetLen));
    const cutAt = cut > targetLen * 0.7 ? cut + 1 : targetLen;
    return text.slice(0, cutAt).trim() + AI_OUTPUT_CONFIG.SUFFIX;
  },

  _introFor(cards) {
    const map = [
      [/\[UI_SEAT\]/, 'Dạ em gợi ý chỗ ngồi phù hợp cho anh/chị ạ:'],
      [/\[UI_COMBO\]/, 'Dạ em gợi ý combo tiết kiệm ạ:'],
      [/\[UI_MENU\]|\[UI_CATALOG\]/, 'Dạ em gợi ý vài món phù hợp ạ:'],
      [/\[UI_PROMO_MANAGE\]/, 'Dạ em mở trang quản lý khuyến mãi ạ:'],
      [/\[UI_PROMO\]/, 'Dạ đây là khuyến mãi đang áp dụng ạ:'],
      [/\[UI_ORDER\]|\[UI_LIVE_ORDER\]/, 'Dạ thông tin đơn hàng ạ:'],
      [/\[UI_BOOKING\]/, 'Dạ thông tin đặt bàn ạ:'],
      [/\[UI_RECIPE\]/, 'Dạ công thức pha chế ạ:'],
      [/\[UI_STORE\]/, 'Dạ thông tin quán ạ:'],
      [/\[UI_KPI\]/, 'Dạ số liệu nhanh ạ:'],
      [/\[UI_CUSTOMER\]/, 'Dạ thông tin khách hàng ạ:'],
      [/\[UI_STAFF\]|\[UI_SHIFT\]|\[UI_SHIFT_PERSONAL\]/, 'Dạ thông tin ca làm ạ:'],
      [/\[UI_OOS\]/, 'Dạ các món tạm hết hàng ạ:'],
      [/\[UI_USER_STATS\]/, 'Dạ điểm tích lũy hiện tại ạ:'],
      [/\[UI_HANDOVER\]/, 'Dạ em chuyển anh/chị sang nhân viên hỗ trợ ạ:'],
      [/\[UI_CHECKOUT\]/, 'Dạ đơn của anh/chị đã sẵn sàng ạ:'],
      [/\[UI_GROUP_SUMMARY\]/, 'Dạ em đã tổng hợp nhu cầu nhóm ạ:'],
      [/\[UI_WELCOME\]/, 'Dạ em có thể giúp gì ngay đây ạ:'],
      [/\[UI_RATING\]/, 'Dạ anh/chị vui lòng đánh giá trải nghiệm nhé ạ:'],
      [/\[UI_CART_SUCCESS\]/, 'Dạ đã thêm vào giỏ hàng ạ:'],
      [/\[UI_ORDER_CHECKOUT\]/, 'Dạ em kiểm tra thông tin giao hàng ạ:']
    ];
    for (const [re,txt] of map) if(re.test(cards)) return txt;
    return 'Dạ em gửi anh/chị thông tin này ạ:';
  },

  _fallbackMessage(){ return 'Dạ em chưa xử lý được yêu cầu này. Anh/chị có thể nói ngắn gọn hơn hoặc liên hệ hotline 0366 444 038 để được hỗ trợ ạ.'; },

  isValidResponse(res){
    if(!res||typeof res!=='object') return false;
    if(!res.type||typeof res.type!=='string') return false;
    if(res.type==='pending') return !!(res.toolName&&res.toolCallId);
    if(res.type==='error') return !!res.message;
    if(res.type==='text'||res.type==='cards') return !!(res.message||res.cards);
    return true;
  }
};
window.AIOutput = AIOutput;
