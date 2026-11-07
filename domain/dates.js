// Dates are 'YYYY-MM-DD' strings and months 'YYYY-MM'. Arithmetic runs in UTC so DST never shifts a day.
const pad = n => String(n).padStart(2, '0');
const toUtc = date => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d || 1)); };
const fromUtc = u => `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`;

export const monthOf = date => date.slice(0, 7);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const addMonths = (month, n) => { const u = toUtc(month); u.setUTCMonth(u.getUTCMonth() + n); return fromUtc(u).slice(0, 7); };
export const addDays = (date, n) => { const u = toUtc(date); u.setUTCDate(u.getUTCDate() + n); return fromUtc(u); };
export const weekdayIndex = date => (toUtc(date).getUTCDay() + 6) % 7;
export const daysInMonth = month => Number(addDays(addMonths(month, 1) + '-01', -1).slice(8));

export function calendarDays(month) {
  const first = addDays(month + '-01', -weekdayIndex(month + '-01'));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function formatHours(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (m === 0) return `${h} h`;
  if (m === 30) return `${h}.5 h`;
  return h ? `${h} h ${m}` : `${m} min`;
}

/** Today in another time zone (the phone's setting), falling back to this computer's today. */
export function todayIn(timeZone, at = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at); }
  catch { return today(); }
}
