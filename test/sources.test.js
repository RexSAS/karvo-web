import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSource } from '../source/demo.js';
import { createBackupSource } from '../source/backup.js';
import { BackupFormatError } from '../domain/csv.js';

const fakeStore = (data = null) => ({ data, async load() { return this.data; }, async save(s) { this.data = s; }, async remove() { this.data = null; } });
const CSV = 'date,student,duration_minutes,duration_hours,notes,paid_on\r\n2026-01-05,Anna,60,1,,\r\n2026-01-06,Bo,90,1.5,,\r\n';
const last = src => { let snap; src.subscribe(s => { snap = s; })(); return snap; };

test('demo: adding a lesson notifies with a fresh id', async () => {
  const src = createDemoSource(), seen = [];
  src.subscribe(s => seen.push(s));
  const before = seen.at(-1).lessons, maxId = Math.max(0, ...before.map(l => l.id));
  await src.addLesson({ date: '2026-01-05', durationMinutes: 60, student: 'Zed', notes: null, paidOn: null });
  const added = seen.at(-1).lessons.find(l => l.student === 'Zed');
  assert.equal(added.id, maxId + 1);
  assert.equal(seen.at(-1).lessons.length, before.length + 1);
});

test('demo: markPaid and markUnpaid change a whole month', async () => {
  const src = createDemoSource();
  const month = last(src).lessons[0].date.slice(0, 7);
  await src.markUnpaid(month);
  assert.ok(last(src).lessons.filter(l => l.date.startsWith(month)).every(l => !l.paidOn));
  await src.markPaid(month, '2026-11-07');
  assert.ok(last(src).lessons.filter(l => l.date.startsWith(month)).every(l => l.paidOn === '2026-11-07'));
});

test('backup: lesson edits are refused', async () => {
  const src = await createBackupSource(fakeStore());
  assert.equal(src.canEdit, false);
  await assert.rejects(src.addLesson({ date: '2026-01-05', durationMinutes: 60, student: 'A', notes: null, paidOn: null }), /read-only/);
  await assert.rejects(src.markPaid('2026-01', '2026-01-31'), /read-only/);
});

test('backup: CSV import saves to the store, second import skips all', async () => {
  const store = fakeStore(), src = await createBackupSource(store);
  assert.deepEqual(await src.importCsv(CSV), { added: 2, skipped: 0 });
  assert.equal(store.data.lessons.length, 2);
  assert.ok(store.data.syncedAt);
  assert.deepEqual(await src.importCsv(CSV), { added: 0, skipped: 2 });
});

test('backup: invalid CSV changes nothing', async () => {
  const store = fakeStore(), src = await createBackupSource(store);
  await src.importCsv(CSV);
  const saved = store.data;
  await assert.rejects(src.importCsv('nope'), e => e instanceof BackupFormatError);
  assert.equal(store.data, saved);
});

test('backup: loads a saved snapshot, rate is editable, clear empties it', async () => {
  const store = fakeStore({ lessons: [], rateCents: 2500, seasonStartMonth: 12, syncedAt: null });
  const src = await createBackupSource(store);
  assert.equal(last(src).rateCents, 2500);
  await src.setRate(3000);
  assert.equal(store.data.rateCents, 3000);
  await src.clear();
  assert.equal(store.data, null);
  assert.equal(last(src).lessons.length, 0);
});

test('a failing store keeps working in memory and flags the error', async () => {
  const store = { async load() { return null; }, async save() { throw new Error('quota'); }, async remove() {} };
  const src = await createBackupSource(store);
  await src.importCsv(CSV);
  assert.equal(last(src).lessons.length, 2);
  assert.equal(src.storageError, true);
});

test('a backup that failed to load is never overwritten', async () => {
  let saves = 0;
  const store = { async load() { throw new Error('blocked'); }, async save() { saves++; }, async remove() { saves++; } };
  const src = await createBackupSource(store);
  await src.importCsv(CSV);
  await src.setRate(3000);
  assert.equal(saves, 0);
  assert.equal(src.storageError, true);
  assert.equal(last(src).lessons.length, 2);
});

test('clear without a store gives an empty snapshot, not null', async () => {
  const { createSource, emptySnapshot } = await import('../source/core.js');
  const src = createSource({ status: 'backup', canEdit: false, initial: { ...emptySnapshot(), rateCents: 100 } });
  await src.clear();
  assert.deepEqual(last(src), emptySnapshot());
});
