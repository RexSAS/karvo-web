// Same as Android Paid.kt and LessonDao.markPaid/markUnpaid: payment is tracked per month.
import { earningsCents } from './earnings.js';
import { monthOf } from './dates.js';

const sum = ls => ls.reduce((s, l) => s + l.durationMinutes, 0);

export function paidStatus(lessons) {
  const paid = lessons.filter(l => l.paidOn).length;
  return paid === 0 ? 'UNPAID' : paid === lessons.length ? 'PAID' : 'PARTLY_PAID';
}

export const monthPaidOn = lessons => lessons.map(l => l.paidOn).filter(Boolean).sort().pop() ?? null;

export const markPaid = (lessons, month, paidOn) =>
  lessons.map(l => monthOf(l.date) === month && !l.paidOn ? { ...l, paidOn } : l);

export const markUnpaid = (lessons, month) =>
  lessons.map(l => monthOf(l.date) === month ? { ...l, paidOn: null } : l);

/** What the school still owes: unpaid lessons up to today (future lessons aren't owed yet). */
export function unpaidTotals(lessons, today, rateCents) {
  const owed = lessons.filter(l => !l.paidOn && l.date <= today), groups = {};
  owed.forEach(l => (groups[monthOf(l.date)] ??= []).push(l));
  const byMonth = Object.keys(groups).sort().map(month => {
    const minutes = sum(groups[month]);
    return { month, minutes, earningsCents: earningsCents(minutes, rateCents) };
  });
  const minutes = sum(owed);
  return { months: byMonth.length, minutes, earningsCents: earningsCents(minutes, rateCents), byMonth };
}
