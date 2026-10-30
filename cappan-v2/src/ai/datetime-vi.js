const WEEKDAYS = new Map([
  ['chủ nhật', 0], ['thứ hai', 1], ['thứ ba', 2], ['thứ tư', 3],
  ['thứ năm', 4], ['thứ sáu', 5], ['thứ bảy', 6]
]);

const pad = (value) => String(value).padStart(2, '0');
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function findDate(text, now) {
  const source = text.toLocaleLowerCase('vi');
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\bhôm nay\b/.test(source)) return formatDate(base);
  if (/\bmai\b/.test(source)) { base.setDate(base.getDate() + 1); return formatDate(base); }
  if (/\b(?:mốt|ngày kia)\b/.test(source)) { base.setDate(base.getDate() + 2); return formatDate(base); }

  for (const [label, weekday] of WEEKDAYS) {
    if (source.includes(label)) {
      let delta = (weekday - base.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      base.setDate(base.getDate() + delta);
      return formatDate(base);
    }
  }

  const full = source.match(/(?:ngày\s*)?(\d{1,2})\s*[/-]\s*(\d{1,2})(?!\d)/);
  if (full) {
    const day = Number(full[1]);
    const month = Number(full[2]);
    let year = now.getFullYear();
    let candidate = new Date(year, month - 1, day);
    if (candidate.getDate() !== day || candidate.getMonth() !== month - 1) return undefined;
    if (candidate < base) { year += 1; candidate = new Date(year, month - 1, day); }
    return formatDate(candidate);
  }

  const dayOnly = source.match(/\bngày\s+(\d{1,2})\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day < 1 || day > 31) return undefined;
    let candidate = new Date(now.getFullYear(), now.getMonth(), day);
    if (candidate.getDate() !== day || candidate < base) {
      candidate = new Date(now.getFullYear(), now.getMonth() + 1, day);
    }
    return candidate.getDate() === day ? formatDate(candidate) : undefined;
  }
  return undefined;
}

function findTime(text) {
  const source = text.toLocaleLowerCase('vi');
  const match = source.match(/\b(\d{1,2})\s*(?:(:|h)\s*(\d{2})?|giờ)\s*(sáng|trưa|chiều|tối)?\b/);
  if (!match) return undefined;
  const hourRaw = Number(match[1]);
  const minute = Number(match[3] || 0);
  const period = match[4];
  if (minute > 59) return undefined;
  if (!period && hourRaw >= 13 && hourRaw <= 23) return `${pad(hourRaw)}:${pad(minute)}`;
  if (period) {
    if (hourRaw < 1 || hourRaw > 12) return undefined;
    let hour = hourRaw % 12;
    if (period === 'trưa') hour += 12;
    if (period === 'chiều' || period === 'tối') hour += 12;
    return `${pad(hour)}:${pad(minute)}`;
  }
  if (hourRaw >= 1 && hourRaw <= 12) return null;
  return undefined;
}

export function parseWhen(text, now = new Date()) {
  const source = String(text ?? '');
  const date = findDate(source, now);
  const parsedTime = findTime(source);
  const result = {};
  if (date) result.date = date;
  if (typeof parsedTime === 'string') result.time = parsedTime;
  const ambiguous = [];
  if (!date) ambiguous.push('date');
  if (parsedTime === null) ambiguous.push('time');
  else if (parsedTime === undefined) ambiguous.push('time');
  if (ambiguous.length) result.ambiguous = ambiguous;
  return result;
}
