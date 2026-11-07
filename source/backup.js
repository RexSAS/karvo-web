// The PC's copy of the phone's data. Lessons are read-only; CSV import, rate and season start stay editable
// (project 2 makes the phone's values win once linked).
import { createSource, emptySnapshot } from './core.js';

export async function createBackupSource(store) {
  let initial = null, loadFailed = false;
  try { initial = await store.load(); } catch { loadFailed = true; }
  // A backup we couldn't read must never be overwritten: without a store the app works in memory only.
  const src = createSource({ status: 'backup', canEdit: false, initial: initial ?? emptySnapshot(), store: loadFailed ? null : store });
  src.storageError = loadFailed;
  return src;
}
