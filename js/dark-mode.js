/* ============================================================
   DARK MODE — unified. Nguồn duy nhất quản lý data-theme.
   `main.js` không còn initTheme/toggleDarkMode/updateThemeIcon.
============================================================ */
(function () {
  const KEY = 'cappan_theme';
  const root = document.documentElement;

  const get = () => {
    try {
      return localStorage.getItem(KEY) ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch { return 'light'; }
  };

  const apply = (mode) => {
    if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else root.setAttribute('data-theme', 'light');
    const btns = document.querySelectorAll('.theme-toggle');
    btns.forEach(btn => { btn.textContent = mode === 'dark' ? '☀️' : '🌙'; });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#1a1410' : '#2A1A14');
  };

  const toggle = () => {
    const next = get() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch {}
    apply(next);
    document.dispatchEvent(new CustomEvent('cappan:theme-changed', { detail: { mode: next } }));
  };

  window.getTheme = get;
  window.toggleTheme = toggle;
  window.toggleDarkMode = toggle;
  window.updateThemeIcon = (isDark) => {
    const btns = document.querySelectorAll('.theme-toggle');
    btns.forEach(btn => { btn.textContent = isDark ? '☀️' : '🌙'; });
  };

  document.addEventListener('DOMContentLoaded', () => {
    apply(get());
    const userArea = document.getElementById('userArea');
    if (userArea && !document.getElementById('themeToggle')) {
      const btn = document.createElement('button');
      btn.id = 'themeToggle';
      btn.type = 'button';
      btn.title = 'Chuyển sáng/tối';
      btn.className = 'theme-toggle';
      btn.onclick = toggle;
      btn.textContent = get() === 'dark' ? '☀️' : '🌙';
      userArea.appendChild(btn);
    }
  });

  window.addEventListener('storage', (e) => { if (e.key === KEY) apply(get()); });
})();