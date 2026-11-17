// Statistics for the bottom row; student matching follows Android Stats.kt.
import { monthOf, weekdayIndex, addMonths } from './dates.js';
import { seasonMonths, seasonOf, seasonLabel } from './seasons.js';

const TOP = 4;
export const studentKey = name => name.trim().toLowerCase();

/** One entry per student (case/space-insensitive), named by the most recent lesson; minutes desc, then name. */
export function students(lessons) {
  const groups = new Map();
  for (const l of lessons) {
    const g = groups.get(studentKey(l.student)) ?? { latest: l, minutes: 0 };
    g.minutes += l.durationMinutes;
    if (l.date > g.latest.date || (l.date === g.latest.date && l.id > g.latest.id)) g.latest = l;
    groups.set(studentKey(l.student), g);
  }
  return [...groups.values()].map(g => ({ name: g.latest.student.trim(), minutes: g.minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

export function seasonStats(lessons, season) {
  const months = seasonMonths(season), inS = lessons.filter(l => months.includes(monthOf(l.date)));
  const all = students(inS), weekdayMinutes = Array(7).fill(0);
  inS.forEach(l => { weekdayMinutes[weekdayIndex(l.date)] += l.durationMinutes; });
  return {
    minutes: inS.reduce((s, l) => s + l.durationMinutes, 0),
    lessonCount: inS.length,
    perMonth: months.map(month => ({ month, minutes: inS.filter(l => monthOf(l.date) === month).reduce((s, l) => s + l.durationMinutes, 0) })),
    top: all.slice(0, TOP),
    otherMinutes: all.slice(TOP).reduce((s, x) => s + x.minutes, 0),
    weekdayMinutes,
  };
}

/** Every lesson ever: totals, hours per season (oldest first), top students and weekdays. */
export function lifetimeStats(lessons, startMonth) {
  const all = students(lessons), weekdayMinutes = Array(7).fill(0), bySeason = new Map();
  lessons.forEach(l => {
    weekdayMinutes[weekdayIndex(l.date)] += l.durationMinutes;
    const k = seasonOf(l.date, startMonth).startYear;
    bySeason.set(k, (bySeason.get(k) ?? 0) + l.durationMinutes);
  });
  const years = [...bySeason.keys()].sort((a, b) => a - b);
  const perSeason = years.length ? Array.from({ length: years.at(-1) - years[0] + 1 }, (_, i) => years[0] + i)
    .map(y => ({ label: seasonLabel({ startYear: y, startMonth }), minutes: bySeason.get(y) ?? 0 })) : [];
  return {
    minutes: lessons.reduce((s, l) => s + l.durationMinutes, 0), lessonCount: lessons.length, perSeason,
    top: all.slice(0, TOP), otherMinutes: all.slice(TOP).reduce((s, x) => s + x.minutes, 0), weekdayMinutes,
  };
}

const sumMin = ls => ls.reduce((s, l) => s + l.durationMinutes, 0);
const inS = (date, season) => seasonMonths(season).includes(monthOf(date));

/** Last season's minutes up to the same date a year ago (Android computeSeasons); null when last season had no lessons. */
export function lastSeasonToDate(lessons, today, startMonth) {
  const cur = seasonOf(today, startMonth), prev = { startYear: cur.startYear - 1, startMonth };
  const items = lessons.filter(l => inS(l.date, prev));
  if (!items.length) return null;
  // 29 Feb a year back becomes 28 Feb, as Java's minusYears does.
  const y = Number(today.slice(0, 4)) - 1, md = today.slice(5) === '02-29' ? '02-28' : today.slice(5);
  return sumMin(items.filter(l => l.date <= `${y}-${md}`));
}

/** Android computeStudent: everything about one student (studentKey), or null when they have no lessons. */
export function studentDetail(lessons, key, today, startMonth) {
  const theirs = lessons.filter(l => studentKey(l.student) === key);
  if (!theirs.length) return null;
  const byDate = (a, b) => a.date.localeCompare(b.date) || a.id - b.id, sorted = [...theirs].sort(byDate);
  const total = sumMin(theirs), n = theirs.length, season = seasonOf(today, startMonth);
  const months = [...new Set(sorted.map(l => monthOf(l.date)))].reverse();
  return {
    name: sorted.at(-1).student.trim(), totalMinutes: total, lessonCount: n,
    averageMinutes: Math.floor((total * 2 + n) / (2 * n)), // half-up
    firstLesson: sorted[0].date, lastLesson: sorted.at(-1).date,
    lastSixMonths: Array.from({ length: 6 }, (_, i) => addMonths(monthOf(today), i - 5))
      .map(month => ({ month, minutes: sumMin(theirs.filter(l => monthOf(l.date) === month)) })),
    season, thisSeasonMinutes: sumMin(theirs.filter(l => inS(l.date, season))),
    lastSeasonMinutes: sumMin(theirs.filter(l => inS(l.date, { startYear: season.startYear - 1, startMonth }))),
    months: months.map(month => {
      const ls = theirs.filter(l => monthOf(l.date) === month).sort(byDate).reverse();
      return { month, minutes: sumMin(ls), lessons: ls };
    }),
  };
}

/**
 * Android seasonWelcome: the card for the first open in a new season, or null. welcomedSeason null (fresh app or first
 * run of this version) shows nothing; the caller then stores today's season start year either way.
 */
export function seasonWelcome(lessons, today, startMonth, welcomedSeason) {
  const season = seasonOf(today, startMonth);
  if (welcomedSeason == null || welcomedSeason >= season.startYear || !lessons.length) return null;
  const last = { startYear: season.startYear - 1, startMonth }, inLast = lessons.filter(l => inS(l.date, last));
  const months = [...new Set(inLast.map(l => monthOf(l.date)))];
  return {
    season, last, minutes: sumMin(inLast), lessonCount: inLast.length,
    students: new Set(inLast.map(l => studentKey(l.student))).size,
    unpaidMonths: months.filter(m => inLast.some(l => monthOf(l.date) === m && !l.paidOn)).length,
  };
}
