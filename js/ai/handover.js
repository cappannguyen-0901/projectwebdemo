/* ============================================================
   HANDOVER — Escalate to human khi khách bực bội
   FIXES:
     - Per-sid fail streak (trước global → user A fail → user B auto-escalate)
     - _state[sid] = { failStreak, lastEscalateAt }
     - reset(sid) — reset 1 session, không đụng session khác
     - observe() nhận sid param (backward compat nếu không truyền)
============================================================ */

const Handover = {
  FRUSTRATION_RE: /\b(chan|te|te qua|qua te|khong hai long|that vong|khong dang|lua dao|kho chiu|buc minh|complaint|khieu nai|complain|do qua|lam an|kinh doanh kieu)\b/,
  EXPLICIT_RE: /\b(gap nhan vien|goi nhan vien|cho gap nguoi|noi chuyen voi nguoi|hotline|staff that|human|quan ly|giam doc|noi chuyen voi quan ly)\b/,

  /* sid → { failStreak, lastEscalateAt } */
  _state: {},

  _sid() {
    try {
      if (typeof AIBrain !== 'undefined' && typeof AIBrain._getSessionId === 'function') {
        return AIBrain._getSessionId();
      }
    } catch (e) {}
    return 'guest';
  },

  _get(sid) {
    if (!this._state[sid]) this._state[sid] = { failStreak: 0, lastEscalateAt: 0 };
    return this._state[sid];
  },

  /**
   * Observe 1 lượt hội thoại
   * @param {string} userInput
   * @param {object} botResult — { type, fallback, ... }
   * @param {string} [sid] — optional, mặc định AIBrain._getSessionId()
   * @returns {object|null} — null nếu không escalate, hoặc { type, message, cards, handover: true }
   */
  observe(userInput, botResult, sid) {
    const key = sid || this._sid();
    const s = this._get(key);
    const n = (typeof normVN === 'function') ? normVN(userInput) : String(userInput || '').toLowerCase();

    /* 1. Explicit request → escalate ngay */
    if (this.EXPLICIT_RE.test(n)) {
      s.failStreak = 0;
      s.lastEscalateAt = Date.now();
      return this._escalate('explicit', userInput);
    }

    /* 2. Frustration + fail → escalate */
    const frustrated = this.FRUSTRATION_RE.test(n);
    const failed = !botResult || (botResult.type === 'text' && botResult.fallback);

    if (failed) s.failStreak++;
    else s.failStreak = 0;

    if (frustrated && s.failStreak >= 1) {
      s.failStreak = 0;
      s.lastEscalateAt = Date.now();
      return this._escalate('frustrated', userInput);
    }

    /* 3. Fail streak 3 lần liên tiếp → escalate */
    if (s.failStreak >= 3) {
      s.failStreak = 0;
      s.lastEscalateAt = Date.now();
      return this._escalate('fail_streak', userInput);
    }

    return null;
  },

  _escalate(reason, userInput) {
    const hotline = '0366 444 038';
    const hotlineHref = 'tel:0366444038';

    const desc = reason === 'explicit'
      ? 'Dạ em chuyển anh/chị đến nhân viên ngay ạ.'
      : reason === 'frustrated'
      ? 'Dạ em xin lỗi vì chưa hỗ trợ tốt. Anh/chị vui lòng gọi hotline để được hỗ trợ trực tiếp.'
      : 'Dạ em xin lỗi vì đã không hiểu đúng ý anh/chị. Anh/chị gọi hotline để được hỗ trợ trực tiếp nhé.';

    const cards = `[UI_HANDOVER]${JSON.stringify({
      title: 'Kết nối nhân viên',
      desc,
      hotline,
      hotlineHref
    })}[/UI_HANDOVER]`;

    return {
      type: 'text',
      message: `Dạ em xin lỗi vì chưa hỗ trợ được tốt nhất ạ. Anh/chị gọi hotline **${hotline}** hoặc bấm "Gọi ngay" bên dưới nhé!`,
      cards,
      handover: true,
      reason
    };
  },

  /* Reset 1 session — không đụng session khác */
  reset(sid) {
    const key = sid || this._sid();
    delete this._state[key];
  },

  /* Reset toàn bộ (dùng khi logout) */
  resetAll() {
    this._state = {};
  }
};

window.Handover = Handover;