/* ============================================================
   AI INPUT LAYER — Unified preprocessing + intent classification
   Load TRƯỚC brain-legacy.js và brain.js
============================================================ */

const AI_INPUT_CONFIG = { MAX_LEN: 500, BLOCK_LEN: 2000, LANGS: ['vi', 'en'] };

const AI_INPUT_INTENTS = {
  KB_STATIC: 'kb_static', KB_FAQ: 'kb_faq',
  SEAT_QUERY: 'seat_query', DRINK_QUERY: 'drink_query', PRICE_QUERY: 'price_query',
  ACTION_WRITE: 'action_write', DATA_QUERY: 'data_query',
  GREETING: 'greeting', THANKS: 'thanks', CANCEL: 'cancel', UNKNOWN: 'unknown',
};

const AIInput = {
  normalize(raw) {
    const s = String(raw ?? '').trim();
    const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s);
    let norm = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^\p{L}\p{N}< ]/gu, ' ')
      .replace(/\s+/g, ' ').trim();
    norm = norm.replace(/\bko\b/g, 'khong').replace(/\bk\b/g, 'khong')
      .replace(/\bdc\b/g, 'duoc').replace(/\bsdt\b/g, 'so dien thoai')
      .replace(/\bsp\b/g, 'san pham').replace(/\btks\b/g, 'thanks');
    return { raw: s, norm, hasEmoji };
  },

  detectLang(raw) {
    if (/[àáảãạăâđêôơư]/i.test(String(raw))) return 'vi';
    const tokens = String(raw).toLowerCase().split(/\s+/);
    const en = ['what','where','when','how','why','which','is','are','the','a','an','do','does','can','could','would','show','give','find'];
    return tokens.filter(t => en.includes(t)).length >= 2 ? 'en' : 'vi';
  },

  validate(raw, norm) {
    const errors = [];
    if (!raw) errors.push('empty');
    if (raw.length > AI_INPUT_CONFIG.BLOCK_LEN) errors.push('too_long');
    if (!norm) errors.push('empty_norm');
    return { valid: errors.length === 0, errors };
  },

  classify(norm, role) {
    return { intent: this._intent(norm, role), entities: this._entities(norm) };
  },

  process(raw, role) {
    const { raw: r, norm, hasEmoji } = this.normalize(raw);
    const v = this.validate(r, norm);
    const lang = this.detectLang(r);
    const { intent, entities } = this.classify(norm, role);
    return { raw: r, norm, hasEmoji, lang, intent, entities,
             tokens: norm.split(' '), length: r.length, valid: v.valid, errors: v.errors };
  },

  _intent(norm, role) {
    if (this._isGreeting(norm)) return AI_INPUT_INTENTS.GREETING;
    if (this._isThanks(norm)) return AI_INPUT_INTENTS.THANKS;
    if (this._isCancel(norm)) return AI_INPUT_INTENTS.CANCEL;
    if (this._isActionWrite(norm, role)) return AI_INPUT_INTENTS.ACTION_WRITE;
    if (this._isDataQuery(norm, role)) return AI_INPUT_INTENTS.DATA_QUERY;
    if (this._isKBStatic(norm)) return AI_INPUT_INTENTS.KB_STATIC;
    if (this._isFAQ(norm)) return AI_INPUT_INTENTS.KB_FAQ;
    if (this._isPrice(norm)) return AI_INPUT_INTENTS.PRICE_QUERY;
    if (this._isSeat(norm)) return AI_INPUT_INTENTS.SEAT_QUERY;
    if (this._isDrink(norm)) return AI_INPUT_INTENTS.DRINK_QUERY;
    return AI_INPUT_INTENTS.UNKNOWN;
  },

  _isGreeting(n) { return n.split(' ').length <= 4 && /^(chao|hello|hi|hey|alo|xin chao)\b/.test(n); },
  _isThanks(n) { return /\b(cam on|thanks|thank you|tks)\b/.test(n); },
