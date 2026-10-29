/* booking.html — v1.3 "đặt chỗ = giữ chỗ": sơ đồ theo NGÀY (reserved/booked từ 00:00),
   đặt → chờ cọc 15' → trả cọc (giả lập) giữ bàn; thẻ "đã trễ 15'" do facade trả ({type:'booking-late'}).
   Luật/CONFLICT/VALIDATION để cho facade xử lý — UI chỉ vẽ kết quả (FACADE là nguồn sự thật). */
import { createAppApi, toast } from './lib/boot.js';
import { renderHeader } from './lib/page-kit.js';

const { api, user } = await createAppApi();
const main = document.getElementById('main');
const state = document.getElementById('state');
let activeFloor = null;
let pickedSeat = null;
let theDate = await api.utils.today();

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );

/* nhãn trạng thái: LƯU dùng status, PHA dùng bookings.phase (upcoming/late/deposit_expired) */
function labelOf(b) {
  const p = api.bookings.phase(b);
  if (p === 'pending_deposit') return 'Chờ trả cọc';
  if (p === 'deposit_expired') return 'Hết hạn cọc — bàn đã nhả';
  if (p === 'upcoming') return 'Đã xác nhận';
  if (p === 'late') return '⚠ Đã trễ';
  if (p === 'no_show') return 'Không đến (mất cọc)';
  if (p === 'seated') return 'Đang ngồi';
  if (p === 'completed') return 'Hoàn tất';
  if (p === 'cancelled') return 'Đã hủy';
  if (p === 'expired') return 'Hết hạn cọc';
  return p || b.status;
}
const SEAT_TEXT = {
  available: ['Trống', ''],
  reserved: ['Có người đặt', '— trước 00:00 không chọn được'],
  booked: ['Đã đặt', '']
};

function lateBanner(card) {
  const d = card.data;
  return `
    <div class="late-card">
      <div>
        <b>⚠ Bạn đã trễ ${d.minutesLate} phút</b> — bàn <b>${esc(d.seat.id)}</b>
        ${d.seat.description ? `(${esc(d.seat.description)})` : ''}
        <div class="det">Tự nhả bàn lúc ${esc(d.autoCancelAt)} · hủy ở thẻ này mất cọc ${api.utils.formatVND(d.depositLostOnCancel)}</div>
      </div>
      <button class="btn danger small" data-late-cancel="${esc(d.bookingId)}">Hủy đặt chỗ</button>
    </div>`;
}

