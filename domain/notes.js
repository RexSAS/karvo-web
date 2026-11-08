// Day notes: one short note per day, { 'YYYY-MM-DD': text }. Same rules on every platform.
export const MAX_NOTE = 200;

/** New notes map with [date]'s note set (trimmed) or removed (null/blank). */
export function setNote(notes, date, text) {
  const next = { ...(notes ?? {}) };
  const t = typeof text === 'string' ? text.trim() : '';
  if (t) next[date] = t; else delete next[date];
  return next;
}

/** Today's and future notes, soonest first. */
export const upcomingNotes = (notes, today) =>
  Object.entries(notes ?? {}).filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b)).map(([date, text]) => ({ date, text }));
