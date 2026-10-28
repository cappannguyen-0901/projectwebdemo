/* ============================================================
   KNOWLEDGE BASE — CAPPAN
   File này chứa MỌI thông tin AI cần biết.
   Chỉ cần sửa file này khi muốn update thông tin quán.
============================================================ */

const KB = {

  /* ============================================================
     1. THÔNG TIN QUÁN (Store Info)
  ============================================================ */
  store: {
    // Tên + slogan
    name: 'CAPPAN',
    fullName: 'CAPPAN Coffee & More',
    slogan: 'Coffee & More - Home Study',
    description: 'Quán cà phê không gian học tập & làm việc tại Gò Vấp',

    // Liên hệ
    address: 'Công viên Gia Định, P. Hạnh Thông, Q. Gò Vấp, TP.HCM',
    hotline: '0366 444 038',
    email: 'cappannguyen@gmail.com',

    // Giờ
    hours: '07:00 - 22:30',
    openHour: 7,      // 7:00 sáng
    closeHour: 22.5,  // 22:30 tối

    // Wifi
    wifi: {
      name: 'CAPPAN_Free',
      password: 'cappannguyen'
    },

    // Tiện ích
    amenities: [
      'Bãi đậu xe miễn phí phía sau quán',
      'Wifi miễn phí tốc độ cao',
      'Ổ cắm điện tại mọi bàn',
      'Không gian máy lạnh + ngoài trời',
      'Mở cửa cả cuối tuần'
    ],

    // Chính sách
    policies: {
      parking: 'Miễn phí',
      wifi: 'Miễn phí',
      airConditioner: true,
      petAllowed: false,
      smoking: false
    }
  },

  /* ============================================================
     2. FAQ (Câu hỏi thường gặp)
  ============================================================ */
  faq: [
    {
      question: 'Có app không?',
      answer: 'Dạ hiện tại CAPPAN chưa có app riêng ạ. Anh/chị vui lòng truy cập website để đặt chỗ và đặt nước.',
      keywords: ['app', 'ứng dụng', 'tải app', 'cài app']
    },
    {
      question: 'Có tuyển dụng không?',
      answer: 'Dạ hiện tại CAPPAN chưa có đợt tuyển dụng. Anh/chị theo dõi fanpage để cập nhật thông tin mới nhất nhé.',
      keywords: ['tuyển', 'tuyển dụng', 'xin việc', 'làm việc', 'nhân viên mới']
    },
    {
      question: 'Chủ quán là ai?',
      answer: 'Dạ em chưa có thông tin này. Anh/chị vui lòng gọi hotline 0366 444 038 để được hỗ trợ ạ.',
      keywords: ['chủ quán', 'sáng lập', 'founder', 'owner', 'ông chủ', 'bà chủ']
    },
    {
      question: 'Quán thành lập năm nào?',
      answer: 'Dạ em chưa có thông tin này. Anh/chị vui lòng gọi hotline 0366 444 038 để được hỗ trợ ạ.',
      keywords: ['thành lập', 'mở năm', 'ra đời', 'khai trương năm']
    },
    {
      question: 'Có bao nhiêu chi nhánh?',
      answer: 'Dạ hiện tại CAPPAN chỉ có 1 chi nhánh tại Công viên Gia Định, Q. Gò Vấp ạ.',
      keywords: ['chi nhánh', 'cơ sở', 'địa điểm khác', 'quán khác']
    },
    {
      question: 'Có đặt tiệc riêng không?',
      answer: 'Dạ CAPPAN có nhận đặt tiệc riêng cho đoàn từ 10 người. Anh/chị vui lòng gọi hotline 0366 444 038 để được tư vấn menu và không gian phù hợp.',
      keywords: ['tiệc', 'sinh nhật', 'sự kiện', 'đặt nhiều', 'đoàn đông']
    },
    {
      question: 'Có món chay không?',
      answer: 'Dạ CAPPAN chưa có menu chay riêng, nhưng có một số món phù hợp: Sinh tố Bơ, Sinh tố Xoài, Nước ép Cam, Trà Sen Vàng. Anh/chị có thể hỏi em thêm về các món này.',
      keywords: ['chay', 'món chay', 'ăn chay', 'vegetarian', 'vegan']
    },
    {
      question: 'Quán có bán đồ ăn không?',
      answer: 'Dạ CAPPAN chủ yếu phục vụ đồ uống, món ăn hiện có là Bánh Flan. Anh/chị gọi hotline 0366 444 038 để hỏi thêm món ăn nhẹ nhé ạ.',
      keywords: ['đồ ăn', 'món ăn', 'ăn vặt', 'ăn nhẹ', 'bánh']
    },
    {
      question: 'Bạn là AI hay người thật?',
      answer: 'Dạ em là trợ lý AI của CAPPAN, không phải người thật. Em có thể nhầm, với thông tin quan trọng anh/chị vui lòng gọi hotline 0366 444 038 ạ.',
      keywords: ['là ai', 'ai hay người', 'người thật', 'robot', 'chatbot']
    },
    {
      question: 'Dữ liệu cá nhân được dùng thế nào?',
      answer: 'Dạ thông tin của anh/chị chỉ dùng để đặt chỗ và đặt nước. Chi tiết xem trang "Chính sách bảo mật" ở cuối website ạ.',
      keywords: ['bảo mật', 'dữ liệu cá nhân', 'quyền riêng tư', 'thông tin cá nhân']
    },
    {
      question: 'Có giao hàng không?',
      answer: 'Dạ có ạ. CAPPAN giao hàng trong bán kính 3km, phí ship 15.000đ. Anh/chị vào mục "Đặt nước" để đặt nhé.',
      keywords: ['giao hàng', 'ship', 'delivery', 'vận chuyển']
    },
    {
      question: 'Có được mang thú cưng không?',
      answer: 'Dạ CAPPAN không cho phép mang thú cưng vào quán ạ, để đảm bảo vệ sinh chung.',
      keywords: ['thú cưng', 'pet', 'chó mèo', 'vật nuôi']
    },
    {
      question: 'Có hút thuốc được không?',
      answer: 'Dạ CAPPAN là không gian không khói thuốc ạ. Anh/chị vui lòng không hút thuốc trong quán.',
      keywords: ['hút thuốc', 'thuốc lá', 'smoking']
    }
  ],

  /* ============================================================
     3. QUY TẮC ỨNG XỬ
  ============================================================ */
  rules: {
    customer: {
      allowed: [
        'Giới thiệu menu, giá, mô tả món',
        'Tư vấn chọn món',
        'Cho biết chỗ trống cụ thể (mã bàn, khu vực, sức chứa)',
        'Hướng dẫn đặt chỗ, đặt nước',
        'Cung cấp giờ mở cửa, địa chỉ, hotline, wifi',
        'Trả lời FAQ'
      ],
      forbidden: [
        'Công thức pha chế',
        'Giá vốn, tồn kho chi tiết',
        'Thông tin nhân viên, lịch ca',
        'Dashboard nội bộ',
        'Thực hiện thao tác ghi'
      ]
    },
    staff: {
      allowed: [
        'Tất cả quyền của khách',
        'Tra công thức pha chế',
        'Xem đơn hàng, booking, nhân viên, lịch ca',
        'Đánh dấu hết hàng / còn hàng',
        'Reset chỗ ngồi',
        'Hủy đơn / booking',
        'Đánh dấu hoàn thành'
      ]
    }
  },

  /* ============================================================
     4. NGỮ CẢNH BỔ SUNG — Dùng cho LLM
  ============================================================ */
  context: {
    // Khi khách hỏi về "chỗ yên tĩnh"
    quietZone: 'Lầu 1 (F2) có khu vực yên tĩnh lý tưởng để học tập và làm việc, có ổ cắm điện tại mọi bàn.',

    // Khi khách hỏi về "chỗ nhóm"
    groupZone: 'Lầu 2 (F3) có phòng riêng cách âm cho nhóm họp, sức chứa 4-8 người.',

    // Khi khách hỏi về "view đẹp"
    viewZone: 'Tầng thượng (F4) có view thành phố đẹp nhất, đặc biệt về đêm.',

    // Khi khách hỏi "món hot"
    hotDrinks: 'Các món bán chạy: Cà Phê Sữa Đá (M001), Trà Đào Cam Sả (M101), Cà Phê Muối (M006).',

    // Khi khách hỏi "món mới"
    newDrinks: 'Món mới: Cà Phê Muối (M006) - vị mặn nhẹ độc đáo.'
  },
    /* ============================================================
     5. COMBO — Gói ưu đãi 2-3 món
  ============================================================ */
  combos: [
    {
      id: 'COMBO01',
      name: 'Combo Sáng Tỉnh Táo',
      itemIds: ['M001', 'M503'],
      items: ['Cà Phê Sữa Đá', 'Bánh Flan'],
      originalPrice: 60000,
      comboPrice: 52000
    },
    {
      id: 'COMBO02',
      name: 'Combo Trà Chiều',
      itemIds: ['M101', 'M401'],
      items: ['Trà Đào Cam Sả', 'Soda Chanh'],
      originalPrice: 83000,
      comboPrice: 72000
    },
    {
      id: 'COMBO03',
      name: 'Combo Nhóm Học Tập',
      itemIds: ['M102', 'M201', 'M403'],
      items: ['Trà Xanh Matcha', 'Sinh Tố Bơ', 'Đá Xay Cà Phê'],
      originalPrice: 155000,
      comboPrice: 135000
    }
  ]
};