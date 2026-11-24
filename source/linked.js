// The phone, live, behind the same source interface as demo and backup (spec "PC behaviour").
// Commands go to the phone; the screen only changes when the phone sends a new snapshot.
import { parseLessonsCsv } from '../domain/csv.js';
import { normalizeEvents } from '../domain/events.js';
import { normalizeRates, ratesOf, payOf } from '../domain/rates.js';

const OLD_PHONE = 'Update Karvo on your phone to use several rates';

export function createLinkedSource(connection, store, { initial = null, timeoutMs = 15000, peerName = '' } = {}) {
  let snapshot = initial && normalizeRates(normalizeEvents(initial)), nextId = 1, oldPhone = false;
  const subs = new Set(), pending = new Map();
  const src = { status: 'linked', canEdit: true, peerName, storageError: false };

  const failAll = () => { for (const [, p] of pending) p.reject(new Error('Phone disconnected')); pending.clear(); };
  connection.on('state', s => { if (s !== 'connected') failAll(); });
  connection.on('peer', p => { src.peerName = p.name; });
  connection.on('message', async msg => {
    if (msg.t === 'snapshot') {
      const { lessons, rateCents, seasonStartMonth, timeZoneId, events = [] } = msg; // a 3.1 phone sends no events
      // A phone from before 3.8 sends one rateCents and no rates: ratesOf makes it one default rate.
      oldPhone = !Array.isArray(msg.rates);
      snapshot = { lessons, rates: ratesOf(msg), rateCents, seasonStartMonth, timeZoneId, events, syncedAt: new Date().toISOString() };
      subs.forEach(fn => fn(snapshot));
      try { await store?.save(snapshot); src.storageError = false; } catch { src.storageError = true; }
    } else if (msg.t === 'ack') {
      const p = pending.get(msg.id);
      if (!p) return; // late ack after a timeout or reconnect: already settled
      pending.delete(msg.id);
      msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error || 'The phone refused the change'));
    }
  });

  function command(op, args) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // The phone may still have applied it: say so, or a retry could add the lesson twice.
        if (pending.delete(id)) reject(new Error('No answer from the phone · check before trying again'));
      }, timeoutMs);
      pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
      connection.send('command', { id, op, args }).catch(() => {
        const p = pending.get(id);
        if (p) { pending.delete(id); p.reject(new Error('Phone disconnected')); }
      });
    });
  }

  return Object.assign(src, {
    subscribe(fn) { subs.add(fn); if (snapshot) fn(snapshot); return () => subs.delete(fn); },
    addLesson: lesson => command('addLesson', { lesson }),
    updateLesson: lesson => command('updateLesson', { lesson }),
    deleteLesson: id => command('deleteLesson', { id }),
    markPaid: (month, paidOn) => command('markPaid', { month, paidOn }),
    markUnpaid: month => command('markUnpaid', { month }),
    // A phone from before 3.8 has one rate: its amount can still be changed (setRate), nothing else.
    saveRate: rate => !oldPhone ? command('saveRate', { rate })
      : snapshot?.rates.length && rate.id === snapshot.rates[0].id || !snapshot?.rates.length ? command('setRate', { rateCents: rate.cents })
      : Promise.reject(new Error(OLD_PHONE)),
    setDefaultRate: id => oldPhone ? Promise.reject(new Error(OLD_PHONE)) : command('setDefaultRate', { id }),
    deleteRate: id => !oldPhone ? command('deleteRate', { id }) : command('setRate', { rateCents: null }),
    setSeasonStart: month => command('setSeasonStart', { month }),
    addEvent: event => command('addEvent', { event }),
    updateEvent: event => command('updateEvent', { event }),
    deleteEvent: id => command('deleteEvent', { id }),
    importCsv: async text => command('importLessons', { lessons: parseLessonsCsv(text, payOf(snapshot ?? {}).idOfTitle) }),
    restoreAll: (lessons, events = []) => command('restoreAll', { lessons, events: events.map(({ date, text }) => ({ date, text })) }),
  });
}

/** Lessons the PC could restore: only when the phone has none and the backup has some. */
export const needsRestore = (phone, backup) => phone.lessons.length === 0 ? backup?.lessons?.length ?? 0 : 0;

/**
 * The PC backup while linked. A phone that arrives with no lessons must not wipe a backup that could restore it,
 * so empty snapshots are held back until the phone has had lessons (after that, an empty phone is a real deletion).
 * allowEmpty() is for an explicit "yes, drop the PC copy".
 */
export function guardedStore(inner, backupCount) {
  let allow = backupCount === 0;
  return {
    inner,
    allowEmpty() { allow = true; },
    save(snapshot) {
      if (snapshot.lessons.length > 0) allow = true;
      return snapshot.lessons.length === 0 && !allow ? Promise.resolve() : inner.save(snapshot);
    },
  };
}
