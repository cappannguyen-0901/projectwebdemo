/* ============================================================
   CAPPAN v2 — LUẬT ĐẶT CHỖ v1.3 (THUẦN: không DOM, không storage, không Date.now)
   Hợp đồng: docs/api-contract.md §3.8 v1.3 + docs/booking-policy-v1.3.md (tài liệu gốc user gửi).
   Mọi hàm nhận `now` từ ngoài → test được mọi mốc thời gian.

   Quy tắc đã chốt:
   • Đặt chỗ = giữ chỗ = 1. Một bàn chỉ có 1 booking còn hiệu lực MỖI NGÀY (khóa cả ngày, không có thời lượng).
   • Bàn đã có booking thì không ai đặt thêm được (chặn ngay lúc đặt, kể cả đặt trước cả tuần).
   • Sơ đồ đánh dấu "đã có người" từ 00:00 ngày D. Trước 00:00: hủy hoàn cọc 100%.
   • Từ 00:00 ngày D: hủy mất cọc. Giờ đặt +15' → thẻ "trễ". Giờ đặt +30' → tự hủy, mất cọc.
   • Khách đã đến: giữ bàn không giới hạn, chỉ khách hoặc nhân viên mới nhả.
   ============================================================ */

export const RULES = {
  OPEN: '07:00',
  CLOSE: '22:30',
  LATE_AFTER_MIN: 15,
  AUTO_CANCEL_AFTER_MIN: 30,
  DEPOSIT_HOLD_MIN: 15, // chờ trả cọc; quá hạn → expired, nhả bàn
  DEPOSIT_PER_DRINK: 35000, // VND/ly — chỉnh theo menu (giá trị tạm)
  MAX_ADVANCE_DAYS: 30,
  MAX_ACTIVE_PER_USER: 3,
  LATE_REFUND_RATE: 0 // hủy từ 00:00 ngày D trở đi
};

const pad = (n) => String(n).padStart(2, '0');
const addMin = (d, m) => new Date(d.getTime() + m * 60000);

export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function toLocal(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
export const startOfDay = (date) => toLocal(date, '00:00');
export const arrivalAt = (b) => toLocal(b.date, b.time);

/* ---------- Tiền cọc: 2 chỗ→1 ly, 4→2, 6→3, 8→4 ---------- */
export const depositDrinks = (capacity) => Math.ceil(Number(capacity) / 2);
export const depositAmount = (capacity, unit = RULES.DEPOSIT_PER_DRINK) =>
  depositDrinks(capacity) * unit; // lưu VND tại thời điểm đặt, không lưu "số ly"

/* ---------- Kiểm tra ngày/giờ đặt ---------- */
export function validateSlot(date, time, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')))
    return { field: 'date', message: 'Ngày phải dạng YYYY-MM-DD' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || '')))
    return { field: 'time', message: 'Giờ phải dạng HH:MM' };
  const today = fmtDate(now);
  if (date < today) return { field: 'date', message: 'Không đặt chỗ cho ngày quá khứ' };
  const last = new Date(now);
  last.setDate(last.getDate() + RULES.MAX_ADVANCE_DAYS);
  if (date > fmtDate(last))
    return { field: 'date', message: `Chỉ đặt trước tối đa ${RULES.MAX_ADVANCE_DAYS} ngày` };
  if (time < RULES.OPEN || time > RULES.CLOSE)
    return { field: 'time', message: `Quán mở cửa ${RULES.OPEN} - ${RULES.CLOSE}` };
  if (toLocal(date, time) < now) return { field: 'time', message: 'Giờ này đã qua' };
  return null;
}

/* ---------- Pha (phase) của 1 booking tại thời điểm now ----------
   status lưu: pending_deposit | confirmed | seated | completed | cancelled | expired | no_show
   phase tính ra: thêm 'upcoming' | 'late' | 'deposit_expired' (chưa kịp được quét) */
export function phase(b, now) {
  switch (b.status) {
    case 'pending_deposit':
      return b.depositExpiresAt && now >= new Date(b.depositExpiresAt)
        ? 'deposit_expired'
        : 'pending_deposit';
    case 'confirmed': {
      const t = arrivalAt(b);
      if (now >= addMin(t, RULES.AUTO_CANCEL_AFTER_MIN)) return 'no_show';
      if (now >= addMin(t, RULES.LATE_AFTER_MIN)) return 'late';
      return 'upcoming';
    }
    default:
      return b.status; // seated, completed, cancelled, expired, no_show
  }
}

const HOLDING = new Set(['pending_deposit', 'upcoming', 'late', 'seated']);
export const isHolding = (b, now) => HOLDING.has(phase(b, now));

/* Bàn bị chiếm trong ngày D? (dùng để chặn đặt trùng — hiệu lực NGAY khi đặt) */
export const holderOf = (seatId, date, bookings, now) =>
  bookings.find((b) => b.seatId === seatId && b.date === date && isHolding(b, now)) || null;

/* Trạng thái 1 bàn trên sơ đồ ngày D:
   available | reserved (đã có người đặt cho ngày D nhưng chưa tới 00:00) | booked (từ 00:00 ngày D) */
export function mapStatus(seatId, date, bookings, now) {
  const h = holderOf(seatId, date, bookings, now);
  if (!h) return { status: 'available', bookingId: null, phase: null };
  return {
    status: now >= startOfDay(date) ? 'booked' : 'reserved',
    bookingId: h.id,
    phase: phase(h, now)
  };
}

/* ---------- Hoàn cọc ---------- */
export function refundRate(b, at) {
  if (!b.depositPaid) return 0;
  const p = phase(b, at);
  if (p === 'late' || p === 'no_show') return 0; // hủy ở thẻ trễ / bị tự hủy: mất cọc
  return at < startOfDay(b.date) ? 1 : RULES.LATE_REFUND_RATE;
}
export const refundAmount = (b, at) => Math.round((b.depositAmount || 0) * refundRate(b, at));

/* ---------- Kế hoạch quét (thuần): trả danh sách chuyển trạng thái ---------- */
export function sweepPlan(bookings, now) {
  const today = fmtDate(now);
  const out = [];
  for (const b of bookings) {
    const p = phase(b, now);
    if (b.status === 'pending_deposit' && p === 'deposit_expired')
      out.push({ id: b.id, to: 'expired', reason: 'deposit_timeout' });
    else if (b.status === 'confirmed' && p === 'no_show')
      out.push({ id: b.id, to: 'no_show', reason: 'auto_cancel_30m' });
    else if (b.status === 'seated' && b.date < today)
      out.push({ id: b.id, to: 'completed', reason: 'day_closed' });
  }
  return out;
}

/* ---------- Thẻ "đã trễ 15'" — engine trả dữ liệu, UI (web/chat) tự vẽ ---------- */
export function lateCard(b, seat, now) {
  if (phase(b, now) !== 'late') return null;
  const cancelAt = addMin(arrivalAt(b), RULES.AUTO_CANCEL_AFTER_MIN);
  return {
    type: 'booking-late',
    data: {
      bookingId: b.id,
      seat: { id: seat.id, img: seat.img, description: seat.description },
      minutesLate: Math.floor((now - arrivalAt(b)) / 60000),
      autoCancelAt: fmtTime(cancelAt),
      depositLostOnCancel: b.depositAmount || 0,
      actions: ['cancel']
    }
  };
}
