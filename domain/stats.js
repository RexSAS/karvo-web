// Statistics for the bottom row; student matching follows Android Stats.kt.
import { monthOf, weekdayIndex } from './dates.js';
import { seasonMonths } from './seasons.js';

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
