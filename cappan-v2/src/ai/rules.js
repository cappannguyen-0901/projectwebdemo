/* ============================================================
   CAPPAN v2 — AI RULES (thuần, KHÔNG DOM / KHÔNG import facade)
   Mỗi rule cùng 1 HÌNH DẠNG: { id, priority, test(n, ctx), reply(ctx) }
   - n: chuỗi đã qua normVN (không dấu, lowercase)
   - ctx: { menu: MenuItem[], user: {name?, role?} | null }
   - match() đi từ priority cao → thấp, rule đầu khớp thắng.
   Nguồn câu chữ: brain.js legacy (Buffett KB: hotline/wifi/hours/policy).
   ============================================================ */

export const KB = {
  hotline: '0366 444 038',
  wifi: { name: 'CAPPAN_Free', password: 'cappannguyen' },
  hours: '07:00 - 22:30',
  address: 'Công viên Gia Định, Q. Gò Vấp',
  shipNote: 'CAPPAN giao hàng trong bán kính 3km, phí ship 15.000đ',
  newDrinks: 'Món mới: Cà Phê Muối (M006) — vị mặn nhẹ độc đáo',
  viewZone: 'Tầng thượng (F4) có view thành phố đẹp nhất, đặc biệt về đêm'
};

/* normalize Việt-noaccent: legacy normJB giữ nguyên hành vi (NFD + bỏ đ) */
export function normVN(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Gợi ý món: TỪ CATALOG (ctx.menu) — địa chỉ "hết món" tuyệt đối được tôn trọng.
   Chấm điểm: name khớp từ khóa +3, categoryId khớp +2, badge "Mới"/"Hot" +1. */
export function recommend(input, ctx, limit = 3) {
  const n = normVN(input);
  const MENU_HINTS = [
    { re: /\b(ca phe|coffee|den|bac xiu|latte|capuchino|cappuccino)\b/, cat: 'coffee' },
    { re: /\b(tra|tea|dao|cam sa|matcha|sen|gung)\b/, cat: 'tea' },
    { re: /\b(sinh to|smoothie|bo|xoai|dau tay|viet quat)\b/, cat: 'smoothie' },
    { re: /\b(nuoc ep|juice|cam|tao|dua hau)\b/, cat: 'juice' },
    { re: /\b(soda|chanh)\b/, cat: 'soda' },
    { re: /\b(da xay|socola|chocolate|sua chua|banh|flan|an vat)\b/, cat: 'other' },
    { re: /\b(ngot|khong ca phe|cafein|de ngu)\b/, cat: 'smoothie' }
  ];
  const words = n.split(' ').filter((w) => w.length >= 3);
  const scored = (ctx.menu || [])
    .filter((m) => m.inStock)
    .map((m) => {
      let score = 0;
      const nm = normVN(m.name);
      if (words.some((w) => nm.includes(w))) score += 3;
      if (MENU_HINTS.some((h) => h.re.test(n) && h.cat === m.categoryId)) score += 2;
      if (m.badge === 'Mới' || m.badge === 'Hot') score += 1;
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.m.price - b.m.price);
  const fmt = (m) => `• ${m.name} — ${m.price.toLocaleString('vi-VN')}đ`;
  const list = scored.slice(0, limit).map((x) => fmt(x.m));
  if (!list.length) return null; /* để rule fallback khác xử lý */
  return { text: `Dạ em gợi ý mấy món này nhé ạ:\n${list.join('\n')}\nAnh/chị xem thêm ở trang menu ạ!` };
}

export const RULES = [
  {
    id: 'greeting',
    priority: 100,
    test: (n) => /\b(chao|hello|hi|alo|xin chao|good ?(morning|evening))\b/.test(n) && !/\b(gia|bao nhieu|mon|dat)\b/.test(n),
    reply: () => ({ text: 'Dạ em chào anh/chị ạ. Anh/chị cần em tư vấn món, đặt bàn hay hỗ trợ gì khác ạ?' })
  },
  {
    /* Self-service không có trong v2 → hướng sang profile thay vì để LLM tự bịa */
    id: 'self-update-info',
    priority: 92,
    test: (n) =>
      /\b(doi|sua|thay|cap nhat)\b/.test(n) && /\b(dia chi|thong tin|so dien thoai|ten)\b/.test(n),
    reply: () => ({ text: 'Dạ em chưa sửa thông tin giúp anh/chị được — anh/chị bấm "Hồ sơ" (profile.html) để tự đổi tên/địa chỉ mặc định nhé ạ. 😊' })
  },
  {
    id: 'thanks',
    priority: 98,
    test: (n) => /\b(cam on|thanks|thank you|tks)\b/.test(n),
    reply: () => ({ text: 'Dạ không có gì ạ. Nếu cần gì em luôn sẵn sàng hỗ trợ nhé ạ.' })
  },
  {
    id: 'ack-colloquial',
    priority: 96,
    test: (n) => /^(ok|oke|uh|um|d|da|hihi|k)$/.test(n),
    reply: () => ({ text: 'Dạ anh/chị cần gì cứ nói với em ạ.' })
  },
  {
    id: 'wifi',
    priority: 80,
    test: (n) => /\b(wifi|mat khau wifi)\b/.test(n),
    reply: () => ({ text: `Dạ wifi quán: ${KB.wifi.name} | Mật khẩu: ${KB.wifi.password} ạ.` })
  },
  {
    id: 'hours',
    priority: 70,
    test: (n) => /\b(gio mo cua|mo cua|dong cua|may gio mo|gio hoat dong|may gio dong)\b/.test(n),
    reply: () => ({ text: `Dạ quán mở cửa: ${KB.hours} hàng ngày ạ.` })
  },
  {
    id: 'hotline',
    priority: 65,
    test: (n) => /\b(hotline|lien he|so dien thoai quan|ho tro)\b/.test(n),
    reply: () => ({ text: `Dạ hotline hỗ trợ: ${KB.hotline} ạ.` })
  },
  {
    id: 'parking',
    priority: 60,
    test: (n) => /\b(gui xe|dau xe|bai xe|parking)\b/.test(n),
    reply: () => ({ text: 'Dạ quán có chỗ đậu xe miễn phí phía sau quán ạ.' })
  },
  {
    id: 'no-smoking',
    priority: 55,
    test: (n) => /\b(hut thuoc|thuoc la)\b/.test(n),
    reply: () => ({ text: 'Dạ CAPPAN là không gian không khói thuốc ạ, anh/chị vui lòng không hút thuốc trong quán.' })
  },
  {
    id: 'no-pets',
    priority: 54,
    test: (n) => /\b(thu cung|cho meo|con meo|meo cua khach|pet|vat nuoi)\b/.test(n),
    reply: () => ({ text: 'Dạ CAPPAN không cho phép mang thú cưng vào quán ạ, để đảm bảo vệ sinh chung.' })
  },
  {
    id: 'no-app',
    priority: 53,
    test: (n) => /\b(app|ung dung|tai app|cai app)\b/.test(n),
    reply: () => ({ text: 'Dạ hiện tại CAPPAN chưa có app riêng ạ. Anh/chị dùng website để đặt chỗ và đặt nước ạ.' })
  },
  {
    id: 'no-jobs',
    priority: 52,
    test: (n) => /\b(tuyen dung|xin viec|tri lam|tim viec)\b/.test(n),
    reply: () => ({ text: `Dạ hiện tại CAPPAN chưa có đợt tuyển dụng. Anh/chị theo dõi fanpage hoặc gọi hotline ${KB.hotline} nhé ạ.` })
  },
  {
    id: 'only-branch',
    priority: 51,
    test: (n) => /\b(chi nhanh|co so|dia diem khac|quan khac)\b/.test(n),
    reply: () => ({ text: `Dạ hiện tại CAPPAN chỉ có 1 chi nhánh tại ${KB.address} ạ.` })
  },
  {
    id: 'party',
    priority: 50,
    test: (n) => /\b(tiec|sinh nhat|su kien|doan dong|dat tiec)\b/.test(n),
    reply: () => ({ text: `Dạ CAPPAN có nhận đặt tiệc riêng cho đoàn từ 10 người. Anh/chị vui lòng gọi hotline ${KB.hotline} để được tư vấn ạ.` })
  },
  {
    id: 'privacy',
    priority: 49,
    test: (n) => /\b(bao mat|du lieu ca nhan|quyen rieng tu|thong tin ca nhan)\b/.test(n),
    reply: () => ({ text: 'Dạ thông tin của anh/chị chỉ dùng để đặt chỗ và đặt nước. Chi tiết xem trang "Chính sách bảo mật" ở cuối website ạ.' })
  },
  {
    id: 'is-bot',
    priority: 48,
    test: (n) => /\b(ban la ai|la ai|may tinh|robot|chatbot|nguoi that)\b/.test(n),
    reply: () => ({ text: `Dạ em là AI của CAPPAN, không phải người thật. Em có thể nhầm — thông tin quan trọng anh/chị gọi hotline ${KB.hotline} ạ.` })
  },
  {
    id: 'ac',
    priority: 47,
    test: (n) => /\b(may lanh|lam khong|nhiet do|chem khau)\b/.test(n),
    reply: () => ({ text: 'Dạ quán có máy lạnh ở khu trong nhà, các khu ngoài trời thoáng mát ạ.' })
  },
  {
    id: 'outlet',
    priority: 46,
    test: (n) => /\b(o cam|sac dien thoai|cong sac|sac dien)\b/.test(n),
    reply: () => ({ text: 'Dạ quán có ổ cắm điện tại mọi bàn, anh/chị sạc điện thoại thoải mái nha ạ.' })
  },
  {
    id: 'delivery',
    priority: 45,
    test: (n) => /\b(giao hang|ship|deliver|van chuyen)\b/.test(n),
    reply: () => ({ text: `Dạ có ạ. ${KB.shipNote} ạ.` })
  },
  {
    /* CẮT địa chỉ quán khỏi "đổi địa chỉ" (self-service, KHÔNG trả KB lè ra như legacy bug) */
    id: 'address',
    priority: 44,
    test: (n) =>
      /\b(dia chi|o dau|quan o).\b/.test(n) &&
      !/\b(doi dia chi|cap nhat dia chi|doi thong tin|dia chi giao hang)\b/.test(n) && /* update-address = NOT here */
      !/\b(mon|do uong|quan ao|ao quan|xom|nha rieng)\b/.test(n),
    reply: () => ({ text: `Dạ địa chỉ quán: ${KB.address} ạ. Hỗ trợ giao ${KB.shipNote.toLowerCase()}` })
  },
  {
    id: 'food',
    priority: 40,
    test: (n) => /\b(do an|mon an|an vat|an nhe|ban do an)\b/.test(n),
    reply: () => ({ text: `Dạ CAPPAN chủ yếu phục vụ đồ uống, món ăn hiện có là Bánh Flan. Món khác anh/chị gọi hotline ${KB.hotline} để hỏi thêm nhé ạ.` })
  },
  {
    id: 'vegan',
    priority: 39,
    test: (n) => /\b(mon chay|an chay|co chay|vegan)\b/.test(n),
    reply: () => ({ text: 'Dạ CAPPAN chưa có menu chay riêng, nhưng có Sinh tố Bơ, Sinh tố Xoài, Nước Ép Cam, Trà Sen Vàng phù hợp ạ.' })
  },
  {
    id: 'new-drinks',
    priority: 38,
    test: (n) => /\b(mon moi|moi ra mat|mon ngon moi)\b/.test(n),
    reply: () => ({ text: `Dạ ${KB.newDrinks}. ${KB.viewZone} ạ.` })
  },
  {
    id: 'view-zone',
    priority: 37,
    test: (n) => /\b(view|tam giac|tang thuong|ngoai troi|goc dep)\b/.test(n),
    reply: () => ({ text: `Dạ ${KB.viewZone}. Anh/chị đặt chỗ ở menu "Đặt bàn" nhé ạ.` })
  },
  {
    /* TASTE-AWARE: gợi ý từ catalog, ví dụ "muốn cho ngọt ngào / giải khát..." */
    id: 'recommend',
    priority: 30,
    test: (n, ctx) => /\b(goi y|khuyen|ngot|chua|lanh|nong|ca phe|tra|sinh to|nuoc ep|soda|socola|gioi thieu)\b/.test(n) && !!recommend(n, ctx),
    reply: (n, ctx) => recommend(n, ctx)
  }
];

/* match: đi từ priority cao nhất. Rule đầu khớp trả { ruleId, text } */
export function match(input, ctx = {}) {
  const n = normVN(input);
  if (!n) return null;
  const sorted = [...RULES].sort((a, b) => b.priority - a.priority);
  for (const r of sorted) {
    let hit = false;
    try {
      hit = !!r.test(n, ctx);
    } catch {
      hit = false; /* bug rule không được nổ app — bỏ qua rule đó */
    }
    if (hit) {
      try {
        return { ruleId: r.id, priority: r.priority, ...r.reply(n, ctx) };
      } catch {
        return null;
      }
    }
  }
  return null;
}
