// One data source behind the interface the UI uses. Every change builds a new snapshot, saves it, then notifies.
import { markPaid, markUnpaid } from '../domain/paid.js';
import { parseLessonsCsv } from '../domain/csv.js';
import { planImport } from '../domain/importPlan.js';

export const emptySnapshot = () => ({ lessons: [], rateCents: null, seasonStartMonth: 11, syncedAt: null });

export function createSource({ status, canEdit, initial, store = null }) {
  let snapshot = initial;
  const subs = new Set();
  const src = { status, canEdit, storageError: false };

  async function commit(next) {
    snapshot = next;
    if (store) {
      try { await (next ? store.save(next) : store.remove()); src.storageError = false; }
      catch { src.storageError = true; }
    }
    if (!next) snapshot = emptySnapshot();
    subs.forEach(fn => fn(snapshot));
  }
  const edit = change => async (...args) => {
    if (!canEdit) throw new Error('read-only');
    await commit({ ...snapshot, lessons: change(snapshot.lessons, ...args) });
  };
  const nextId = lessons => Math.max(0, ...lessons.map(l => l.id)) + 1;

  return Object.assign(src, {
    subscribe(fn) { subs.add(fn); fn(snapshot); return () => subs.delete(fn); },
    addLesson: edit((ls, l) => [...ls, { ...l, id: nextId(ls) }]),
    updateLesson: edit((ls, l) => ls.map(x => x.id === l.id ? l : x)),
    deleteLesson: edit((ls, id) => ls.filter(x => x.id !== id)),
    markPaid: edit((ls, month, paidOn) => markPaid(ls, month, paidOn)),
    markUnpaid: edit((ls, month) => markUnpaid(ls, month)),
    setRate: rateCents => commit({ ...snapshot, rateCents }),
    setSeasonStart: seasonStartMonth => commit({ ...snapshot, seasonStartMonth }),
    async importCsv(text) {
      const { toAdd, skipped } = planImport(snapshot.lessons, parseLessonsCsv(text));
      let id = nextId(snapshot.lessons);
      await commit({ ...snapshot, lessons: [...snapshot.lessons, ...toAdd.map(l => ({ ...l, id: id++ }))], syncedAt: new Date().toISOString() });
      return { added: toAdd.length, skipped };
    },
    clear: () => commit(null),
  });
}
