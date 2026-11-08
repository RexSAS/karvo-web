import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderState, snooze, recordBackup, recordSync } from '../ui/m/backup.js';

const DAY = 864e5, t0 = Date.parse('2026-11-01T10:00:00Z'), at = d => new Date(t0 + d * DAY);
const meta = { startedAt: new Date(t0).toISOString() };

test('none, banner after 2 days, blocking after 5', () => {
  assert.equal(reminderState(meta, at(1), true).level, 'none');
  assert.deepEqual(reminderState(meta, at(3), true), { level: 'banner', days: 3, canSnooze: false });
  assert.deepEqual(reminderState(meta, at(6), true), { level: 'blocking', days: 6, canSnooze: true });
});

test('no lessons, no reminder', () => assert.equal(reminderState(meta, at(30), false).level, 'none'));

test('a backup or a PC sync resets the clock', () => {
  assert.equal(reminderState(recordBackup(meta, at(5)), at(6), true).level, 'none');
  assert.equal(reminderState(recordSync(meta, at(5)), at(8), true).level, 'banner');
});

test('Remind me tomorrow works once in a row', () => {
  const s = snooze(meta, at(6));
  assert.equal(reminderState(s, at(6.5), true).level, 'banner');
  const again = reminderState(s, at(7.2), true);
  assert.equal(again.level, 'blocking');
  assert.equal(again.canSnooze, false);
  assert.equal(reminderState(recordBackup(s, at(7.3)), at(13), true).canSnooze, true);
});

test('a clock moved back never gives negative days (a backup stamped in the future is ignored)', () => {
  const m = recordBackup(meta, at(10));
  const r = reminderState(m, at(4), true);
  assert.ok(r.days >= 0);
  assert.equal(r.days, 4); // counted from install, the last time that is certainly in the past
});

test('a timestamp from a clock that was ahead does not silence reminders', () => {
  const m = recordBackup(meta, at(30)); // saved while the clock said +30 days
  assert.equal(reminderState(m, at(20), true).level, 'blocking'); // clock fixed, real last backup unknown → counts from install
});
