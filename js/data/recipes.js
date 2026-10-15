/* ============================================================
   SEED RECIPES — CÔNG THỨC PHA CHẾ (CHỈ NHÂN VIÊN XEM ĐƯỢC)
   Tách riêng khỏi SEED_MENU_ITEMS để đảm bảo phân quyền.
   Key = mã món (M001, M002...) khớp với SEED_MENU_ITEMS.
============================================================ */

const SEED_RECIPES = {

  /* ========== CÀ PHÊ ========== */

  'M001': {
    name: 'Cà Phê Sữa Đá',
    size: '350ml',
    ingredients: [
      '25g cà phê bột (pha phin) hoặc 1 shot Espresso đậm',
      '30ml sữa đặc',
      'Đá viên'
    ],
    steps: [
      'Cho sữa đặc vào ly',
      'Chiết xuất cà phê nóng rót trực tiếp vào, khuấy đều cho tan sữa đặc',
      'Thêm đá viên đầy ly'
    ],
    note: 'Size L: tăng 10ml sữa đặc + 1/2 shot cà phê'
  },

  'M002': {
    name: 'Bạc Xỉu',
    size: '350ml',
    ingredients: [
      '30ml sữa đặc',
      '40ml sữa tươi không đường',
      '15ml cà phê',
      'Đá viên'
    ],
    steps: [
      'Cho sữa đặc và sữa tươi vào ly, khuấy đều',
      'Thêm đá viên',
      'Dùng shaker lắc tạo bọt 15ml cà phê rồi rót lên trên cùng để tạo tầng đẹp mắt'
    ]
  },

  'M003': {
    name: 'Latte Nóng',
    size: '230ml',
    ingredients: [
      '1 shot Espresso (30ml)',
      '200ml sữa tươi thanh trùng'
    ],
    steps: [
      'Chiết xuất Espresso ra ly sứ',
      'Đánh nóng sữa tươi bằng vòi hơi (nhiệt độ ~60-65°C, bọt mịn mỏng)',
      'Rót sữa vào ly cà phê và vẽ hình (Latte Art)'
    ]
  },

  'M004': {
    name: 'Cappuccino',
    size: '210ml',
    ingredients: [
      '1 shot Espresso (30ml)',
      '180ml sữa tươi thanh trùng',
      'Bột ca cao / quế rắc bề mặt'
    ],
    steps: [
      'Chiết xuất Espresso ra ly sứ',
      'Đánh nóng sữa tươi tạo lớp bọt dày (~1.5 - 2cm)',
      'Rót sữa vào ly và rắc nhẹ một ít bột ca cao lên lớp bọt'
    ]
  },

  'M005': {
    name: 'Espresso',
    size: '30-40ml',
    ingredients: [
      '18g cà phê hạt rang xay mịn'
    ],
    steps: [
      'Nén cà phê vào tay pha (portafilter)',
      'Chiết xuất bằng máy pha áp suất cao trong 25-30 giây',
      'Thu được 30-40ml Espresso nguyên chất có lớp crema dày dặn'
    ]
  },

  'M006': {
    name: 'Cà Phê Muối',
    size: '350ml',
    ingredients: [
      '30ml cà phê phin đậm',
      '15ml sữa đặc',
      '40ml kem béo thực vật (Rich\'s Creamer)',
      '1g muối biển',
      'Đá viên'
    ],
    steps: [
      'Đánh bông kem béo cùng muối biển cho mịn',
      'Cho sữa đặc và cà phê vào ly khuấy đều, thêm đá',
      'Rót lớp kem muối đánh mịn lên bề mặt'
    ]
  },

  /* ========== TRÀ ========== */

  'M101': {
    name: 'Trà Đào Cam Sả',
    size: '500ml',
    ingredients: [
      '120ml cốt trà đen / trà earl grey',
      '20ml syrup đào',
      '10ml nước cốt cam tươi',
      '10ml nước đường',
      '1 cây sả đập dập đun lấy nước',
      '2-3 miếng đào ngâm'
    ],
    steps: [
      'Cho cốt trà, nước sả, syrup đào, nước cam, nước đường và đá vào bình lắc',
      'Lắc đều',
      'Đổ ra ly và trang trí bằng đào ngâm + sả tươi'
    ]
  },

  'M102': {
    name: 'Matcha Latte',
    size: '350ml',
    ingredients: [
      '3g bột Matcha Nhật Bản',
      '30ml nước ấm (80°C)',
      '100ml sữa tươi',
      '15ml nước đường',
      'Đá viên'
    ],
    steps: [
      'Hòa tan hoàn toàn bột matcha với nước ấm bằng chổi chasen hoặc cây đánh bọt',
      'Cho sữa tươi, nước đường và đá vào ly',
      'Rót hỗn hợp matcha lên trên'
    ]
  },

  'M103': {
    name: 'Trà Sen Vàng',
    size: '400ml',
    ingredients: [
      '120ml cốt trà oolong',
      '20ml syrup hạt sen (hoặc nước đường sen)',
      '50g hạt sen rim đường',
      '30ml macchiato (kem cheese / kem béo)',
      'Đá viên'
    ],
    steps: [
      'Khuấy đều cốt trà oolong với syrup hạt sen và đá',
      'Cho hạt sen rim xuống đáy ly / trên mặt, rót trà vào',
      'Phủ lớp macchiato mềm mịn lên trên'
    ]
  },

  'M104': {
    name: 'Trà Gừng Mật Ong',
    size: '250ml',
    ingredients: [
      '150ml nước sôi',
      '1 túi lọc trà đen',
      '15g gừng tươi thái lát / đập dập',
      '20ml mật ong',
      '5ml nước cốt chanh'
    ],
    steps: [
      'Ủ trà đen và gừng tươi trong nước sôi 5 phút',
      'Lọc bỏ bã, thêm mật ong và cốt chanh vào khuấy đều',
      'Dùng nóng'
    ]
  },

  /* ========== SINH TỐ ========== */

  'M201': {
    name: 'Sinh Tố Bơ',
    size: '350ml',
    ingredients: [
      '100g thịt bơ chín',
      '40ml sữa đặc',
      '30ml sữa tươi',
      '10ml nước đường',
      'Đá xay'
    ],
    steps: [
      'Cho tất cả nguyên liệu vào máy sinh tố',
      'Xay mịn nhẵn trong 30-45 giây',
      'Đổ ra ly'
    ]
  },

  'M202': {
    name: 'Sinh Tố Xoài',
    size: '350ml',
    ingredients: [
      '100g xoài chín',
      '30ml sữa đặc',
      '20ml sữa tươi',
      '10ml nước đường',
      'Đá nhuyễn'
    ],
    steps: [
      'Cho xoài, sữa đặc, sữa tươi, nước đường và đá vào máy xay',
      'Xay đến khi nhẵn mịn',
      'Đổ ra ly'
    ]
  },

  'M203': {
    name: 'Sinh Tố Dâu',
    size: '350ml',
    ingredients: [
      '80g dâu tây tươi / cấp đông',
      '30ml sữa đặc',
      '30ml sữa tươi',
      '15ml nước đường',
      'Đá nhuyễn'
    ],
    steps: [
      'Cho tất cả vào máy xay',
      'Xay nhuyễn đến khi đạt độ sánh mịn mượt',
      'Đổ ra ly'
    ]
  },

  'M204': {
    name: 'Sinh Tố Việt Quất',
    size: '350ml',
    ingredients: [
      '60g việt quất (tươi hoặc đông lạnh)',
      '30ml mứt việt quất',
      '30ml sữa đặc',
      '30ml sữa tươi',
      'Đá nhuyễn'
    ],
    steps: [
      'Cho việt quất, mứt, sữa đặc, sữa tươi và đá vào máy xay',
      'Xay nhuyễn',
      'Đổ ra ly'
    ]
  },

  /* ========== NƯỚC ÉP ========== */

  'M301': {
    name: 'Nước Ép Cam',
    size: '250ml',
    ingredients: [
      '2 quả cam sành / cam vàng',
      '15ml nước đường',
      'Đá viên'
    ],
    steps: [
      'Vắt lấy nước cam tươi (~120ml), lọc bỏ hạt',
      'Khuấy đều với nước đường',
      'Thêm đá viên'
    ]
  },

  'M302': {
    name: 'Nước Ép Táo',
    size: '250ml',
    ingredients: [
      '1-2 quả táo giòn',
      '5ml nước cốt chanh (giúp táo không bị thâm)',
      '10ml nước đường',
      'Đá viên'
    ],
    steps: [
      'Ép lấy nước táo bằng máy ép chậm',
      'Thêm chanh và nước đường khuấy đều',
      'Phục vụ cùng đá viên'
    ]
  },

  'M303': {
    name: 'Nước Ép Dưa Hấu',
    size: '250ml',
    ingredients: [
      '200g ruột dưa hấu đỏ',
      '10ml nước đường',
      '5ml nước cốt chanh',
      'Đá viên'
    ],
    steps: [
      'Cho dưa hấu vào máy ép lấy nước tươi',
      'Khuấy cùng nước đường và chanh',
      'Thêm đá'
    ]
  },

  /* ========== SODA & ĐÁ XAY ========== */

  'M401': {
    name: 'Soda Chanh',
    size: '350ml',
    ingredients: [
      '20ml nước cốt chanh tươi',
      '30ml nước đường',
      '1 lon Soda / 7Up (150ml)',
      'Lá húng lủi',
      'Đá viên'
    ],
    steps: [
      'Khuấy chanh và nước đường ở đáy ly',
      'Thêm đá đầy ly',
      'Rót soda chầm chậm lên trên, trang trí thêm lát chanh và lá húng lủi'
    ]
  },

  'M402': {
    name: 'Soda Việt Quất',
    size: '350ml',
    ingredients: [
      '35ml mứt việt quất',
      '10ml nước cốt chanh',
      '150ml nước soda',
      'Đá viên'
    ],
    steps: [
      'Cho mứt việt quất và nước chanh vào đáy ly',
      'Thêm đá viên',
      'Rót đầy soda'
    ]
  },

  'M403': {
    name: 'Đá Xay Cà Phê (Coffee Frappuccino)',
    size: '400ml',
    ingredients: [
      '40ml Espresso',
      '30ml sữa đặc',
      '30ml sữa tươi',
      '15g bột frappe (chống phân tầng)',
      'Đá viên',
      'Bông kem tươi (Whipped cream)'
    ],
    steps: [
      'Cho cà phê, sữa tươi, sữa đặc, bột frappe và đá vào máy xay công suất lớn',
      'Xay mịn',
      'Đổ ra ly và xịt kem tươi lên trên'
    ]
  },

  'M404': {
    name: 'Đá Xay Matcha (Matcha Ice Blended)',
    size: '400ml',
    ingredients: [
      '5g bột matcha',
      '40ml sữa tươi',
      '30ml sữa đặc',
      '15g bột frappe',
      'Đá viên',
      'Bông kem tươi'
    ],
    steps: [
      'Xay mịn tất cả nguyên liệu (trừ kem tươi) trong máy xay',
      'Đổ ra ly',
      'Trang trí bằng bông kem tươi rắc chút bột matcha'
    ]
  },

  /* ========== MÓN KHÁC ========== */

  'M501': {
    name: 'Sữa Chua Cà Phê',
    size: '250ml',
    ingredients: [
      '1 hũ sữa chua có đường (100g)',
      '15ml sữa đặc',
      '20ml cà phê phin (đã lắc tạo bọt)',
      'Đá dăm'
    ],
    steps: [
      'Cho sữa chua, sữa đặc và đá dăm vào ly khuấy đều',
      'Rót cà phê lắc bọt lên trên cùng'
    ]
  },

  'M502': {
    name: 'Socola Nóng',
    size: '250ml',
    ingredients: [
      '15g bột ca cao nguyên chất',
      '20ml sữa đặc',
      '180ml sữa tươi thanh trùng'
    ],
    steps: [
      'Đun nóng sữa tươi cùng sữa đặc và bột ca cao',
      'Khuấy đều tay đến khi tan mịn và đạt độ nóng mong muốn (~70°C)',
      'Rót ra ly sứ'
    ]
  },

  'M503': {
    name: 'Bánh Flan',
    size: '1 phần',
    ingredients: [
      'Trứng gà',
      'Sữa tươi',
      'Sữa đặc',
      'Đường thắng caramel'
    ],
    steps: [
      'Trút bánh flan ra đĩa nhỏ',
      'Thêm chút đá dăm',
      'Rưới 1 thìa cà phê phin đậm lên bề mặt khi mang cho khách'
    ]
  }
};