/* booking.html — Bước B: đặt bàn thật qua facade.
   Xung đột giờ + quá sức chứa để HỢP ĐỒNG xử lý (CONFLICT/VALIDATION) — UI chỉ vẽ kết quả. */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');
const state = document.getElementById('state');
let activeFloor = null;
let pickedSeat = null;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = await api.utils.today();

async function paint(errMsg = '') {
  try {
    const floors = await api.floors.getAll();
    if (!activeFloor) activeFloor = floors[0]?.id;
    const [seats, mine] = await Promise.all([api.seats.getByFloor(activeFloor), user ? api.bookings.getByUser(user.id) : []]);
    const active = mine.filter((b) => b.status === 'confirmed');
    renderHeader(document.getElementById('hdr'), { user });

    main.innerHTML = `
      <h2>🪑 Đặt chỗ</h2>
      <div class="tabs">
        ${floors.map((f) => `<button data-floor="${f.id}" class="${f.id === activeFloor ? 'active' : ''}">${esc(f.name)}</button>`).join('')}
      </div>

      ${
        pickedSeat
          ? `<form class="panel" id="bkform">
              <h3>Bàn <strong>${esc(pickedSeat.id)}</strong> — tối đa ${pickedSeat.capacity} khách · ${esc(pickedSeat.description || '')}</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div><label for="dt">Ngày (từ ${today} trở đi)</label><input type="date" id="dt" required min="${today}" value="${today}" /></div>
                <div><label for="tm">Giờ (VD 19:30)</label><input type="time" id="tm" required value="19:00" /></div>
              </div>
              <label for="gs">Số khách (1..${pickedSeat.capacity})</label>
              <input type="number" id="gs" min="1" max="${pickedSeat.capacity}" value="${Math.min(2, pickedSeat.capacity)}" required />
              <label for="no">Ghi chú</label>
              <input id="no" placeholder="VD: cần ổ cắm, gần cửa sổ" />
              <div class="err" id="bmsg">${esc(errMsg)}</div>
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="btn">Xác nhận đặt</button>
                <button type="button" class="btn ghost" id="unpick">Bỏ chọn</button>
              </div>
            </form>`
          : errMsg
            ? `<div class="panel"><div class="err">${esc(errMsg)}</div></div>`
            : '<div class="panel">Chọn một bàn còn trống để đặt.</div>'
      }

      <div class="grid seats" id="seats">
        ${
          seats.length
            ? seats
                .map(
                  (s) => `
              <button class="seat ${s.status}" data-seat="${s.id}" ${s.status === 'booked' ? 'disabled' : ''}>
                <b>${esc(s.id)}</b><span>${s.capacity} chỗ</span>
                <em>${s.status === 'booked' ? 'Đã đặt' : 'Trống'}</em>
              </button>`
                )
                .join('')
            : `<div class="panel">Tầng này chưa có bàn.</div>`
        }
      </div>

      <div class="panel" id="minebox">
        <h3>Đặt chỗ của tôi ${user ? '' : '(cần đăng nhập để quản lý)'}</h3>
        ${
          !user
            ? `<p>Bạn là khách thăm dò — vẫn xem được sơ đồ, nhưng đặt & quản lý cần <a href="auth.html">đăng nhập</a>.</p>`
            : active.length
              ? active
                  .map(
                    (b) => `
            <div class="book-row">
              <div><b>${esc(b.seatId)}</b> · ${esc(b.date)} ${esc(b.time)} · ${b.guests} khách</div>
              <button class="btn danger small" data-bcancel="${b.id}">Hủy</button>
            </div>`
                  )
                  .join('')
              : '<p class="muted-empty">Chưa có đặt chỗ nào hiệu lực.</p>'
        }
      </div>`;
    state.remove();

    main.querySelectorAll('[data-floor]').forEach((b) =>
      b.addEventListener('click', () => {
        activeFloor = b.dataset.floor;
        paint();
      })
    );
    main.querySelectorAll('[data-seat]').forEach((b) =>
      b.addEventListener('click', () => {
        pickedSeat = seats.find((s) => s.id === b.dataset.seat);
        paint();
      })
    );
    const unp = document.getElementById('unpick');
    if (unp) unp.onclick = () => ((pickedSeat = null), paint());

    main.querySelectorAll('[data-bcancel]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api.bookings.cancel(b.dataset.bcancel);
          toast('Đã hủy đặt chỗ');
          pickedSeat = null;
          paint();
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );

    const bkform = document.getElementById('bkform');
    if (bkform)
      bkform.onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          const bk = await api.bookings.create({
            seatId: pickedSeat.id,
            date: document.getElementById('dt').value,
            time: document.getElementById('tm').value,
            guests: Number(document.getElementById('gs').value),
            note: document.getElementById('no').value
          });
          toast(`✓ Đã đặt bàn ${bk.seatId} ${bk.time} ${bk.date}`);
          pickedSeat = null;
          paint();
        } catch (e) {
          paint(e.message); // CONFLICT giờ / VALIDATION sức chứa → hiện thân tình ngay trên form
        }
      };
  } catch (e) {
    state.remove();
    main.innerHTML = `<div class="panel"><div class="err">Lỗi khi tải trang: ${esc(e.message)}</div><a class="btn ghost" href="menu.html">Về menu</a></div>`;
  }
}

paint();
