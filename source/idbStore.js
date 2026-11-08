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
      // Settle on the transaction, not the request: a full disk only shows up as an abort at commit time.
      const run = (mode, op) => new Promise((ok, fail) => {
        const tx = db.transaction('snapshot', mode), r = op(tx.objectStore('snapshot'));
        tx.oncomplete = () => ok(r.result);
        tx.onabort = tx.onerror = () => fail(tx.error ?? r.error);
      });
      let persisted = false;
      resolve({
        load: () => run('readonly', s => s.get(KEY)).then(v => v ?? null),
        async save(snapshot) {
          if (!persisted) { persisted = true; navigator.storage?.persist?.().catch(() => {}); }
          await run('readwrite', s => s.put(snapshot, KEY));
        },
        remove: () => run('readwrite', s => s.delete(KEY)),
        // The iPhone app's own keys: 'phone' (its data), 'pairings', 'meta'.
        loadKey: k => run('readonly', s => s.get(k)).then(v => v ?? null),
        saveKey: (k, v) => run('readwrite', s => s.put(v, k)),
        removeKey: k => run('readwrite', s => s.delete(k)),
        // The phone link record { roomId, secret, peerName, linkedAt } lives next to the snapshot.
        loadPairing: () => run('readonly', s => s.get('pairing')).then(v => v ?? null),
        savePairing: record => run('readwrite', s => s.put(record, 'pairing')),
        removePairing: () => run('readwrite', s => s.delete('pairing')),
      });
    };
  });
}
