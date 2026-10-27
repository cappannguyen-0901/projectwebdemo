/* ============================================================
   ITEM LOOKUP — Trích xuất tên món từ câu hỏi tự nhiên
   FIXES:
     - isInMenu: "trà đào" match "Trà Đào Cam Sả" (không trigger "không có")
     - suggestSimilar: scoring 2 tầng (exact + prefix)
     - extract: safety net cho empty/null input
     - Thêm safety: bỏ qua câu > 120 ký tự
============================================================ */

const ItemLookup = {
  PATTERNS: [
    // "tìm món X"
    /(?:tìm|tim|search)\s+(?:món|mon|đồ uống|do uong|nước|nuoc|ly)\s+(.+?)(?:\s+(?:giá|gia|bao nhiêu|bao nhieu|không|khong|ko|nào|nao|vậy|vay)|$)/i,
    // "có món X không"
    /(?:có|có bán|co)\s+(?:món|mon|đồ uống|do uong|nước|nuoc)\s+(.+?)\s+(?:không|khong|ko|nào|nao)/i,
    // "quán có X không"
    /(?:quán|quan)\s+(?:có|co)\s+(.+?)\s+(?:không|khong|ko|nào|nao)/i,
    // "muốn uống X"
    /(?:muốn|muon|mình muốn|minh muon)\s+(?:uống|uong|ăn|an|gọi|goi)\s+(.+?)(?:\s+(?:giá|gia|bao nhiêu|bao nhieu)|$)/i,
    // "X giá bao nhiêu"
    /^(.{3,30}?)\s+(?:giá|gia)\s+(?:bao nhiêu|bao nhieu|sao|thế nào|the nao|mấy|may|nhiêu|nhieu)/i,
    // "X bao nhiêu tiền"
    /^(.{3,30}?)\s+(?:bao nhiêu|bao nhieu)\s+(?:tiền|tien|vậy|vay|ạ|a)?\s*$/i,
  ],

  STOPWORDS: new Set([
    'gì', 'gi', 'nào', 'nao', 'vậy', 'vay', 'thế', 'the', 'đó', 'do',
    'tôi', 'toi', 'mình', 'minh', 'em', 'anh', 'chị', 'chi', 'bạn', 'ban', 'ơi', 'oi', 'ạ', 'a',
    'muốn', 'muon', 'uống', 'uong', 'ăn', 'an', 'gọi', 'goi', 'mua', 'có', 'co',
    'món', 'mon', 'đồ', 'do', 'nước', 'nuoc', 'ly', 'cốc', 'coc', 'phần', 'phan',
    'ngon', 'không', 'khong', 'ko', 'hay', 'tốt', 'tot', 'tệ', 'te', 'dở',
    'rẻ', 're', 'mắc', 'mac', 'đắt', 'dat', 'chạy', 'chay',
    'giá', 'gia', 'tiền', 'tien', 'bao', 'nhiêu', 'nhieu', 'sao',
  ]),

  NON_ITEM_RE: /\b(wifi|wi-fi|gui xe|dau xe|bai xe|parking|dia chi|hotline|email|gio mo|gio dong|gio hoat dong|app|ung dung|tuyen dung|xin viec|chinh sach|thanh toan)\b/,
  GENERIC_INDICATORS: /\b(gì|gi|nào|nao|đó|do|ké|ke|vài|vai|chút|chut)\b/i,

  extract(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 120) return null;

    for (const re of this.PATTERNS) {
      const m = trimmed.match(re);
      if (!m || !m[1]) continue;

      if (this.GENERIC_INDICATORS.test(m[1])) return { name: '', generic: true };

      let name = m[1]
        .toLowerCase()
        .replace(/\b(món|mon|đồ uống|do uong|nước|nuoc|ly|cho|tôi|toi|mình|minh|em|anh|chị|chi)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!name) continue;
      if (this.NON_ITEM_RE.test(this._norm(name))) continue;

      const tokens = name.split(' ').filter(Boolean);
      const meaningful = tokens.filter(t => {
        const normT = this._norm(t);
        return !this.STOPWORDS.has(t) && !this.STOPWORDS.has(normT) && normT.length >= 2;
      });

      if (meaningful.length === 0) return { name: '', generic: true };
      return { name: meaningful.join(' '), generic: false };
    }
    return null;
  },

  /* ⚡ FIX chính: 2-pass check
     Pass 1: exact / substring với length ≥ 3
     Pass 2: token overlap ≥ 50%
     → "trà đào" pass qua Pass 1 vì "tra dao" ⊂ "tra dao cam sa" */
  isInMenu(name) {
    if (!name) return true;
    const norm = this._norm(name);
    if (!norm) return true;

    const all = API.menu.getAll();

    // Pass 1: exact / substring
    for (const m of all) {
      const mNorm = this._norm(m.name);
      if (mNorm === norm) return true;
      if (mNorm.includes(norm) && norm.length >= 3) return true;
      if (norm.includes(mNorm) && mNorm.length >= 3) return true;
    }

    // Pass 2: token overlap ≥ 50% (EXACT match only — bỏ startsWith 2 chiều)
    const qTokens = norm.split(' ').filter(t => t.length >= 2);
    if (qTokens.length === 0) return true;

    for (const m of all) {
      const mTokens = this._norm(m.name).split(' ').filter(t => t.length >= 2);
      // ⚡ FIX G26: chỉ exact match OR prefix-match CÙNG chiều với length ≥ 4
      // Lý do: "tran"(4) bắt đầu bằng "tra"(3) nhưng là 2 âm tiết khác nghĩa
      const overlap = qTokens.filter(t =>
        mTokens.some(mt =>
          mt === t ||
          (t.length >= 4 && mt.startsWith(t))   // "trà" không match "trân"
        )
      ).length;
      if (overlap / qTokens.length >= 0.5) return true;
    }

    return false;
  },

  /* ⚡ FIX: scoring 2 tầng (exact substring + prefix) */
  suggestSimilar(name, limit = 3) {
    const norm = this._norm(name);
    const words = norm.split(' ').filter(w => w.length >= 2);
    if (words.length === 0) return API.menu.getAvailable().slice(0, limit);

    const scored = API.menu.getAll()
      .filter(m => m.inStock)
      .map(m => {
        const mNorm = this._norm(m.name);
        const mTokens = mNorm.split(' ').filter(t => t.length >= 2);
        let score = 0;
        words.forEach(w => {
          if (mNorm.includes(w)) score += 2;                                        // exact substring
          if (mTokens.some(mt => mt === w || mt.startsWith(w) || w.startsWith(mt))) score += 1;  // token-level
        });
        return { m, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return API.menu.getAvailable().slice(0, limit);
    }
    return scored.slice(0, limit).map(x => x.m);
  },

  _norm(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
};

window.ItemLookup = ItemLookup;