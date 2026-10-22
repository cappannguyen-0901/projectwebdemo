/* ============================================================
   STAFF GUARD — chặn truy cập sai role, chạy NGAY khi load
============================================================ */

(function() {
  function doGuard() {
    if (typeof API === 'undefined' || !API.users) {
      return setTimeout(doGuard, 50);
    }
    const user = API.users.getCurrent();
    const path = window.location.pathname.split('/').pop();
    const isStaffPage = path.startsWith('staff-');

    // ⚡ Chặn KHÁCH vào trang staff
    if (isStaffPage && (!user || user.role !== 'staff')) {
      try {
        const t = document.getElementById('toast');
        if (t) {
          t.textContent = '🔒 Vui lòng đăng nhập nhân viên!';
          t.style.background = '#c62828';
          t.classList.add('show');
        }
      } catch (e) {}
      setTimeout(() => window.location.replace('login.html'), 500);
      return;
    }

    // ⚡ Chặn NHÂN VIÊN vào trang khách (trừ menu.html — chỉ xem)
    // ⚡ P2-4: Bỏ 'menu.html' khỏi danh sách — cho staff xem menu read-only
const customerPages = ['index.html', 'booking.html', 'order.html',
                       'cart.html', 'tracking.html', 'profile.html'];
    if (user && user.role === 'staff' && customerPages.includes(path)) {
      try {
        const t = document.getElementById('toast');
        if (t) {
          t.textContent = '⛔ Nhân viên không dùng chức năng này!';
          t.style.background = '#c62828';
          t.classList.add('show');
        }
      } catch (e) {}
      setTimeout(() => window.location.replace('staff-dashboard.html'), 500);
    }
  }
  doGuard();
})();