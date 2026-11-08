// Events: several per day, { id, date: 'YYYY-MM-DD', text } (≤ 200 chars, trimmed). Same rules on every platform.
import { addDays } from './dates.js';

export const MAX_EVENT = 200;
const nextId = events => Math.max(0, ...events.map(e => e.id)) + 1;

export const addEvent = (events, { date, text }) => [...events, { id: nextId(events), date, text: text.trim() }];
export const updateEvent = (events, { id, date, text }) => events.map(e => (e.id === id ? { id, date, text: text.trim() } : e));
export const deleteEvent = (events, id) => events.filter(e => e.id !== id);
export const eventsOn = (events, date) => (events ?? []).filter(e => e.date === date).sort((a, b) => a.id - b.id);

/** Days from today to today+[days] that have events: [{ date, inDays, events }]. */
export function upcomingDays(events, today, days = 3) {
  return Array.from({ length: days + 1 }, (_, i) => ({ date: addDays(today, i), inDays: i }))
    .map(d => ({ ...d, events: eventsOn(events, d.date) })).filter(d => d.events.length);
}

/** Data saved before events existed had one note per day ({ dayNotes: { date: text } }): turn it into events. */
export function normalizeEvents(snapshot) {
  if (Array.isArray(snapshot.events)) return snapshot;
  const { dayNotes, ...rest } = snapshot;
  return { ...rest, events: Object.entries(dayNotes ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([date, text], i) => ({ id: i + 1, date, text })) };
}

/** Adds [incoming] ({ date, text }) to [events], skipping ones that already exist with the same date and text. */
export function mergeEvents(events, incoming) {
  let out = [...events];
  for (const e of incoming) if (!out.some(x => x.date === e.date && x.text === e.text.trim())) out = addEvent(out, e);
  return out;
}
