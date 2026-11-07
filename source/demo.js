// Fake lessons for trying the app (?demo). In memory only; seeded so every load looks the same.
import { createSource, emptySnapshot } from './core.js';
import { addDays, addMonths, monthOf, today, weekdayIndex } from '../domain/dates.js';

const NAMES = ['Marco', 'Giulia', 'Luca', 'Sofia', 'Matteo', 'Chiara', 'Andrea', 'Elena', 'Tommaso', 'Anna'];
const PEAK = { 12: .85, 1: .95, 2: .95, 3: .85, 4: .55, 11: .45, 7: .15, 8: .2 }; // ski season plus a little summer glacier work
const NOTES = ['First time on skis', 'Parallel turns', 'Red run', 'Off-piste intro', 'Moguls', 'Kids group', 'Race training'];

export function demoLessons(now = today()) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lessons = [], paidBefore = addMonths(monthOf(now), -2);
  for (let d = addDays(addMonths(monthOf(now), -24) + '-01', 0); d <= now; d = addDays(d, 1)) {
    const weekend = weekdayIndex(d) >= 5 ? 1.4 : 1, n = rnd() < (PEAK[Number(d.slice(5, 7))] ?? 0) * weekend ? 1 + Math.floor(rnd() * (weekend > 1 ? 4 : 3)) : 0;
    for (let i = 0; i < n; i++) lessons.push({
      id: lessons.length + 1, date: d, durationMinutes: [60, 90, 120, 120, 180][Math.floor(rnd() * 5)],
      student: NAMES[Math.floor(Math.pow(rnd(), 1.6) * NAMES.length)], notes: rnd() < .15 ? NOTES[Math.floor(rnd() * NOTES.length)] : null,
      paidOn: monthOf(d) < paidBefore ? addDays(addMonths(monthOf(d), 1) + '-01', 4) : null,
    });
  }
  return lessons;
}

export const createDemoSource = () =>
  createSource({ status: 'demo', canEdit: true, initial: { ...emptySnapshot(), lessons: demoLessons(), rateCents: 3000 } });
