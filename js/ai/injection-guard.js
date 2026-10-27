/* ============================================================
   INJECTION GUARD — Chặn prompt injection
   Cách C (hybrid): ≥2 patterns → block, 1 pattern → warn (log)
   Chạy 2 điểm: input (user) + tool output (trước khi trả LLM)
   Không đụng LocalBrain/AIBrain — chỉ pre/post-processing
============================================================ */

const InjectionGuard = {
  /* Ngưỡng: 2+ patterns → block, 1 pattern → warn */
  THRESHOLD_BLOCK: 2,
  THRESHOLD_LOG: 1,

  /* ─── Patterns INPUT (user message) ─── */
  PATTERNS: [
    /* English: ignore/forget previous instructions */
    /\b(ignore|ign0re|disregard|forget)\s+(all\s+)?(previous|prev1ous|above|earlier)\s+(instructions?|directives?|prompts?|rules?)/i,
    /* English: system prompt / jailbreak / role-play */
    /\b(system\s*prompt|jailbreak|you\s+are\s+now|pretend\s+you|act\s+as\s+if|roleplay\s+as)\b/i,
    /* English: reveal system prompt */
    /\b(reveal|show|print|leak|dump)\s+(your\s+)?(system|initial|original)\s+(prompt|instructions?)/i,
    /* English: DAN/developer mode */
    /\b(DAN\s+mode|developer\s+mode|admin\s+mode|god\s+mode)\b/i,
    /* Vietnamese: bỏ qua mọi hướng dẫn */
    /\b(bỏ\s+qua|bo\s+qua|quên|quen)\s+(mọi|moi|tất\s+cả|tat\s+ca|những|nhung)\s+(hướng\s+dẫn|huong\s+dan|chỉ\s+dẫn|chi\s+dan|lệnh|lenh|quy\s+tắc|quy\s+tac)/i,
    /* Vietnamese: giả vờ / đóng vai */
    /\b(giả\s+vờ|gia\s+vo|đóng\s+vai|dong\s+vai)\s+(như|là|la)\b/i,
    /* Leetspeak / homoglyph */
    /1gn[o0]r[e3]\s+[a@]ll/i,
    /pr[e3]v[i1][o0]us\s+[i1]nstruct/i,
    /syst[e3]m\s+pr[o0]mpt/i,
  ],

  /* ─── Patterns OUTPUT (tool result) — nhẹ hơn, không block nếu 1 match ─── */
  OUTPUT_PATTERNS: [
    /\b(ignore|disregard)\s+(all\s+)?(previous|above)\s+instructions?\b/i,
    /\byou\s+are\s+now\s+(in\s+)?(a\s+)?(new|different|admin)\s+mode\b/i,
    /\bsystem\s*:\s*override\b/i,
    /\b(bỏ\s+qua|bo\s+qua)\s+(mọi|moi)\s+(hướng\s+dẫn|huong\s+dan)\b/i,
    /<\|(im_start|im_end|system|user|assistant)\|>/i,
  ],

  /**
   * Check user input trước khi xử lý
   * @param {string} input
   * @returns {{ blocked: boolean, matched: string[], score: number, action: 'allow'|'warn'|'block' }}
   */
  checkInput(input) {
    const text = String(input || '');
    if (!text) return { blocked: false, matched: [], score: 0, action: 'allow' };

    const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matched = [];

    for (const re of this.PATTERNS) {
      if (re.test(text) || re.test(normalized)) matched.push(re.source.slice(0, 50));
    }

    const score = matched.length;
    const action = score >= this.THRESHOLD_BLOCK ? 'block'
                 : score >= this.THRESHOLD_LOG   ? 'warn'
                 : 'allow';

    if (score > 0) {
      console.warn(`[InjectionGuard] ${action.toUpperCase()} — input="${text.slice(0, 60)}" — matched=${score}`);
      try {
        if (typeof AIMetrics !== 'undefined') {
          AIMetrics.log({
            t: new Date().toISOString(),
            role: (typeof AIBrain !== 'undefined' && AIBrain._getRole) ? AIBrain._getRole() : 'unknown',
            q: text.slice(0, 90),
            source: 'injection_' + action,
            intent: 'injection_attempt',
            ms: 0, tools: [],
            error: matched.slice(0, 3).join(' | ')
          });
        }
      } catch (e) {}
    }

    return { blocked: action === 'block', matched, score, action };
  },

  /**
   * Check tool output TRƯỚC khi trả LLM
   * @param {*} output — object/array/string
   * @returns {{ suspicious: boolean, matched: string[] }}
   */
  checkToolOutput(output) {
    if (!output) return { suspicious: false, matched: [] };
    let text = '';
    try { text = typeof output === 'string' ? output : JSON.stringify(output); }
    catch { return { suspicious: false, matched: [] }; }
    if (!text || text.length > 50000) return { suspicious: false, matched: [] };

    const matched = [];
    for (const re of this.OUTPUT_PATTERNS) if (re.test(text)) matched.push(re.source.slice(0, 50));

    if (matched.length > 0) {
      console.warn(`[InjectionGuard] Tool output suspicious — matched=${matched.length} — ${matched.join(' | ')}`);
      try {
        if (typeof AIMetrics !== 'undefined') {
          AIMetrics.log({
            t: new Date().toISOString(), role: 'system',
            q: '[TOOL_OUTPUT_CHECK]', source: 'injection_tool_output',
            intent: 'injection_attempt', ms: 0, tools: [],
            error: matched.slice(0, 2).join(' | ')
          });
        }
      } catch (e) {}
    }

    return { suspicious: matched.length > 0, matched };
  },

  /**
   * Sanitize tool output: xóa tag injection trước khi cho LLM đọc
   * @param {*} output
   * @returns {*} cleaned output (giữ nguyên structure)
   */
  sanitizeToolOutput(output) {
    if (output == null) return output;
    if (typeof output === 'string') return output.replace(/<\|.*?\|>/g, '');
    if (Array.isArray(output)) return output.map(x => this.sanitizeToolOutput(x));
    if (typeof output === 'object') {
      const clean = {};
      for (const k of Object.keys(output)) clean[k] = this.sanitizeToolOutput(output[k]);
      return clean;
    }
    return output;
  }
};

window.InjectionGuard = InjectionGuard;