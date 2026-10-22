/* ============================================================
   STAFF NAV — menu dùng chung cho tất cả trang staff
============================================================ */

function renderStaffNav(activePage) {
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  const items = [
    { href: 'staff-dashboard.html', label: '📊 Tổng quan',     id: 'dashboard' },
    { href: 'staff-stats.html',     label: '📈 Thống kê',      id: 'stats' },
    { href: 'staff-ai.html',        label: '🤖 Thống kê AI',   id: 'ai' },
    { href: 'staff-orders.html',    label: '📦 Đơn hàng',      id: 'orders' },
    { href: 'staff-bookings.html',  label: '🪑 Booking',        id: 'bookings' },
    { href: 'staff-menu-manage.html', label: '☕ Quản lý menu', id: 'menu' },
    { href: 'staff-promotions.html', label: '🎁 Khuyến mãi',  id: 'promotions' },
    { href: 'staff-schedule.html',  label: '📅 Lịch ca',        id: 'schedule' }
  ];

  const listHtml = items.map(it =>
    `<li><a href="${it.href}" class="${it.id === activePage ? 'active' : ''}">${it.label}</a></li>`
  ).join('');

  // ⚡ Cập nhật: Thêm nút Dark Mode vào ngay sau khu vực user
  nav.innerHTML = `
    <ul class="nav-list">${listHtml}</ul>
    <div class="user-area" id="userArea"></div>
    <button class="theme-toggle" id="themeToggle" onclick="toggleDarkMode()" title="Chuyển chế độ Sáng/Tối">🌙</button>
  `;

  if (typeof updateUserArea === 'function') updateUserArea();
  
  // ⚡ Đồng bộ icon Sáng/Tối ngay khi render menu
  if (typeof updateThemeIcon === 'function') {
        updateThemeIcon(document.documentElement.getAttribute('data-theme') === 'dark');
  }
}