// Backups of the PC's copy, like the Android app's: up to 3, newest first, each with its reason and lesson count.
export const MAX_BACKUPS = 3;
const KEY = 'pcBackups';

/** reason: 'manual' | 'sync' (before the first phone sync of the day) | 'import' | 'restore' */
export function addBackup(list, snapshot, reason, at = new Date()) {
  const b = { id: at.toISOString() + Math.random().toString(36).slice(2, 6), createdAt: at.toISOString(), reason,
    lessonCount: snapshot.lessons.length, snapshot };
  return [b, ...list].slice(0, MAX_BACKUPS);
}

const day = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** The first phone sync of a day saves the previous copy first (never an empty one). */
const hasData = s => s.lessons.length > 0 || Object.keys(s.dayNotes ?? {}).length > 0;
export const needsSyncBackup = (list, current, at = new Date()) =>
  hasData(current) && !list.some(b => b.reason === 'sync' && day(new Date(b.createdAt)) === day(at));

export const loadBackups = store => store?.loadKey(KEY).then(v => v ?? []).catch(() => []) ?? Promise.resolve([]);
export async function saveBackup(store, snapshot, reason) {
  const list = addBackup(await loadBackups(store), snapshot, reason);
  await store.saveKey(KEY, list);
  return list;
}
