/* Debug panel: cache hit-rate, fuzzy matches, tier breakdown */
window.AIDebugPanel = {
  render() {
    if (typeof AIMetrics === 'undefined' || typeof ResponseCache === 'undefined') return '';
    const s = AIMetrics.summary();
    const cacheSize = ResponseCache.size();
    const total = s.total || 1;
    const hitRate = ((s.bySrc.cache + s.bySrc.kb) / total * 100).toFixed(1);
    return `
      <div class="staff-panel" style="margin-top:20px;">
        <div class="panel-header"><h3>🔍 Debug Cache & Routing</h3></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
          <div><div class="stat-label">Cache size</div><div class="stat-value" style="font-size:1.2rem;">${cacheSize}</div></div>
          <div><div class="stat-label">KB+Cache hit</div><div class="stat-value" style="font-size:1.2rem;">${hitRate}%</div></div>
          <div><div class="stat-label">Rơi xuống LLM</div><div class="stat-value" style="font-size:1.2rem;">${s.bySrc.llm}</div></div>
          <div><div class="stat-label">Dự phòng</div><div class="stat-value" style="font-size:1.2rem;">${s.bySrc.legacy}</div></div>
        </div>
      </div>`;
  }
};