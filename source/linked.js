// The phone, live, behind the same source interface as demo and backup (spec "PC behaviour").
// Commands go to the phone; the screen only changes when the phone sends a new snapshot.
import { parseLessonsCsv } from '../domain/csv.js';

export function createLinkedSource(connection, store, { initial = null, timeoutMs = 15000, peerName = '' } = {}) {
  let snapshot = initial, nextId = 1;
  const subs = new Set(), pending = new Map();
  const src = { status: 'linked', canEdit: true, peerName, storageError: false };

  const failAll = () => { for (const [, p] of pending) p.reject(new Error('Phone disconnected')); pending.clear(); };
  connection.on('state', s => { if (s !== 'connected') failAll(); });
  connection.on('peer', p => { src.peerName = p.name; });
  connection.on('message', async msg => {
    if (msg.t === 'snapshot') {
      const { lessons, rateCents, seasonStartMonth, timeZoneId } = msg;
      snapshot = { lessons, rateCents, seasonStartMonth, timeZoneId, syncedAt: new Date().toISOString() };
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
      const timer = setTimeout(() => { if (pending.delete(id)) reject(new Error('Phone disconnected')); }, timeoutMs);
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
    setRate: rateCents => command('setRate', { rateCents }),
    setSeasonStart: month => command('setSeasonStart', { month }),
    importCsv: async text => command('importLessons', { lessons: parseLessonsCsv(text) }),
    restoreAll: lessons => command('restoreAll', { lessons }),
  });
}

/** Lessons the PC could restore: only when the phone has none and the backup has some. */
export const needsRestore = (phone, backup) => phone.lessons.length === 0 ? backup?.lessons?.length ?? 0 : 0;

/**
 * The PC backup while linked. A phone with no lessons must not wipe a backup that could restore it,
 * so empty snapshots are held back until the user answers the restore question (allowEmpty).
 */
export function guardedStore(inner, backupCount) {
  let allow = backupCount === 0;
  return {
    inner,
    allowEmpty() { allow = true; },
    save: snapshot => (snapshot.lessons.length === 0 && !allow ? Promise.resolve() : inner.save(snapshot)),
  };
}
