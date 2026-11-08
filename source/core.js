// One data source behind the interface the UI uses. Every change builds a new snapshot, saves it, then notifies.
import { markPaid, markUnpaid } from '../domain/paid.js';
import { parseLessonsCsv } from '../domain/csv.js';
import { planImport } from '../domain/importPlan.js';

export const emptySnapshot = () => ({ lessons: [], rateCents: null, seasonStartMonth: 11, syncedAt: null });

// strict (the iPhone, where this is the only copy): a failed save rejects and keeps the previous snapshot.
export function createSource({ status, canEdit, initial, store = null, strict = false }) {
  let snapshot = initial;
  const subs = new Set();
  // Every change runs in one queue and is built from the latest snapshot inside it: two changes at the same moment
  // (two PCs, or a PC and the iPhone) never build on the same old copy.
  let chain = Promise.resolve();
  const serial = task => { const p = chain.then(task); chain = p.catch(() => {}); return p; };
  const src = { status, canEdit, storageError: false };

  async function commit(next) {
    if (strict && store) {
      await (next ? store.save(next) : store.remove());
      snapshot = next ?? emptySnapshot();
      subs.forEach(fn => fn(snapshot));
      return;
    }
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
    return serial(() => commit({ ...snapshot, lessons: change(snapshot.lessons, ...args) }));
  };
  const nextId = lessons => Math.max(0, ...lessons.map(l => l.id)) + 1;

  return Object.assign(src, {
    subscribe(fn) { subs.add(fn); fn(snapshot); return () => subs.delete(fn); },
    /** Replace the snapshot: `next` is a value or a function of the latest snapshot (the phone side of the link). */
    apply: next => serial(() => commit(typeof next === 'function' ? next(snapshot) : next)),
    addLesson: edit((ls, l) => [...ls, { ...l, id: nextId(ls) }]),
    updateLesson: edit((ls, l) => ls.map(x => x.id === l.id ? l : x)),
    deleteLesson: edit((ls, id) => ls.filter(x => x.id !== id)),
    markPaid: edit((ls, month, paidOn) => markPaid(ls, month, paidOn)),
    markUnpaid: edit((ls, month) => markUnpaid(ls, month)),
    setRate: rateCents => serial(() => commit({ ...snapshot, rateCents })),
    setSeasonStart: seasonStartMonth => serial(() => commit({ ...snapshot, seasonStartMonth })),
    async importCsv(text) {
      const incoming = parseLessonsCsv(text);
      return serial(async () => {
        const { toAdd, skipped } = planImport(snapshot.lessons, incoming);
        let id = nextId(snapshot.lessons);
        await commit({ ...snapshot, lessons: [...snapshot.lessons, ...toAdd.map(l => ({ ...l, id: id++ }))], syncedAt: new Date().toISOString() });
        return { added: toAdd.length, skipped };
      });
    },
    clear: () => serial(() => commit(null)),
  });
}
