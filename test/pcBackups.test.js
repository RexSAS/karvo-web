import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBackup, needsSyncBackup, MAX_BACKUPS } from '../source/pcBackups.js';

const snap = n => ({ lessons: Array.from({ length: n }, (_, i) => ({ id: i + 1 })), rateCents: 3000, seasonStartMonth: 11 });
const at = s => new Date(s);

test('keeps the newest 3, newest first, with lesson counts', () => {
  let list = [];
  for (let i = 1; i <= 5; i++) list = addBackup(list, snap(i), 'manual', at(`2026-11-0${i}T10:00:00`));
  assert.equal(MAX_BACKUPS, 3);
  assert.deepEqual(list.map(b => b.lessonCount), [5, 4, 3]);
  assert.equal(list[0].reason, 'manual');
  assert.equal(list[0].snapshot.lessons.length, 5);
});

test('a backup before sync happens once a day, and never of an empty copy', () => {
  assert.equal(needsSyncBackup([], snap(3), at('2026-11-08T09:00:00')), true);
  const list = addBackup([], snap(3), 'sync', at('2026-11-08T09:00:00'));
  assert.equal(needsSyncBackup(list, snap(3), at('2026-11-08T18:00:00')), false);
  assert.equal(needsSyncBackup(list, snap(3), at('2026-11-09T07:00:00')), true);
  assert.equal(needsSyncBackup([], snap(0), at('2026-11-08T09:00:00')), false);
});
