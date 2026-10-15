/* ============================================================
   SEED DATA — DỮ LIỆU TĨNH
============================================================ */

/* ---------- CATEGORIES ---------- */
const SEED_CATEGORIES = [
  { id: 'coffee',   name: '☕ Cà phê',       order: 1 },
  { id: 'tea',      name: '🍵 Trà',           order: 2 },
  { id: 'smoothie', name: '🥤 Sinh tố',      order: 3 },
  { id: 'juice',    name: '🧃 Nước ép',      order: 4 },
  { id: 'soda',     name: '🍹 Soda & Đá xay', order: 5 },
  { id: 'other',    name: '🥛 Khác',          order: 6 }
];

/* ---------- MENU ITEMS ---------- */
const SEED_MENU_ITEMS = [
  /* Cà phê */
  { id:'M001', name:'Cà Phê Sữa Đá', categoryId:'coffee', price:35000, img:'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=600', description:'Cà phê truyền thống Việt Nam', badge:'Bán chạy', inStock:true,
    sizes:[{name:'M',extraPrice:0},{name:'L',extraPrice:10000}],
    toppings:[{name:'Shot espresso',price:10000},{name:'Kem',price:8000}] },
  { id:'M002', name:'Bạc Xỉu', categoryId:'coffee', price:40000, img:'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600', inStock:true,
    sizes:[{name:'M',extraPrice:0},{name:'L',extraPrice:10000}] },
  { id:'M003', name:'Latte Nóng', categoryId:'coffee', price:55000, img:'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600', inStock:true },
  { id:'M004', name:'Cappuccino', categoryId:'coffee', price:55000, img:'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600', inStock:true },
  { id:'M005', name:'Espresso', categoryId:'coffee', price:45000, img:'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=600', inStock:true },
  { id:'M006', name:'Cà Phê Muối', categoryId:'coffee', price:42000, img:'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600', badge:'Mới', inStock:true },

  /* Trà */
  { id:'M101', name:'Trà Đào Cam Sả', categoryId:'tea', price:45000, img:'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600', badge:'Hot', inStock:true },
  { id:'M102', name:'Trà Xanh Matcha', categoryId:'tea', price:50000, img:'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=600', inStock:true },
  { id:'M103', name:'Trà Sen Vàng', categoryId:'tea', price:48000, img:'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600', inStock:true },
  { id:'M104', name:'Trà Gừng Mật Ong', categoryId:'tea', price:42000, img:'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600', inStock:true },

  /* Sinh tố */
  { id:'M201', name:'Sinh Tố Bơ', categoryId:'smoothie', price:50000, img:'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600', inStock:true },
  { id:'M202', name:'Sinh Tố Xoài', categoryId:'smoothie', price:48000, img:'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600', inStock:true },
  { id:'M203', name:'Sinh Tố Dâu', categoryId:'smoothie', price:52000, img:'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600', inStock:true },
  { id:'M204', name:'Sinh Tố Việt Quất', categoryId:'smoothie', price:55000, img:'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600', inStock:true },

  /* Nước ép */
  { id:'M301', name:'Nước Ép Cam', categoryId:'juice', price:45000, img:'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600', inStock:true },
  { id:'M302', name:'Nước Ép Táo', categoryId:'juice', price:48000, img:'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600', inStock:true },
  { id:'M303', name:'Nước Ép Dưa Hấu', categoryId:'juice', price:40000, img:'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600', inStock:true },

  /* Soda & Đá xay */
  { id:'M401', name:'Soda Chanh', categoryId:'soda', price:38000, img:'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600', inStock:true },
  { id:'M402', name:'Soda Việt Quất', categoryId:'soda', price:42000, img:'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600', inStock:true },
  { id:'M403', name:'Đá Xay Cà Phê', categoryId:'soda', price:55000, img:'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600', inStock:true },
  { id:'M404', name:'Đá Xay Matcha', categoryId:'soda', price:58000, img:'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=600', inStock:true },

  /* Khác */
  { id:'M501', name:'Sữa Chua Cà Phê', categoryId:'other', price:40000, img:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600', inStock:true },
  { id:'M502', name:'Socola Nóng', categoryId:'other', price:48000, img:'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?w=600', inStock:true },
  { id:'M503', name:'Bánh Flan', categoryId:'other', price:25000, img:'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600', inStock:true }
];

/* ---------- FLOORS ---------- */
const SEED_FLOORS = [
  { id:'F1', name:'Tầng trệt', purpose:'lobby',
    description:'Sảnh chính, sôi động, phù hợp khách vãng lai',
    img:'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=900' },
  { id:'F2', name:'Lầu 1', purpose:'study',
    description:'Không gian yên tĩnh, lý tưởng để học tập & làm việc',
    img:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=900' },
  { id:'F3', name:'Lầu 2', purpose:'group',
    description:'Phòng riêng, cách âm, phù hợp nhóm họp',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=900' },
  { id:'F4', name:'Tầng thượng', purpose:'outdoor',
    description:'Không gian ngoài trời, thoáng mát, view đẹp về đêm',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900' }
];

/* ---------- SEATS ---------- */
const SEED_SEATS = [
  /* ========== F1 — TẦNG TRỆT (8 bàn — 26 chỗ) ========== */
  { id:'A1', floorId:'F1', zone:'window', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500',
    description:'Bàn 2 người cạnh cửa sổ, view phố' },
  { id:'A2', floorId:'F1', zone:'window', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500',
    description:'Bàn 2 người cạnh cửa sổ' },
  { id:'A3', floorId:'F1', zone:'center', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=500',
    description:'Bàn 2 người khu trung tâm' },
  { id:'A4', floorId:'F1', zone:'center', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=500',
    description:'Bàn 2 người gần quầy bar' },
  { id:'A5', floorId:'F1', zone:'center', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Bàn 4 người khu trung tâm' },
  { id:'A6', floorId:'F1', zone:'center', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Bàn 4 người khu trung tâm' },
  { id:'A7', floorId:'F1', zone:'window', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=500',
    description:'Bàn 4 người view phố' },
  { id:'A8', floorId:'F1', zone:'center', capacity:6, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Bàn 6 người, phù hợp nhóm' },

  /* ========== F2 — LẦU 1 (10 bàn — 30 chỗ) ========== */
  { id:'B1', floorId:'F2', zone:'quiet', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người cạnh cửa sổ, có ổ cắm' },
  { id:'B2', floorId:'F2', zone:'quiet', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người yên tĩnh' },
  { id:'B3', floorId:'F2', zone:'quiet', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người góc yên tĩnh' },
  { id:'B4', floorId:'F2', zone:'quiet', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người cạnh kệ sách' },
  { id:'B5', floorId:'F2', zone:'quiet', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người view cây xanh' },
  { id:'B6', floorId:'F2', zone:'quiet', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người góc làm việc' },
  { id:'B7', floorId:'F2', zone:'quiet', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Bàn 4 người, nhóm học tập nhỏ' },
  { id:'B8', floorId:'F2', zone:'quiet', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Bàn 4 người, nhóm học tập nhỏ' },
  { id:'B9', floorId:'F2', zone:'quiet', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Bàn 4 người, nhóm học tập nhỏ' },
  { id:'B10', floorId:'F2', zone:'quiet', capacity:6, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Bàn 6 người, khu yên tĩnh' },

  /* ========== F3 — LẦU 2 (6 phòng — 32 chỗ) ========== */
  { id:'C1', floorId:'F3', zone:'group', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Phòng nhỏ 4 người, cách âm' },
  { id:'C2', floorId:'F3', zone:'group', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Phòng nhỏ 4 người, cách âm' },
  { id:'C3', floorId:'F3', zone:'group', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Phòng nhỏ 4 người, cách âm' },
  { id:'C4', floorId:'F3', zone:'group', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Phòng nhỏ 4 người, cách âm' },
  { id:'C5', floorId:'F3', zone:'group', capacity:8, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Phòng lớn 8 người, có máy chiếu' },
  { id:'C6', floorId:'F3', zone:'group', capacity:8, status:'available',
    img:'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500',
    description:'Phòng lớn 8 người, có máy chiếu' },

  /* ========== F4 — SÂN THƯỢNG (8 bàn — 26 chỗ) ========== */
  { id:'D1', floorId:'F4', zone:'window', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người, view thành phố' },
  { id:'D2', floorId:'F4', zone:'window', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người, view thành phố' },
  { id:'D3', floorId:'F4', zone:'window', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người, ngoài trời' },
  { id:'D4', floorId:'F4', zone:'window', capacity:2, status:'available',
    img:'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500',
    description:'Bàn 2 người, ngoài trời' },
  { id:'D5', floorId:'F4', zone:'group', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=500',
    description:'Bàn 4 người, có mái che' },
  { id:'D6', floorId:'F4', zone:'group', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=500',
    description:'Bàn 4 người, có mái che' },
  { id:'D7', floorId:'F4', zone:'group', capacity:4, status:'available',
    img:'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=500',
    description:'Bàn 4 người, có mái che' },
  { id:'D8', floorId:'F4', zone:'window', capacity:6, status:'available',
    img:'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=500',
    description:'⭐ Bàn dài 6 người dọc lan can, view đẹp' }
];
/* ---------- STAFF (Nhân viên demo) ---------- */
const SEED_STAFF = [
  { id: 'S001', name: 'Nguyễn Văn An',   role: 'Pha chế',    phone: '0912345601', avatar: 'A' },
  { id: 'S002', name: 'Trần Thị Bình',   role: 'Phục vụ',    phone: '0912345602', avatar: 'B' },
  { id: 'S003', name: 'Lê Minh Cường',   role: 'Pha chế',    phone: '0912345603', avatar: 'C' },
  { id: 'S004', name: 'Phạm Thu Dung',   role: 'Thu ngân',   phone: '0912345604', avatar: 'D' },
  { id: 'S005', name: 'Hoàng Văn Em',    role: 'Phục vụ',    phone: '0912345605', avatar: 'E' },
  { id: 'S006', name: 'Vũ Thị Phương',   role: 'Quản lý ca', phone: '0912345606', avatar: 'F' }
];

/* ---------- SHIFTS (Ca làm việc) ---------- */
const SEED_SHIFTS = [
  { id: 'morning', name: 'Ca sáng',  start: '07:00', end: '12:00', color: '#FFA726' },
  { id: 'afternoon', name: 'Ca chiều', start: '12:00', end: '17:00', color: '#42A5F5' },
  { id: 'evening', name: 'Ca tối',   start: '17:00', end: '22:30', color: '#7E57C2' }
];