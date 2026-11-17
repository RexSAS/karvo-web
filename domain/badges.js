// Same as Android Badges.kt: the hours taught in one season unlock 14 badges in order.
export const BADGES = [
  ['karver', 1], ['firstSnow', 5], ['bunnyHill', 10], ['snowplough', 25], ['redRun', 50], ['parallel', 75],
  ['edgeMaster', 100], ['blackRun', 150], ['moguls', 200], ['offPiste', 250], ['powder', 300], ['freerider', 400],
  ['snowKing', 500], ['legend', 600],
].map(([id, hours], i) => ({ id, hours, minutes: hours * 60, index: i, tier: Math.min(Math.floor(i / 3), 4), step: i - Math.min(Math.floor(i / 3), 4) * 3 }));

/** earned: best badge reached (null: none); next: the one after (null: all earned); fraction 0..1 between them. */
export function badgeProgress(minutes) {
  const earned = BADGES.findLast(b => minutes >= b.minutes) ?? null, next = BADGES.find(b => minutes < b.minutes) ?? null;
  const from = earned?.minutes ?? 0;
  return { earned, next, minutes, fraction: next ? Math.min(1, Math.max(0, (minutes - from) / (next.minutes - from))) : 1,
    minutesToNext: next ? next.minutes - minutes : 0 };
}

/** What was last celebrated, kept as "startYear:index" (-1: no badge yet that season). */
export const badgeMark = (season, badge) => `${season.startYear}:${badge?.index ?? -1}`;

/** The badge to celebrate now: [earned] when it beats [mark] in the same season, or any badge in a new season (or with no mark). */
export function badgeToAnnounce(season, earned, mark) {
  if (!earned) return null;
  const p = String(mark ?? '').split(':').map(Number);
  if (p.length !== 2 || p.some(Number.isNaN)) return earned;
  return p[0] !== season.startYear || earned.index > p[1] ? earned : null;
}
