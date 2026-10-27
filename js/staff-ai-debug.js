/* ============================================================
   AIDEBUG PANEL — Panel debug AI cho staff-ai.html
   KHÔNG đụng vào window.Realtime (đã có realtime.js lo).
============================================================ */

const AIDebugPanel = {
  render() {
    return `<div id="aiDebugPanelWrap">${this._html()}</div>`;
  },

  _html() {
    const metrics = (() => {
      try { return JSON.parse(localStorage.getItem('cappan_ai_metrics') || '[]'); }
      catch { return []; }
    })();

    const slots = (typeof AI_CONFIG !== 'undefined' && AI_CONFIG._slots) ? AI_CONFIG._slots : [];
    const cool = (() => {
      try {
        const k = (typeof AI_CONFIG !== 'undefined' && AI_CONFIG.COOL_KEY) || 'cappan_ai_cool';
        return JSON.parse(sessionStorage.getItem(k) || '{}');
      } catch { return {}; }
    })();

    const now = Date.now();
    const coolRows = slots.length
      ? slots.map(s => ({
          id: s.id,
          state: (cool[s.id] || 0) > now
            ? `⏸ nghỉ ${Math.round((cool[s.id] - now) / 1000)}s`
            : '✅ sẵn sàng'
        }))
      : [{ id: '—', state: 'Chưa có slot (proxy offline?)' }];

    const last = metrics.slice(-5).reverse();
    const escFn = (typeof window.esc === 'function') ? window.esc : (s) => String(s || '');

    return `
      <div class="staff-panel" style="margin-top:24px;">
        <div class="panel-header">
          <h3>🐞 Debug AI (chỉ dev — F12 để xem chi tiết)</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn-mini-action" onclick="AI_CONFIG.reset(); AIDebugPanel.refresh(); showToast('✓ Đã reset cooldown')">Reset cooldown</button>
            <button class="btn-mini-action" onclick="ResponseCache.clear(); AIDebugPanel.refresh(); showToast('✓ Đã xóa cache')">Xóa cache</button>
            <button class="btn-mini-action delete" onclick="if(confirm('Xóa toàn bộ metrics?')){AIMetrics.clear(); AIDebugPanel.refresh(); showToast('✓ Đã xóa metrics');}">Xóa metrics</button>
          </div>
        </div>

        <div style="padding: 16px;">
          <div style="margin-bottom: 16px;">
            <strong style="display:block; margin-bottom:8px;">⚡ Slots (${slots.length})</strong>
            <table class="staff-table" style="font-size: 0.82rem; width:100%;">
              <thead><tr><th>Slot</th><th>Trạng thái</th></tr></thead>
              <tbody>
                ${coolRows.map(r => `<tr><td>${escFn(r.id)}</td><td>${r.state}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>

          <div>
            <strong style="display:block; margin-bottom:8px;">🕘 5 lượt hỏi gần nhất</strong>
            <table class="staff-table" style="font-size: 0.82rem; width:100%;">
              <thead>
                <tr><th>Giờ</th><th>Câu</th><th>Nguồn</th><th>ms</th><th>TTFT</th><th>Tools</th></tr>
              </thead>
              <tbody>
                ${last.length ? last.map(e => `
                  <tr>
                    <td>${new Date(e.t).toLocaleTimeString('vi-VN')}</td>
                    <td>${escFn(String(e.q || '').slice(0, 30))}</td>
                    <td>${escFn(e.source || '')}</td>
                    <td>${e.ms || ''}</td>
                    <td>${e.ttft != null ? e.ttft : '—'}</td>
                    <td>${(e.tools || []).map(escFn).join(', ') || '—'}</td>
                  </tr>`).join('')
                : '<tr><td colspan="6" style="text-align:center; color:#999;">Chưa có lượt hỏi nào</td></tr>'}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 16px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 6px; font-size: 0.82rem;">
            💡 <strong>Tip:</strong> Mở <strong>Console (F12)</strong> và gõ <code>AI_CONFIG.status()</code> để xem bảng slot realtime.
          </div>
        </div>
      </div>
    `;
  },

  refresh() {
    const old = document.getElementById('aiDebugPanelWrap');
    if (old) {
      const div = document.createElement('div');
      div.innerHTML = this.render();
      old.replaceWith(div.firstElementChild);
    }
  }
};

window.AIDebugPanel = AIDebugPanel;