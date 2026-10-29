/* staff.html — Bước C: bảng điều hành nhân viên (mọi số liệu qua await api.*, FACADE là nguồn sự thật).
   GATE: role==='staff' — DEMO-GRADE, chỉ client-side (DECISIONS.md); backend thật sẽ chặn 403 server-side. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');
const state = document.getElementById('state');

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
const STEP_LABEL = ['Chờ xử lý', 'Đang pha', 'Lên xe', 'Đang giao', 'Hoàn tất'];

/* 7 ngày tới cho lịch ca: YYYY-MM-DD + nhãn Thứ/n-ngày */
function next7() {
  const out = [];
  const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const base = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const p = (n) => String(n).padStart(2, '0');
    out.push({
      key: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      label: i === 0 ? 'Hôm nay' : i === 1 ? 'Mai' : names[d.getDay()],
      dom: `${d.getDate()}/${d.getMonth() + 1}`
    });
  }
  return out;
}

async function paint(tab = 'orders') {
  if (!user || user.role !== 'staff') {
    renderHeader(document.getElementById('hdr'), { user });
    state.remove();
    main.innerHTML = `
      <div class="panel">
        <h2>🔒 Khu vực dùng nội bộ</h2>
        <p>Trang này cần tài khoản <b>nhân viên</b>. Hãy <a href="auth.html">đăng nhập</a> bằng SĐT nhân viên demo: <code>0900000002</code> / <code>cappan123</code>.</p>
      </div>`;
    return;
  }
  try {
    const [statsToday, occ, byStatus, orders, bookings, menu, staffList, shiftDefs, schedule] =
      await Promise.all([
        api.stats.today(),
        api.stats.occupancyRate(),
        api.stats.ordersByStatus(),
        api.orders.getAll(),
        api.bookings.getAll(),
        api.menu.getAll(),
        api.staff.getAll(),
        api.shifts.getAll(),
        api.shifts.getSchedule()
      ]);
    renderHeader(document.getElementById('hdr'), { user });
    const active = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');

    const sec = {
      orders: panelOrders(active, orders),
      tables: panelTables(bookings, occ),
      menu: panelMenu(menu),
      shifts: panelShifts(next7(), shiftDefs, schedule, staffList)
    };

    main.innerHTML = `
      <h2>📋 Bảng điều hành — ${esc(user.name)}</h2>
      <div class="kpis">
        <div class="kpi"><div class="v">${api.utils.formatVND(statsToday.total)}</div><div class="l">Doanh thu hôm nay</div></div>
        <div class="kpi"><div class="v">${statsToday.completedCount}/${statsToday.count}</div><div class="l">Đơn hoàn tất / tất cả</div></div>
        <div class="kpi"><div class="v">${occ}%</div><div class="l">Ghế đang được dùng</div></div>
        <div class="kpi"><div class="v">${byStatus.pending + byStatus.preparing + byStatus.shipping}</div><div class="l">Đơn đang chạy</div></div>
      </div>
      <div class="tabs">
        <button data-tab="orders" class="${tab === 'orders' ? 'active' : ''}">🧾 Đơn (${active.length})</button>
        <button data-tab="tables" class="${tab === 'tables' ? 'active' : ''}">🪑 Bàn & đặt chỗ</button>
        <button data-tab="menu" class="${tab === 'menu' ? 'active' : ''}">☕ Menu (hết món)</button>
        <button data-tab="shifts" class="${tab === 'shifts' ? 'active' : ''}">📅 Lịch ca</button>
      </div>
      ${sec[tab]}`;

    state.remove();
    main
      .querySelectorAll('[data-tab]')
      .forEach((b) => b.addEventListener('click', () => paint(b.dataset.tab)));
    bindOrders(active);
    bindTables(bookings);
    bindMenu();
    bindShifts(schedule, staffList);
  } catch (e) {
    state.remove();
    main.innerHTML = `<div class="panel"><div class="err">Lỗi tải hub: ${esc(e.message)}</div></div>`;
  }

  /* ---- panel render (tách hàm thuần ở Bước E nếu cần test) ---- */
  function panelOrders(active, all) {
    return `<div class="panel"><h3>🧾 Đơn đang chạy</h3>${
      active.length
        ? active
            .map((o) => {
              const step = Math.max(o.step, 0);
              return `<div class="hist-row">
            <div><div><b>${esc(o.id)}</b> ${esc(o.customerName || 'Khách')} · ${api.utils.formatVND(o.total)}</div>
            <div class="det">${esc(o.items.map((l) => `${l.name}×${l.qty}`).join(', '))} · ${esc(o.address)}</div></div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="pill ${esc(o.status)}">${STEP_LABEL[step] || esc(o.status)}</span>
              ${o.step < 4 && o.step >= 0 ? `<button class="btn small" data-next="${esc(o.id)}">▶ ${STEP_LABEL[step + 1] || '✓'}</button>` : ''}
              ${o.step <= 1 && o.step >= 0 ? `<button class="btn danger small" data-hcancel="${esc(o.id)}">Hủy</button>` : ''}
            </div></div>`;
            })
            .join('')
        : '<p class="muted-empty">Không có đơn nào đang chạy.</p>'
    }${
      all.filter((o) => o.status !== 'cancelled').length
        ? `<p class="det" style="margin-top:8px">Cả ngày: hoàn tất ${api.utils.formatVND(all.filter((o) => o.step >= 4 && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0))} · tất cả ${all.length} đơn</p>`
        : ''
    }</div>`;
  }

  function panelTables(bookings, occ) {
    const confirmed = bookings.filter((b) => b.status === 'confirmed');
    return `<div class="panel"><h3>🪑 Đặt chỗ hiệu lực (${confirmed.length} · ghế bận ${occ}%)</h3>${
      confirmed.length
        ? confirmed
            .map(
              (b) => `<div class="hist-row">
          <div><b>${esc(b.seatId)}</b> · ${esc(b.date)} ${esc(b.time)} · ${b.guests} khách ${b.userId ? `· user ${esc(b.userId.slice(0, 6))}` : ''}</div>
          <div style="display:flex;gap:6px">
            <button class="btn small" data-bdone="${esc(b.id)}">Khách đến rồi</button>
            <button class="btn danger small" data-bcancel="${esc(b.id)}">Hủy</button>
          </div></div>`
            )
            .join('')
        : '<p class="muted-empty">Chưa có đặt chỗ nào hiệu lực.</p>'
    }</div>`;
  }

  function panelMenu(menu) {
    return `<div class="panel"><h3>☕ Món — bật/tắt "hết món"</h3>
      <table class="grid-table"><thead><tr><th>Món</th><th>Giá</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${menu
        .map(
          (m) => `<tr>
        <td>${esc(m.name)}</td><td>${api.utils.formatVND(m.price)}</td>
        <td>${m.inStock ? '<span class="pill">Còn</span>' : '<span class="pill cancelled">Hết món</span>'}</td>
        <td><button class="btn small ghost" data-stock="${esc(m.id)}" data-next-stock="${m.inStock ? '0' : '1'}">${m.inStock ? 'Đánh dấu hết' : 'Mở lại'}</button></td>
      </tr>`
        )
        .join('')}
      </tbody></table></div>`;
  }

  function panelShifts(days, shiftDefs, schedule, staffList) {
    return `<div class="panel"><h3>📅 Lịch ca 7 ngày tới</h3><table class="grid-table">
      <thead><tr><th>Ngày</th>${shiftDefs.map((s) => `<th style="color:${esc(s.color)}">${esc(s.name)}<br><small>${esc(s.start)}–${esc(s.end)}</small></th>`).join('')}</tr></thead>
      <tbody>${days
        .map(
          (d) => `<tr><td><b>${esc(d.label)}</b><br><small>${esc(d.dom)}</small></td>
        ${shiftDefs
          .map((s) => {
            const ids = schedule[d.key]?.[s.id] || [];
            return `<td>${ids.length ? `${esc(ids.map((id) => staffList.find((x) => x.id === id)?.avatar || '?').join(''))} <button class="btn small ghost" data-unshift="${esc(d.key)}" data-shift="${esc(s.id)}">✕ bỏ hết</button>` : `<button class="btn small ghost" data-fillshift="${esc(d.key)}" data-shift="${esc(s.id)}">+ xếp người</button>`}</td>`;
          })
          .join('')}</tr>`
        )
        .join('')}</tbody></table>
      <p class="det" style="margin-top:8px">Nhân viên: ${esc(staffList.map((s) => `${s.avatar} ${s.name} (${esc(s.role)})`).join(' · '))} · luật 1 ca/ngày (trùng ca → CONFLICT từ facade)</p></div>`;
  }

  /* ---- binds ---- */
  function bindOrders(active) {
    main.querySelectorAll('[data-next]').forEach((b) =>
      b.addEventListener('click', async () => {
        const o = active.find((x) => x.id === b.dataset.next);
        try {
          await api.orders.updateStep(o.id, o.step + 1);
          toast(o.step + 1 === 4 ? '✓ Đơn hoàn tất' : '➡ Bước kế: ' + STEP_LABEL[o.step + 1]);
          paint('orders');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
    main.querySelectorAll('[data-hcancel]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api.orders.cancel(b.dataset.hcancel);
          toast('Đã hủy đơn');
          paint('orders');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
  }
  function bindTables() {
    main.querySelectorAll('[data-bdone]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api.bookings.complete(b.dataset.bdone);
          toast('✓ Đã hoàn tất đặt chỗ, ghế được trả');
          paint('tables');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
    main.querySelectorAll('[data-bcancel]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api.bookings.cancel(b.dataset.bcancel);
          toast('Đã hủy đặt chỗ');
          paint('tables');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
  }
  function bindMenu() {
    main.querySelectorAll('[data-stock]').forEach((b) =>
      b.addEventListener('click', async () => {
        const next = b.dataset.nextStock === '1';
        try {
          if (next) await api.menu.markInStock(b.dataset.stock);
          else await api.menu.markOutOfStock(b.dataset.stock);
          paint('menu');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
  }
  function bindShifts(schedule, staffList) {
    main.querySelectorAll('[data-fillshift]').forEach((b) =>
      b.addEventListener('click', async () => {
        /* xếp người rảnh nhất: đầu tiên chưa có ca ngày đó */
        try {
          const s = await api.shifts.getSchedule();
          const day = s[b.dataset.fillshift] || {};
          const busy = new Set(Object.values(day).flat());
          const candidate = staffList.find((x) => !busy.has(x.id));
          if (!candidate) return toast('Mọi người đều có ca ngày này', 'err');
          await api.shifts.addStaffToShift(b.dataset.fillshift, b.dataset.shift, candidate.id);
          toast(`✓ Đã xếp ${candidate.name} vào ${b.dataset.shift}`);
          paint('shifts');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
    main.querySelectorAll('[data-unshift]').forEach((b) =>
      b.addEventListener('click', async () => {
        /* bug #5: nút "bỏ hết" ca thiếu try/catch — nếu driver lỗi, lỗi dội ầm cả trang */
        try {
          const s = await api.shifts.getSchedule();
          for (const id of s[b.dataset.unshift]?.[b.dataset.shift] || []) {
            await api.shifts.removeStaffFromShift(b.dataset.unshift, b.dataset.shift, id);
          }
          toast('Đã bỏ lịch ca');
          paint('shifts');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
  }
}

paint();
