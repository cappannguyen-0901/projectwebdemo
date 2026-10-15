/* ============================================================
   SCHEMA — ĐỊNH NGHĨA CẤU TRÚC DỮ LIỆU
   Chỉ là tài liệu tham khảo — KHÔNG chứa logic
============================================================ */

const SCHEMA = {
  users: {
    fields: ['id', 'name', 'phone', 'password', 'role', 'email', 'address', 'birthday', 'joinedAt', 'noShowCount'],
    desc: 'Người dùng (khách + nhân viên)'
  },
  categories: {
    fields: ['id', 'name', 'order'],
    desc: 'Nhóm đồ uống'
  },
  menuItems: {
    fields: ['id', 'name', 'categoryId', 'price', 'img', 'description', 'badge', 'inStock', 'sizes', 'toppings'],
    desc: 'Món đồ uống'
  },
  floors: {
    fields: ['id', 'name', 'purpose', 'description', 'img'],
    desc: 'Tầng/khu vực'
  },
  seats: {
    fields: ['id', 'floorId', 'zone', 'capacity', 'status', 'img', 'description'],
    desc: 'Chỗ ngồi'
  },
  bookings: {
    fields: ['id', 'userId', 'seatId', 'floorId', 'date', 'time', 'guests', 'note', 'status', 'createdAt'],
    desc: 'Lịch sử đặt chỗ'
  },
  orders: {
    fields: ['id', 'userId', 'items', 'total', 'address', 'phone', 'note', 'status', 'step', 'createdAt'],
    desc: 'Lịch sử đơn hàng'
  }
};

const ENUMS = {
  userRole:      ['customer', 'staff'],
  bookingStatus: ['pending', 'confirmed', 'cancelled', 'completed'],
  orderStatus:   ['pending', 'preparing', 'delivering', 'completed', 'cancelled'],
  floorPurpose:  ['lobby', 'study', 'group', 'outdoor'],
  seatZone:      ['window', 'center', 'quiet', 'group'],
  seatStatus:    ['available', 'booked']
};

const STORAGE_KEYS = {
  currentUser:  'cappan_current_user',
  users:        'cappan_users',
  bookings:     'cappan_bookings',
  orders:       'cappan_orders',
  currentOrder: 'cappan_current_order'
};