_isCancel(n) {
  const trimmed = n.trim();
  const words = trimmed.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;

  // Chỉ cancel khi từ khóa đứng MỘT MÌNH hoặc kèm danh từ ngắn
  if (/^(huy|thoi|cancel|stop|dung)$/.test(trimmed)) return true;
  if (/^(huy|thoi|cancel|stop|dung)\s+(don|booking|dat|lenh|nay|do)$/.test(trimmed)) return true;

  // "không" + động từ ý chí → cancel
  if (/^khong\s+(can|muon|lay|dat|goi|dung)\b/.test(trimmed)) return true;

  return false;
}, 
 _isActionWrite(n, role) {
    if (role !== 'staff') return /\b(huy booking|huy dat cho|huy don)\b/.test(n);
    return /\b(danh dau|reset|huy don|huy booking|hoan thanh|xep ca|phan ca|doi gia|sua gia|xoa mon)\b/.test(n);
  },
  _isDataQuery(n, role) {
    if (role === 'staff') return /\b(doanh thu|don hang|booking hom nay|nhan vien|lich ca|thong ke|kpi|tra cuu khach)\b/.test(n);
    return /\b(don (cua )?(toi|minh)|theo doi don|shipper)\b/.test(n);
  },
  _isKBStatic(n) {
    return /\b(wifi|wi fi|mat khau|dia chi|o dau|gio mo|may gio|dong cua|hotline|so dien thoai|email|gui xe|dau xe|bai xe|parking|tien ich|thanh toan|chuyen khoan|nghi trua|nghi le|mang ve)\b/.test(n);
  },
  _isFAQ(n) {
    return /\b(app|ung dung|tuyen dung|xin viec|chu quan|sang lap|chi nhanh|an chay|giao hang|ship|thu cung|pet|hut thuoc|dat tiec|hoa don|take away)\b/.test(n);
  },
  _isPrice(n) { return /\b(gia|bao nhieu|nhieu tien|bao tien|may k|nghin)\b/.test(n); },
  _isSeat(n) {
    return /\b(cho (ngoi|nao|tot|dep|yen|trong)|con cho|ngoi (dau|o)|co (cho|ban)|ban nao|phong (hop|nhom)|dat cho|tim cho|can cho|muon ngoi)\b/.test(n)
      || /\b(cho|ban|phong)\b.*\b(nguoi|yen tinh|view|ngoai troi|cua so|may chieu)\b/.test(n);
  },
  _isDrink(n) {
    return /\b(menu|thuc don|do uong|uong gi|mon gi|goi y|nen uong|mon nao|tu van|de xuat|re nhat|dat nhat|combo|khuyen mai)\b/.test(n);
  },

    _entities(norm) {
    const e = {};
    const seats = norm.match(/\b[a-d]\d{1,2}\b/g);
    if (seats) e.seatIds = seats.map(s => s.toUpperCase());
    
    const orders = norm.match(/\bod\d{3,4}\b/g);
    if (orders) e.orderIds = orders.map(s => s.toUpperCase());
    
    const bks = norm.match(/\bbk\d{3,4}\b/g);
    if (bks) e.bookingIds = bks.map(s => s.toUpperCase());
    
    const mids = norm.match(/\bm\d{3}\b/g);
    if (mids) e.menuIds = mids.map(s => s.toUpperCase());
    
    const guests = norm.match(/\b(\d{1,2}|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s*(nguoi|ng|khach)\b/);
    if (guests) {
      const w = { mot:1, hai:2, ba:3, bon:4, nam:5, sau:6, bay:7, tam:8, chin:9, muoi:10 };
      e.guests = w[guests[1]] || parseInt(guests[1], 10);
    }

    // ⚡ FIX TRIỆT ĐỂ: Không khớp số người thành giờ, có chặn Edge Case
    // ⚡ FIX FINAL: Thêm \d* để chặn cả trường hợp "4 gio 30 nguoi"
    const timeMatch =
      norm.match(/\b(\d{1,2})\s*(?::|h|gio)\s*(\d{2})?\b(?!\s*\d*\s*(?:nguoi|ng|khach)\b)/) ||
      norm.match(/\b(\d{1,2})\s+(\d{2})\b/);  // Regex 2 bỏ lookahead

if (timeMatch) {
  const h = parseInt(timeMatch[1], 10);
  const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
    e.time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
    
    if (/\b(tret|tang 1|f1)\b/.test(norm)) e.floor = 'F1';
    else if (/\b(lau 1|tang 2|f2)\b/.test(norm)) e.floor = 'F2';
    else if (/\b(lau 2|tang 3|f3)\b/.test(norm)) e.floor = 'F3';
    else if (/\b(thuong|san thuong|tang 4|f4)\b/.test(norm)) e.floor = 'F4';
    
    if (/\b(yen tinh|hoc|lam viec)\b/.test(norm)) e.zone = 'quiet';
    else if (/\b(cua so|view)\b/.test(norm)) e.zone = 'window';
    else if (/\b(nhom|hop)\b/.test(norm)) e.zone = 'group';
    
    return e;
  }
};

window.AIInput = AIInput;