// The iPhone's own lessons (the master copy), editable, saved under the 'phone' key. A failed save is an error, not a
// silent in-memory change: on the iPhone there is no other copy.
import { createSource, emptySnapshot } from './core.js';

export async function createLocalSource(store) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const initial = { ...emptySnapshot(), ...(await store.loadKey('phone')), timeZoneId: zone };
  return createSource({ status: 'phone', canEdit: true, initial, strict: true,
    store: { save: s => store.saveKey('phone', { ...s, timeZoneId: zone }), remove: () => store.removeKey('phone') } });
}
