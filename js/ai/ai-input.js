/* ============================================================
   AI INPUT LAYER v5.0 — ULTRA SMART PREPROCESSOR
   Taste vs Menu Name | Health Awareness | Multi-Intent Split
   Time fix: 7h tối->19:00, 8h sáng->08:00 | vs/,&/; -> split
============================================================ */

const AI_INPUT_CONFIG = { MAX_LEN: 500, BLOCK_LEN: 2000, LANGS: ['vi', 'en'] };

const AI_INPUT_INTENTS = {
  KB_STATIC: 'kb_static', KB_FAQ: 'kb_faq',
  SEAT_QUERY: 'seat_query', DRINK_QUERY: 'drink_query', PRICE_QUERY: 'price_query',
  ACTION_WRITE: 'action_write', DATA_QUERY: 'data_query',
  GREETING: 'greeting', THANKS: 'thanks', CANCEL: 'cancel',
  RECO_QUERY: 'reco_query', HEALTH_FIT: 'health_fit', COMPARE: 'compare',
  BOOKING_FLOW: 'booking_flow', ORDER_FLOW: 'order_flow',
  UNKNOWN: 'unknown',
};

const AI_INPUT_LEX = {
  taste: ['chua', 'ngot', 'dam', 'beo', 'thanh mat', 'chua chua', 'mat lanh', 'it ngot', 'nhe nhang', 'dau', 'dang', 'cay', 'man'],
  health: ['dau da day', 'kho ngu', 'tieu duong', 'mang thai', 'khong uong duoc cafein', 'tranh cafein', 'an kieng', 'giam duong', 'di ung'],
  splitters: [' va ', ' roi ', ' sau do ', ' cung ', ' vs ', ' + ', ' hoac ', ' hay '],
  avoidTasteAsName: ['tim', 'tim kiem', 'tim mon', 'co mon', 'ban co', 'co ban']
};

