/* ============================================================
   PROMOTIONS — Khuyến mãi & mã giảm giá
============================================================ */

const SEED_PROMOTIONS = [
  {
    code: 'WELCOME10',
    name: 'Chào khách mới',
    description: 'Giảm 10% cho đơn hàng đầu tiên',
    discount: '10%',
    minOrder: 0,
    maxDiscount: 30000,
    active: true,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    terms: 'Áp dụng cho đơn hàng đầu tiên của khách mới'
  },
  {
    code: 'FREESHIP',
    name: 'Miễn phí giao hàng',
    description: 'Miễn phí ship cho đơn từ 100.000đ',
    discount: '15.000đ',
    minOrder: 100000,
    active: true,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    terms: 'Áp dụng cho đơn giao hàng trong bán kính 3km'
  },
  {
    code: 'CAFE20',
    name: 'Giảm giá cà phê',
    description: 'Giảm 20.000đ cho đơn từ 100.000đ',
    discount: '20.000đ',
    minOrder: 100000,
    active: true,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    terms: 'Không áp dụng cùng lúc với mã khác'
  }
];