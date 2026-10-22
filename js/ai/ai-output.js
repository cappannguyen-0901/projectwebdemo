/* ============================================================
   AI OUTPUT LAYER — Unified response builder + validator
============================================================ */

const AI_OUTPUT_CONFIG = { MAX_TEXT: 800, MAX_CARDS: 5, MAX_CARD_BYTES: 4096, SUFFIX: '…' };

const AIOutput = {
  build(type, payload = {}) {
    const base = { type, source: payload.source || 'unknown', timestamp: Date.now(), meta: {} };
    if (type === 'pending') {
      return { ...base, toolName: payload.toolName, toolCallId: payload.toolCallId,
               args: payload.args, message: payload.message || 'Anh/chị xác nhận thao tác này?' };
    }
    if (type === 'error') {
      return { ...base, message: payload.message || this._fallbackMessage() };
    }
    let text = this.truncate(String(payload.message || '').trim(), AI_OUTPUT_CONFIG.MAX_TEXT);
    let cards = this.validateCards(payload.cards || '');
    if (!text && cards) text = this._introFor(cards);
    if (!text && !cards) text = this._fallbackMessage();
    return { ...base, message: text, cards, confidence: payload.confidence ?? 1 };
  },

  validateCards(raw) {
    if (!raw) return '';
    const re = /\[UI_(\w+)\]([\s\S]*?)\[\/UI_\1\]/g;
    const parts = []; let m, count = 0;
    while ((m = re.exec(raw)) !== null) {
      if (count >= AI_OUTPUT_CONFIG.MAX_CARDS) break;
      try {
        const parsed = JSON.parse(m[2]);
        const json = JSON.stringify(parsed);
        if (json.length > AI_OUTPUT_CONFIG.MAX_CARD_BYTES) {
          console.warn(`[AIOutput] Card ${m[1]} quá lớn (${json.length}b) → skip`);
          continue;
        }
        parts.push(`[UI_${m[1]}]${json}[/UI_${m[1]}]`);
        count++;
      } catch (e) {
        console.warn(`[AIOutput] Card ${m[1]} JSON lỗi → skip:`, e.message);
      }
    }
    return parts.join('\n');
  },

  truncate(text, max) {
    if (!text || text.length <= max) return text;
    const cutoff = text.lastIndexOf('.', max);
    return text.slice(0, cutoff > max * 0.7 ? cutoff : max).trim() + AI_OUTPUT_CONFIG.SUFFIX;
  },

  _introFor(cards) {
    if (/\[UI_SEAT\]/.test(cards)) return 'Dạ em gợi ý chỗ ngồi phù hợp ạ:';
    if (/\[UI_COMBO\]/.test(cards)) return 'Dạ em gợi ý combo ưu đãi ạ:';
    if (/\[UI_MENU\]|\[UI_CATALOG\]/.test(cards)) return 'Dạ em gợi ý các món sau ạ:';
    if (/\[UI_PROMO\]/.test(cards)) return 'Dạ đây là các khuyến mãi đang áp dụng ạ:';
    if (/\[UI_ORDER\]/.test(cards)) return 'Dạ đây là các đơn hàng ạ:';
    if (/\[UI_BOOKING\]/.test(cards)) return 'Dạ đây là các booking ạ:';
    if (/\[UI_RECIPE\]/.test(cards)) return 'Dạ công thức pha chế ạ:';
    if (/\[UI_STORE\]/.test(cards)) return 'Dạ thông tin quán ạ:';
    if (/\[UI_KPI\]/.test(cards)) return 'Dạ số liệu tổng quan ạ:';
    if (/\[UI_LIVE_ORDER\]/.test(cards)) return 'Dạ đơn đang giao ạ:';
    if (/\[UI_CUSTOMER\]/.test(cards)) return 'Dạ thông tin khách hàng ạ:';
    if (/\[UI_STAFF\]|\[UI_SHIFT\]/.test(cards)) return 'Dạ thông tin nhân viên ạ:';
    return 'Dạ em gửi anh/chị thông tin ạ:';
  },

  _fallbackMessage() {
    return 'Dạ em chưa có câu trả lời cho câu hỏi này. Anh/chị thử hỏi lại hoặc gọi hotline 0366 474 038 để được hỗ trợ ạ.';
  },

  isValidResponse(res) {
    if (!res || typeof res !== 'object' || !res.type) return false;
    if (res.type === 'pending') return !!(res.toolName && res.toolCallId);
    if (res.type === 'text' || res.type === 'cards') return !!(res.message || res.cards);
    return true;
  }
};

window.AIOutput = AIOutput;