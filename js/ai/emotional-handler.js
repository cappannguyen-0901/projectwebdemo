/* ============================================================
   EMOTIONAL HANDLER — Isolated 2-turn
   Không đụng LocalBrain. State lưu riêng, có sid.
============================================================ */

const EmotionalHandler = {
  EMOTION_TTL: 120000, // 2 phút để user trả lời "ok"

  /* sid → { lastEmotion, lastEmotionAt, awaitingAgreement } */
  _state: {},

  EMOTIONAL_RE: /\b(buon|chan|met|met moi|stress|kho|tam trang|that tinh|co don|tuyet vong|khoc|tui than|nang ne|kiet suc|khong on)\b/,
  DRINK_CONTEXT_RE: /\b(uong|mon|goi y|nuoc|ca phe|tra|sua|sinh to)\b/, // nếu user vừa nói về đồ uống → không phải emotional
  AGREEMENT_RE: /^(ok|oke|duoc|u|uh|vang|dong y|co|thu xem|lay di|goi y di|co chu|giup minh)\b/,

  _sid() {
    try {
      if (typeof AIBrain !== 'undefined' && AIBrain._getSessionId) return AIBrain._getSessionId();
    } catch (e) {}
    return 'guest';
  },

  _get(sid) {
    if (!this._state[sid]) this._state[sid] = { lastEmotion: null, lastEmotionAt: 0, awaitingAgreement: false };
    return this._state[sid];
  },

  /**
   * @param {string} input
   * @param {string} sid - optional, mặc định dùng AIBrain._getSessionId()
   * @returns {boolean}
   */
  canHandle(input, sid) {
    const s = this._get(sid || this._sid());
    const norm = (typeof normVN === 'function') ? normVN(input) : String(input).toLowerCase();

    // Trường hợp 1: user đang trong lượt 2 (đã đồng ý sau emotional)
    if (s.awaitingAgreement && Date.now() - s.lastEmotionAt < this.EMOTION_TTL) {
      if (this.AGREEMENT_RE.test(norm.trim())) return true;
    }

    // Trường hợp 2: user vừa nói emotional mới (không có drink context)
    if (this.EMOTIONAL_RE.test(norm) && !this.DRINK_CONTEXT_RE.test(norm)) {
      return true;
    }

    return false;
  },

  /**
   * @param {string} input
   * @param {string} sid
   * @returns {{ text: string, intent: string, confidence: number, cards?: string }}
   */
  handle(input, sid) {
    const s = this._get(sid || this._sid());
    const norm = (typeof normVN === 'function') ? normVN(input) : String(input).toLowerCase();

    // Nếu đang chờ agreement và user đồng ý → gợi ý món ngọt
    if (s.awaitingAgreement && Date.now() - s.lastEmotionAt < this.EMOTION_TTL && this.AGREEMENT_RE.test(norm.trim())) {
      s.awaitingAgreement = false;
      s.lastEmotionAt = 0;
      return this._buildSweetRecommendation();
    }

    // Nếu user vừa nói emotional mới → an ủi, set state
    s.lastEmotion = 'sad';
    s.lastEmotionAt = Date.now();
    s.awaitingAgreement = true;

    return {
      intent: 'emotional',
      text: 'Dạ em nghe anh/chị chia sẻ và hiểu cảm giác lúc này thật khó tả. '
          + 'Nếu anh/chị muốn, em có thể gợi ý vài món ấm áp hoặc ngọt dịu giúp thư giãn. '
          + 'Anh/chị có muốn em gợi ý không ạ?',
      confidence: 0.9
    };
  },

  _buildSweetRecommendation() {
    // Lấy 3 món ngọt từ LB_TAGS nếu có
    let picks = [];
    if (typeof LB_TAGS !== 'undefined' && typeof API !== 'undefined') {
      picks = API.menu.getAvailable()
        .filter(m => (LB_TAGS[m.id] || []).includes('ngot'))
        .slice(0, 3);
    }
    if (!picks.length && typeof API !== 'undefined') {
      picks = API.menu.getAvailable().slice(0, 3);
    }

    if (!picks.length) {
      return {
        intent: 'emotional_agreement',
        text: 'Dạ em hiện chưa có gợi ý phù hợp ạ. Anh/chị xem menu ở mục "Đặt nước" nhé!',
        confidence: 0.85
      };
    }

    const items = picks.map(m => ({
      id: m.id, name: m.name, price: m.price, inStock: m.inStock,
      badge: m.badge, reason: 'Ngọt dịu, xoa dịu tâm trạng'
    }));

    const cardJson = JSON.stringify({
      title: 'Gợi ý xoa dịu tâm trạng',
      total: items.length,
      items
    });

return {
  intent: 'emotional_agreement',
  text: 'Dạ em gợi ý mấy món ngọt ngào, đậm vị giúp anh/chị khuây khỏa tâm trạng nhé:',
  cards: `[UI_MENU]${cardJson}[/UI_MENU]`,
  recommendationData: { title: 'Gợi ý xoa dịu tâm trạng', items },
  confidence: 0.95
};
  },

  reset(sid) {
    const key = sid || this._sid();
    delete this._state[key];
  },

  resetAll() {
    this._state = {};
  }
};

window.EmotionalHandler = EmotionalHandler;