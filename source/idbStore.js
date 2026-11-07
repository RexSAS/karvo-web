// The backup snapshot in IndexedDB: database 'karvo', store 'snapshot', one record under key 'current'.
const KEY = 'current';

export function openStore() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open('karvo', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('snapshot');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const run = (mode, op) => new Promise((ok, fail) => {
        const r = op(db.transaction('snapshot', mode).objectStore('snapshot'));
        r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
      });
      let persisted = false;
      resolve({
        load: () => run('readonly', s => s.get(KEY)).then(v => v ?? null),
        async save(snapshot) {
          if (!persisted) { persisted = true; navigator.storage?.persist?.().catch(() => {}); }
          await run('readwrite', s => s.put(snapshot, KEY));
        },
        remove: () => run('readwrite', s => s.delete(KEY)),
      });
    };
  });
}
