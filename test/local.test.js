import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalSource } from '../source/local.js';

const fakeStore = () => ({ keys: {}, async loadKey(k) { return this.keys[k] ?? null; }, async saveKey(k, v) { this.keys[k] = v; }, async removeKey(k) { delete this.keys[k]; } });

test('the iPhone source is editable and saves under its own key', async () => {
  const store = fakeStore();
  const src = await createLocalSource(store);
  assert.equal(src.canEdit, true);
  assert.equal(src.status, 'phone');
  await src.addLesson({ date: '2026-11-08', durationMinutes: 60, student: 'Anna', notes: null, paidOn: null });
  assert.equal(store.keys.phone.lessons.length, 1);
  assert.ok(store.keys.phone.timeZoneId);
  const again = await createLocalSource(store);
  let snap; again.subscribe(s => { snap = s; })();
  assert.equal(snap.lessons[0].student, 'Anna');
});
