/* ============================================================
   MULTI-INTENT SPLITTER — Tách câu đa ý định
   Cách C (pattern first): Pattern split trước, nếu fail → single intent
   Không gọi LLM ở đây (brain.js tự dispatch sub-intent qua LLM nếu cần)
============================================================ */

const MultiIntentSplitter = {
  /* Confidence tối thiểu để trigger multi-intent dispatch */
  MIN_CONFIDENCE: 0.7,

  /* Từ nối = ranh giới sub-intent */
  SEPARATORS: [
    /\s+và\s+/i,
    /\s+với\s+/i,
    /\s+còn\s+/i,
    /\s+nhưng\s+/i,
    /\s*,\s*/,
    /\s+à\s+/i,
    /\s+nhỉ\s+/i
  ],

  /* Ngăn cách giả — KHÔNG phải ranh giới multi-intent */
  FALSE_SEPARATOR_PATTERNS: [
    /\bso sánh\s+.+\s+và\s+/i,          // "so sánh A và B" là 1 intent
    /\b(trà|sinh tố|cà phê|nước ép)\s+.+\s+và\s+\w+/i,  // tên món ghép
    /\b(đặt|book)\s+.+\s+và\s+nhận\b/i, // "đặt và nhận" là 1 flow
  ],

  /* Signal detection để quyết định có split không */
  MULTI_SIGNALS: {
    verbs: /\b(đặt|gợi ý|tìm|so sánh|hỏi|kiểm tra|xem|hủy|đổi|gửi|thanh toán|mua|đặt lại)\b/gi,
    entities: /\b(bàn|món|chỗ|đơn|booking|người|giờ|tầng|doanh thu|nhân viên|ca|menu)\b/gi
  },

  /**
   * @param {string} input
   * @param {string} role — 'customer' | 'staff'
   * @returns {Promise<{ subInputs: string[], isMultiIntent: boolean, confidence: number, reason: string }>}
   */
  async split(input, role = 'customer') {
    const text = String(input || '').trim();
    if (!text || text.length < 5) {
      return { subInputs: [text], isMultiIntent: false, confidence: 1, reason: 'too_short' };
    }

    /* 1. False separator — nếu match, không split */
    for (const re of this.FALSE_SEPARATOR_PATTERNS) {
      if (re.test(text)) {
        return { subInputs: [text], isMultiIntent: false, confidence: 0.9, reason: 'false_separator' };
      }
    }

    /* 2. Signal count — ít nhất 2 verb hoặc 2 entity */
    const verbCount = (text.match(this.MULTI_SIGNALS.verbs) || []).length;
    const entityCount = (text.match(this.MULTI_SIGNALS.entities) || []).length;
    const signalScore = Math.min(verbCount, 2) * 0.5 + Math.min(entityCount, 3) * 0.2;

    if (verbCount < 2 && entityCount < 2) {
      return { subInputs: [text], isMultiIntent: false, confidence: 0.9, reason: 'single_signal' };
    }

    /* 3. Pattern split */
    const patternSplit = this._patternSplit(text);
    if (patternSplit.length >= 2 && patternSplit.every(s => s.length >= 4)) {
      const confidence = Math.min(0.95, 0.6 + signalScore * 0.15);
      return {
        subInputs: patternSplit,
        isMultiIntent: true,
        confidence,
        reason: 'pattern_split'
      };
    }

    /* 4. Fallback: không split được — để brain.js dispatch như 1 câu */
    return { subInputs: [text], isMultiIntent: false, confidence: 0.5, reason: 'no_split_available' };
  },

  _patternSplit(text) {
    let parts = [text];

    for (const sep of this.SEPARATORS) {
      const newParts = [];
      for (const p of parts) {
        if (sep.test(p)) {
          const split = p.split(sep).map(s => s.trim()).filter(s => s.length >= 4);
          if (split.length >= 2) { newParts.push(...split); continue; }
        }
        newParts.push(p);
      }
      parts = newParts;
    }

    /* Gộp mảnh quá ngắn vào mảnh trước */
    const merged = [];
    for (const p of parts) {
      if (p.length < 4 && merged.length > 0) merged[merged.length - 1] += ' ' + p;
      else merged.push(p);
    }
    return merged;
  }
};

window.MultiIntentSplitter = MultiIntentSplitter;