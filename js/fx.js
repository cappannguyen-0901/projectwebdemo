/* ============================================================
   FX — hiệu ứng giao diện CAPPAN (đi cùng theme.css)
   Không đụng vào logic nghiệp vụ; tắt toàn bộ khi người dùng bật "giảm chuyển động".
============================================================ */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;
  const startedAt = performance.now();
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const pageName = () => document.body.dataset.page || '';
  const isStaff = () => pageName().startsWith('staff-');

  if (!reduce) root.classList.add('fx-ready');

  /* ---------- 1. HEADER + THANH TIẾN ĐỘ CUỘN ---------- */
  function initScroll() {
    const header = $('.app-header');
    const bar = document.createElement('div');
    bar.className = 'fx-progress';
    document.body.appendChild(bar);
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > 24);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- 2. HIỆN DẦN KHI CUỘN (scroll reveal) ---------- */
  /* always: render lại do người dùng thao tác (đổi tab, lọc) → luôn animate
     early : khối bị vẽ lại định kỳ (dashboard, tracking) → chỉ animate lúc mới vào trang */
  const REVEAL_ALWAYS = '.section-title, .section-sub, .floor-card, .highlight-card, .menu-card, .contact-card, .history-card, .cart-item, .voucher-card, .profile-header, .auth-card, .contact-form-wrap, .contact-map-wrap, .floor-summary-content';
  const REVEAL_EARLY  = '.stat-card, .staff-panel, .order-tracking-card, .order-card, .schedule-wrapper, .ai-card';
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      el.classList.add('fx-in');
      setTimeout(() => el.classList.remove('fx-reveal', 'fx-in'), 1100);   // trả lại transform cho hiệu ứng hover
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;

  function scanReveal() {
    if (reduce || !io) return;
    const early = performance.now() - startedAt < 2500;
    const sel = REVEAL_ALWAYS + (early ? ', ' + REVEAL_EARLY : '');
    $$(sel).forEach(el => {
      if (el._fx) return;
      el._fx = true;
      const sibs = Array.from(el.parentElement ? el.parentElement.children : []).filter(c => c.matches(sel));
      const i = Math.max(0, sibs.indexOf(el));
      el.style.setProperty('--fx-delay', Math.min(i, 9) * 70 + 'ms');
      el.classList.add('fx-reveal');
      io.observe(el);
    });
  }

  /* ---------- 3. NGHIÊNG 3D + ÁNH SÁNG TRÊN THẺ ---------- */
  function initTilt() {
    if (reduce || !finePointer) return;
    const SEL = '.floor-card, .highlight-card, .menu-card';
    let raf = 0;
    document.addEventListener('mousemove', e => {
      const card = e.target.closest && e.target.closest(SEL);
      if (!card || isStaff()) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.classList.add('fx-tilt');
        card.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
    }, { passive: true });
    document.addEventListener('mouseout', e => {
      const card = e.target.closest && e.target.closest(SEL);
      if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    }, { passive: true });
  }

  /* ---------- 4. GỢN SÓNG KHI BẤM NÚT ---------- */
  function initRipple() {
    if (reduce) return;
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.btn, .btn-outline, .add-cart-btn, .floor-btn, .cat-tab, .quick-reply-btn, .confirm-yes, .confirm-no');
      if (!b || b.disabled) return;
      const r = b.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.6;
      const s = document.createElement('span');
      s.className = 'fx-ripple';
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      b.appendChild(s);
      setTimeout(() => s.remove(), 700);
    });
  }

  /* ---------- 5. ĐẾM SỐ CHẠY LÊN (thẻ thống kê) ---------- */
  const lastStat = {};
  function parseStat(txt) {
    const m = String(txt).trim().match(/^([\d.,]+)\s*(\D*)$/);
    if (!m) return null;
    const grouped = /\d\.\d{3}/.test(m[1]);
    const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? { n, suffix: m[2], grouped } : null;
  }
  function scanStats() {
    if (reduce) return;
    $$('.stat-value').forEach(el => {
      const txt = el.textContent;
      if (el.dataset.fxFinal === txt || el.dataset.fxRun) return;
      const p = parseStat(txt);
      if (!p) { el.dataset.fxFinal = txt; return; }
      const label = (el.parentElement && el.parentElement.querySelector('.stat-label'))
        ? el.parentElement.querySelector('.stat-label').textContent : el.id || txt;
      const from = lastStat[label] !== undefined ? lastStat[label] : 0;
      lastStat[label] = p.n;
      el.dataset.fxFinal = txt;
      if (from === p.n) return;
      el.dataset.fxRun = '1';
      const fmt = v => (p.grouped ? Math.round(v).toLocaleString('vi-VN') : String(Math.round(v))) + p.suffix;
      const t0 = performance.now(), dur = 1000;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(from + (p.n - from) * e);
        if (k < 1) requestAnimationFrame(step);
        else { el.textContent = txt; delete el.dataset.fxRun; }
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------- 6. TRANG CHỦ: hơi nước, bụi vàng, cuộn xuống, thanh số liệu, chữ chạy ---------- */
  function initHome() {
    if (pageName() !== 'home') return;
    const hero = $('.hero');
    if (hero && !reduce) {
      const layer = document.createElement('div');
      layer.className = 'fx-hero-layer';
      for (let i = 0; i < 9; i++) {
        const s = document.createElement('i');
        s.className = 'fx-steam';
        s.style.cssText = `left:${8 + i * 10.5 + Math.random() * 4}%;--w:${90 + Math.random() * 110}px;--h:${160 + Math.random() * 160}px;--d:${9 + Math.random() * 7}s;--delay:${-Math.random() * 12}s`;
        layer.appendChild(s);
      }
      for (let i = 0; i < 26; i++) {
        const s = document.createElement('b');
        s.className = 'fx-dust';
        s.style.cssText = `left:${Math.random() * 100}%;top:${20 + Math.random() * 70}%;--s:${2 + Math.random() * 3}px;--d:${5 + Math.random() * 7}s;--delay:${-Math.random() * 10}s`;
        layer.appendChild(s);
      }
      hero.prepend(layer);

      if (finePointer) {
        hero.addEventListener('mousemove', e => {
          const r = hero.getBoundingClientRect();
          hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
          hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        }, { passive: true });
      }

      const content = $('.hero-content', hero);
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (y > window.innerHeight) return;
        requestAnimationFrame(() => {
          if (content) {
            content.style.transform = `translateY(${y * 0.22}px)`;
            content.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.75)));
          }
        });
      }, { passive: true });

      const cue = document.createElement('button');
      cue.className = 'fx-scroll-cue';
      cue.setAttribute('aria-label', 'Cuộn xuống');
      cue.innerHTML = '<span class="fx-mouse"><i></i></span><small>Khám phá</small>';
      cue.onclick = () => { const n = hero.nextElementSibling; if (n) n.scrollIntoView({ behavior: 'smooth' }); };
      hero.appendChild(cue);
    }

    /* Thanh số liệu thật từ dữ liệu quán */
    try {
      const floors = API.floors.getAll().length;
      const seats = API.seats.getAll();
      const cap = seats.reduce((s, x) => s + x.capacity, 0);
      const drinks = API.menu.getAll().length;
      const band = document.createElement('section');
      band.className = 'fx-band';
      band.innerHTML = `
        <div class="fx-band-grid">
          <div class="fx-band-item"><b class="stat-value">${floors}</b><span>tầng · 4 trải nghiệm</span></div>
          <div class="fx-band-item"><b class="stat-value">${seats.length}</b><span>bàn &amp; phòng</span></div>
          <div class="fx-band-item"><b class="stat-value">${cap}</b><span>chỗ ngồi</span></div>
          <div class="fx-band-item"><b class="stat-value">${drinks}</b><span>món đồ uống</span></div>
        </div>`;
      if (hero) hero.after(band);
    } catch (e) { /* trang không có API → bỏ qua */ }

    /* Dải chữ chạy phía trên footer */
    try {
      const base = (KB.store.amenities || []).slice(0, 5);
      const items = [...base, 'Mở cửa ' + KB.store.hours, 'Trợ lý AI luôn sẵn sàng', 'Đặt chỗ trực quan'];
      const html = items.map(t => `<span>${t}</span>`).join('');
      const tk = document.createElement('div');
      tk.className = 'fx-ticker';
      tk.innerHTML = `<div class="fx-ticker-track">${html}${html}</div>`;
      const footer = $('.app-footer');
      if (footer) footer.before(tk);
    } catch (e) {}
  }

  /* ---------- 7. PHÁO GIẤY KHI ĐẶT BÀN / ĐẶT HÀNG THÀNH CÔNG ---------- */
  function confetti() {
    if (reduce) return;
    const c = document.createElement('canvas');
    c.className = 'fx-confetti';
    c.width = window.innerWidth; c.height = window.innerHeight;
    document.body.appendChild(c);
    const g = c.getContext('2d');
    const colors = ['#C9A227', '#F0D675', '#F5E6D3', '#6F4E37', '#2E7D32', '#fff'];
    const P = Array.from({ length: 120 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * 200, y: c.height * 0.62,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 17 - 6,
      w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
      r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      g.clearRect(0, 0, c.width, c.height);
      P.forEach(p => {
        p.vy += 0.42; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.globalAlpha = Math.max(0, 1 - t / 2200);
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      });
      if (t < 2200) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }
  window.fxConfetti = confetti;

  function hookToast() {
    const orig = window.showToast;
    if (typeof orig !== 'function') return;
    window.showToast = function (msg, color, opts) {
      const r = orig.apply(this, arguments);
      // ⚡ FIX #23: không bắn confetti khi toast được restore sau điều hướng
      const restoring = !!(opts && opts.restore);
      if (!restoring && /(Đặt bàn[\s\S]*?thành công|Đặt hàng thành công|đã giao thành công)/i.test(String(msg))) {
        confetti();
      }
      return r;
    };
  }
/* ---------- KHỞI ĐỘNG ---------- */
function boot() {
  initScroll();
  initHome();
  initTilt();
  initRipple();
  hookToast();
  scanReveal();
  scanStats();

  let queued = false;
  new MutationObserver((mutations) => {
    const relevant = mutations.some(m => {
      const t = m.target;
      return !(t.closest && t.closest('#chatBody, .chat-panel'));
    });
    
    if (!relevant || queued) return;
    queued = true;
    requestAnimationFrame(() => { 
      queued = false; 
      scanReveal(); 
      scanStats(); 
    });
  }).observe(document.body, { childList: true, subtree: true });
} // <-- Đóng hàm boot

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})(); // <-- ĐỂ Ý CHỖ NÀY: Dấu đóng của hàm ẩn danh bọc toàn bộ file (nếu có)