const AIInput = {
  normalize(raw) {
    const s = String(raw ?? '').trim();
    const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s);
    let norm = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^\p{L}\p{N}<: ]/gu, ' ').replace(/\s+/g, ' ').trim();
    norm = norm.replace(/\bko\b/g, 'khong').replace(/\bk\b/g, 'khong').replace(/\bdc\b/g, 'duoc')
      .replace(/\bsdt\b/g, 'so dien thoai').replace(/\btks\b|\btk\b|\bthx\b/g, 'cam on')
      .replace(/\bwfi\b|\bwif\b|\bwf\b/g, 'wifi').replace(/\bcf\b|\bcafe\b|\bcaphe\b/g, 'ca phe')
      .replace(/\btrasua\b/g, 'tra sua').replace(/\bnhiu\b/g, 'bao nhieu').replace(/\bmún\b|\bmun\b/g, 'muon');
    norm = norm.replace(/\bvs\b/g, ' va ').replace(/,/g, ' va ').replace(/;/g, ' va ');
    return { raw: s, norm, hasEmoji };
  },

  detectLang(raw) {
    if (/[àáảãạăâđêôơư]/i.test(String(raw))) return 'vi';
    const tokens = String(raw).toLowerCase().split(/\s+/);
    const en = ['what','where','when','how','why','which','is','are','the','a','an','do','does','can','could','would','show','give','find','order','book','want','need'];
    return tokens.filter(t => en.includes(t)).length >= 2 ? 'en' : 'vi';
  },

  validate(raw, norm) {
    const errors = [];
    if (!raw) errors.push('empty');
    if (raw.length > AI_INPUT_CONFIG.BLOCK_LEN) errors.push('blocked_length');
    else if (raw.length > AI_INPUT_CONFIG.MAX_LEN) errors.push('too_long');
    if (!norm) errors.push('empty_norm');
    if (/\b(ignore previous|bo qua huong dan|system prompt|jailbreak|dan mode|developer mode)\b/i.test(raw)) errors.push('injection');
    return { valid: errors.length === 0, errors };
  },

  classify(norm, role) { return { intent: this._intent(norm, role), entities: this._entities(norm) }; },

  splitMulti(norm) {
    let s = ' ' + norm + ' ';
    for (const sp of AI_INPUT_LEX.splitters) s = s.split(sp).join(' |SPLIT| ');
    const parts = s.split('|SPLIT|').map(x => x.trim()).filter(x => x.length >= 3);
    return parts.length >= 2 ? parts : [];
  },

  process(raw, role) {
    const { raw: r, norm, hasEmoji } = this.normalize(raw);
    const v = this.validate(r, norm);
    const lang = this.detectLang(r);
    const { intent, entities } = this.classify(norm, role);
    const multi = this.splitMulti(norm);
    return { raw: r, norm, hasEmoji, lang, intent, entities, tokens: norm.split(' ').filter(Boolean), length: r.length, valid: v.valid, errors: v.errors, multi, isMulti: multi.length >= 2 };
  },

  _intent(norm, role) {
    if (this._isGreeting(norm)) return AI_INPUT_INTENTS.GREETING;
    if (this._isThanks(norm)) return AI_INPUT_INTENTS.THANKS;
    if (this._isCancel(norm)) return AI_INPUT_INTENTS.CANCEL;
    if (this._isHealthNeed(norm)) return AI_INPUT_INTENTS.HEALTH_FIT;
    if (this._isCompare(norm)) return AI_INPUT_INTENTS.COMPARE;
    if (/\b(diem tich luy|diem thuong|lich su mua)\b/.test(norm)) return AI_INPUT_INTENTS.DATA_QUERY;
    if (this._isActionWrite(norm, role)) return AI_INPUT_INTENTS.ACTION_WRITE;
    if (this._isDataQuery(norm, role)) return AI_INPUT_INTENTS.DATA_QUERY;
    if (this._isKBStatic(norm)) return AI_INPUT_INTENTS.KB_STATIC;
    if (this._isFAQ(norm)) return AI_INPUT_INTENTS.KB_FAQ;
    if (this._isTasteQuery(norm)) return AI_INPUT_INTENTS.RECO_QUERY;
    if (this._isSeat(norm)) return AI_INPUT_INTENTS.SEAT_QUERY;
    if (this._isBookingFlow(norm)) return AI_INPUT_INTENTS.BOOKING_FLOW;
    if (this._isOrderFlow(norm)) return AI_INPUT_INTENTS.ORDER_FLOW;
    if (this._isPrice(norm)) return AI_INPUT_INTENTS.PRICE_QUERY;
    if (this._isDrink(norm)) return AI_INPUT_INTENTS.DRINK_QUERY;
    return AI_INPUT_INTENTS.UNKNOWN;
  },

  _isGreeting(n) { return n.split(' ').length <= 4 && /^(chao|hello|hi|hey|alo|xin chao)\b/.test(n); },
  _isThanks(n) { return /\b(cam on|thanks|thank you|tks)\b/.test(n); },
  _isCancel(n) { const t = n.trim(), w = t.split(' ').filter(Boolean); if (w.length===0||w.length>6) return false; if(/^(huy|thoi|dung|bo qua|cancel)$/.test(t)) return true; if(/^dung\s+lai$/.test(t)) return true; if(/^(huy|thoi)\s+(don|booking|dat cho)/.test(t)) return true; if(/^khong\s+(can|muon|dat|huy)(\s+(nua|don|booking))?$/.test(t)) return true; return false; },
  _isHealthNeed(n) { return AI_INPUT_LEX.health.some(k=>n.includes(k)) || (/\b(khong uong duoc|tranh)\b/.test(n)&&/\b(cafein|ca phe)\b/.test(n)) || /\b(mang thai|an kieng|tieu duong)\b/.test(n); },
  _isTasteQuery(n) { if(AI_INPUT_LEX.avoidTasteAsName.some(x=>n.includes(x))) return false; if(/\b(ten mon|la gi)\b/.test(n)) return false; const hasTaste=AI_INPUT_LEX.taste.some(k=>n.includes(k)); return hasTaste && (/\b(tim|goi y|tu van|nen|phu hop)\b/.test(n)||/\b(món gì|uong gi|mon nao)\b/.test(n)); },
  _isCompare(n) { return /\b(so sanh|khac nhau gi)\b/.test(n) && /\b(va|voi)\b/.test(n); },
  _isActionWrite(n,r){ if(r!=='staff') return /\b(huy booking|huy dat cho|huy don)\b/.test(n); return /\b(danh dau het|danh dau con|reset|huy don|huy booking|hoan thanh|xep ca|phan ca)\b/.test(n); },
  _isDataQuery(n,r){ if(r==='staff') return /\b(doanh thu|don hang|booking hom nay|nhan vien|lich ca|thong ke|kpi|tra cuu khach)\b/.test(n); return /\b(don (cua )?(toi|minh)|theo doi don|shipper|lich su mua)\b/.test(n); },
  _isKBStatic(n){ return /\b(wifi|mat khau|dia chi|o dau|gio mo cua|hotline|gui xe|dau xe|bai xe|parking|thanh toan|mang ve)\b/.test(n); },
  _isFAQ(n){ return /\b(app|ung dung|tuyen dung|xin viec|chu quan|sang lap|chi nhanh|an chay|giao hang|ship|thu cung|pet|hut thuoc|dat tiec)\b/.test(n); },
  _isBookingFlow(n){ return /\b(dat ban|dat cho|giu ban|book)\b/.test(n); },
  _isOrderFlow(n){ return /\b(dat mon|goi mon|them vao gio)\b/.test(n) && !/\b(dat ban)\b/.test(n); },
  _isPrice(n){ return /\b(gia|bao nhieu tien|bao tien|gia bao nhieu)\b/.test(n); },
  _isSeat(n){ return /\b(cho (ngoi|nao|con)|con cho|dat cho|tim cho|muon ngoi)\b/.test(n)||/\b(ban|cho)\b.*\b(nguoi|yen tinh|view|nhom)\b/.test(n); },
  _isDrink(n){ return /\b(menu|thuc don|do uong|uong gi|mon gi|goi y|combo|khuyen mai)\b/.test(n); },

  _entities(norm){
    const e={};
    const seats=norm.match(/\b[a-d]\d{1,2}\b/g); if(seats) e.seatIds=[...new Set(seats.map(s=>s.toUpperCase()))];
    // ⚡ FIX: ID thực tế có dạng ODmvqq43sn73r6 (chữ thường, dài) -> dùng regex linh hoạt hơn
    const orders = norm.match(/\bod[a-z0-9]+\b/g); 
    if(orders) e.orderIds=[...new Set(orders.map(s=>s.toUpperCase()))];
    
    const bks = norm.match(/\bbk[a-z0-9]+\b/g); 
    if(bks) e.bookingIds=[...new Set(bks.map(s=>s.toUpperCase()))];
    const mids=norm.match(/\bm\d{3}\b/g); if(mids) e.menuIds=[...new Set(mids.map(s=>s.toUpperCase()))];
    const guests=norm.match(/\b(\d{1,2}|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s*(nguoi|ng|khach)\b/); if(guests){const w={mot:1,hai:2,ba:3,bon:4,nam:5,sau:6,bay:7,tam:8,chin:9,muoi:10}; e.guests=w[guests[1]]||parseInt(guests[1],10);}
    let tm=norm.match(/\b(\d{1,2}):(\d{2})\b/); if(!tm) tm=norm.match(/\b(\d{1,2})\s*(?:h|gio)\s*(\d{1,2})?\b/); if(tm){let h=parseInt(tm[1],10),m=tm[2]?parseInt(tm[2],10):0; if(/\b(toi|chieu|pm)\b/.test(norm)&&h>=1&&h<=11)h+=12; if(/\b(sang|am)\b/.test(norm)&&h===12)h=0; if(h>=0&&h<=23&&m>=0&&m<=59) e.time=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
    if(/\b(hom nay)\b/.test(norm)) e.date='today'; if(/\b(ngay mai)\b/.test(norm)) e.date='tomorrow';
    if(/\b(tret|tang 1|f1)\b/.test(norm)) e.floor='F1'; else if(/\b(lau 1|tang 2|f2)\b/.test(norm)) e.floor='F2'; else if(/\b(lau 2|tang 3|f3)\b/.test(norm)) e.floor='F3'; else if(/\b(tang 4|f4)\b/.test(norm)) e.floor='F4';
    if(/\b(yen tinh|hoc bai|lam viec)\b/.test(norm)) e.zone='quiet'; else if(/\b(cua so|view)\b/.test(norm)) e.zone='window'; else if(/\b(nhom|hop)\b/.test(norm)) e.zone='group'; else if(/\b(giua)\b/.test(norm)) e.zone='center';
    if(this._isTasteQuery(norm)) e.taste=[...new Set(AI_INPUT_LEX.taste.filter(k=>norm.includes(k)))];
    if(this._isHealthNeed(norm)){ e.health=[...new Set(AI_INPUT_LEX.health.filter(k=>norm.includes(k)))]; e.noCaffeine=/\b(khong uong duoc cafein|tranh cafein)\b/.test(norm); e.lowSugar=/\b(tieu duong|it duong|it ngot|an kieng)\b/.test(norm); }
    return e;
  }
};
window.AIInput = AIInput;