async function paint(errMsg = '') {
  try {
    const floors = await api.floors.getAll();
    if (!activeFloor) activeFloor = floors[0]?.id;
    const [seats, params] = await Promise.all([
      api.seats.getMap(theDate, activeFloor),
      user ? Promise.all([api.bookings.getByUser(user.id), api.bookings.getLateCards(user.id)]) : [[], []]
    ]);
    const [mine, lateCards] = params;
    renderHeader(document.getElementById('hdr'), { user });
    const maxDate = new Date(`${theDate}T00:00`);
    maxDate.setDate(maxDate.getDate() + 30);
    const p = (n) => String(n).padStart(2, '0');
    const maxKey = `${maxDate.getFullYear()}-${p(maxDate.getMonth() + 1)}-${p(maxDate.getDate())}`;

    /* của tôi: còn hiệu lực trước, đã chốt sau */
    const holding = mine.filter((b) =>
      ['pending_deposit', 'upcoming', 'late', 'seated'].includes(api.bookings.phase(b))
    );
    const closed = mine.filter((b) => !holding.includes(b));

    main.innerHTML = `
      <h2>🪑 Đặt chỗ — ngày ${esc(theDate)}</h2>

      ${lateCards.length ? lateCards.map(lateBanner).join('') : ''}

      <div class="tabs">
        ${floors
          .map(
            (f) =>
              `<button data-floor="${f.id}" class="${f.id === activeFloor ? 'active' : ''}">${esc(f.name)}</button>`
          )
          .join('')}
        <input type="date" id="bdate" min="${theDate}" max="${maxKey}" value="${theDate}" style="width:auto" />
      </div>

      ${
        pickedSeat
          ? `<form class="panel" id="bkform">
              <h3>Bàn <strong>${esc(pickedSeat.id)}</strong> — tối đa ${pickedSeat.capacity} khách · ${esc(pickedSeat.description || '')}</h3>
              <p class="det">Cọc giữ bàn: <b>${api.utils.formatVND(api.utils.depositAmount(pickedSeat.capacity))}</b>
                (${Math.ceil(pickedSeat.capacity / 2)} ly × ${api.utils.formatVND(api.utils.DEPOSIT_PER_DRINK)}) ·
                chờ trả cọc tối đa 15 phút · hủy trước 00:00 ngày ${esc(theDate)} hoàn 100%</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div><label for="tm">Giờ dự kiến đến (VD 19:30)</label><input type="time" id="tm" required value="19:00" /></div>
                <div><label for="gs">Số khách (1..${pickedSeat.capacity})</label>
                  <input type="number" id="gs" min="1" max="${pickedSeat.capacity}" value="${Math.min(2, pickedSeat.capacity)}" required /></div>
              </div>
              <label for="no">Ghi chú</label>
              <input id="no" placeholder="VD: cần ổ cắm, gần cửa sổ" />
              <div class="err" id="bmsg">${esc(errMsg)}</div>
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="btn">Đặt — ${api.utils.formatVND(api.utils.depositAmount(pickedSeat.capacity))} cọc</button>
                <button type="button" class="btn ghost" id="unpick">Bỏ chọn</button>
              </div>
            </form>`
          : errMsg
            ? `<div class="panel"><div class="err">${esc(errMsg)}</div></div>`
            : '<div class="panel">Chọn một bàn còn trống để đặt. Bàn đã có người đặt hôm nay thì <b>cả ngày</b> không nhận thêm (đặt chỗ = giữ chỗ).</div>'
      }

      <div class="grid seats" id="seats">
        ${
          seats.length
            ? seats
                .map((s) => {
                  const [head, sub] = SEAT_TEXT[s.status] || ['—', ''];
                  return `
              <button class="seat ${esc(s.status)}" data-seat="${esc(s.id)}" ${s.status !== 'available' ? 'disabled' : ''}>
                <b>${esc(s.id)}</b><span>${s.capacity} chỗ</span>
                <em>${head}</em>${sub ? `<span class="det">${sub}</span>` : ''}
              </button>`;
                })
                .join('')
            : `<div class="panel">Tầng này chưa có bàn.</div>`
        }
      </div>

      <div class="panel" id="minebox">
        <h3>Đặt chỗ của tôi ${user ? '' : '(cần đăng nhập để quản lý)'}</h3>
        ${
          !user
            ? `<p>Bạn vẫn đặt được bàn nhưng quản lý/cọc cần <a href="auth.html">đăng nhập</a>.</p>`
            : holding.length
              ? holding
                  .map((b) => {
                    const canCancel = ['pending_deposit', 'upcoming', 'late'].includes(
                      api.bookings.phase(b)
                    );
                    return `
            <div class="book-row">
              <div><b>${esc(b.seatId)}</b> · ${esc(b.date)} ${esc(b.time)} · ${b.guests} khách
                <span class="pill ${b.status}">${labelOf(b)}</span>
                ${
                  api.bookings.phase(b) === 'pending_deposit'
                    ? `<div class="det">Trả cọc ${api.utils.formatVND(b.depositAmount)} trước ${esc((b.depositExpiresAt || '').slice(11, 16))} để giữ bàn</div>`
                    : ''
                }
                ${b.refundAmount !== undefined ? `<div class="det">Hoàn cọc: ${api.utils.formatVND(b.refundAmount)}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px">
                ${
                  api.bookings.phase(b) === 'pending_deposit'
                    ? `<button class="btn small" data-bpay="${esc(b.id)}">Trả cọc (giả lập)</button>`
                    : ''
                }
                ${canCancel ? `<button class="btn danger small" data-bcancel="${esc(b.id)}">Hủy</button>` : ''}
              </div>
            </div>`;
                  })
                  .join('')
              : '<p class="muted-empty">Chưa có đặt chỗ nào còn hiệu lực.</p>'
        }
        ${
          closed.length
            ? `<details style="margin-top:8px"><summary class="det">Lịch sử (${closed.length})</summary>${closed
                .map(
                  (b) => `
              <div class="book-row"><div><b>${esc(b.seatId)}</b> · ${esc(b.date)} ${esc(b.time)} ·
                <span class="pill ${esc(b.status)}">${labelOf(b)}</span>
                ${b.refundAmount !== undefined ? ` · hoàn cọc: ${api.utils.formatVND(b.refundAmount)}` : ''}</div></div>`
                )
                .join('')}</details>`
            : ''
        }
      </div>`;
    state.remove();

    main.querySelectorAll('[data-floor]').forEach((b) =>
      b.addEventListener('click', () => {
        activeFloor = b.dataset.floor;
        paint();
      })
    );
    document.getElementById('bdate').onchange = (e) => {
      theDate = e.target.value;
      pickedSeat = null; // bàn chọn theo ngày — đổi ngày thì bỏ chọn
      paint();
    };
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
          const c = await api.bookings.cancel(b.dataset.bcancel);
          toast(
            c.refundAmount
              ? `Đã hủy — hoàn cọc ${api.utils.formatVND(c.refundAmount)}`
              : 'Đã hủy đặt chỗ'
          );
          paint();
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
    main.querySelectorAll('[data-late-cancel]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Hủy ở thẻ trễ sẽ MẤT CỌC. Hủy luôn?')) return;
        try {
          await api.bookings.cancel(b.dataset.lateCancel);
          toast('Đã hủy — mất cọc theo luật');
          paint();
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
    main.querySelectorAll('[data-bpay]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api.bookings.payDeposit(b.dataset.bpay); // DEMO: giả lập — backend thật cần gateway
          toast('✓ Đã nhận cọc — bàn giữ cả ngày');
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
            date: theDate,
            time: document.getElementById('tm').value,
            guests: Number(document.getElementById('gs').value),
            note: document.getElementById('no').value
          });
          toast(
            `Đã đặt bàn ${bk.seatId} — trả cọc ${api.utils.formatVND(bk.depositAmount)} trong 15' để giữ bàn`
          );
          pickedSeat = null;
          paint();
        } catch (e) {
          paint(e.message); // CONFLICT (bàn đã có người ngày đó) / VALIDATION → hiện thân tình trên form
        }
      };
  } catch (e) {
    state.remove();
    main.innerHTML = `<div class="panel"><div class="err">Lỗi khi tải trang: ${esc(e.message)}</div><a class="btn ghost" href="menu.html">Về menu</a></div>`;
  }
}

paint();
