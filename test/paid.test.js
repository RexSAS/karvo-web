import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paidStatus, monthPaidOn, markPaid, markUnpaid, unpaidTotals } from '../domain/paid.js';

const L = (id, date, paidOn = null, durationMinutes = 60) => ({ id, date, durationMinutes, student: 'A', notes: null, paidOn });

test('paid status', () => {
  assert.equal(paidStatus([]), 'UNPAID');
  assert.equal(paidStatus([L(1, '2026-01-01', '2026-01-10'), L(2, '2026-01-02')]), 'PARTLY_PAID');
  assert.equal(paidStatus([L(1, '2026-01-01', '2026-01-10')]), 'PAID');
});

test('month paid date is the latest one', () =>
  assert.equal(monthPaidOn([L(1, '2026-01-01', '2026-01-10'), L(2, '2026-01-02', '2026-02-01')]), '2026-02-01'));

test('markPaid only fills unpaid lessons of that month and does not mutate', () => {
  const input = [L(1, '2026-01-01', '2026-01-10'), L(2, '2026-01-02'), L(3, '2026-02-01')];
  const out = markPaid(input, '2026-01', '2026-02-01');
  assert.deepEqual(out.map(l => l.paidOn), ['2026-01-10', '2026-02-01', null]);
  assert.equal(input[1].paidOn, null);
});

test('markUnpaid clears the whole month', () =>
  assert.deepEqual(markUnpaid([L(1, '2026-01-01', '2026-01-10'), L(2, '2026-02-01', '2026-03-01')], '2026-01').map(l => l.paidOn), [null, '2026-03-01']));

test('future lessons are not owed yet', () => {
  const u = unpaidTotals([L(1, '2026-11-20')], '2026-11-07', 3000);
  assert.equal(u.minutes, 0);
  assert.equal(u.months, 0);
});

test('unpaid totals by month, oldest first', () => {
  const u = unpaidTotals([L(1, '2026-02-01'), L(2, '2026-01-05', null, 90), L(3, '2026-01-06', '2026-02-01')], '2026-11-07', 3000);
  assert.equal(u.months, 2);
  assert.equal(u.minutes, 150);
  assert.equal(u.earningsCents, 7500);
  assert.deepEqual(u.byMonth.map(m => m.month), ['2026-01', '2026-02']);
  assert.equal(u.byMonth[0].earningsCents, 4500);
});

test('unpaid totals without rate', () => assert.equal(unpaidTotals([L(1, '2026-01-01')], '2026-11-07', null).earningsCents, null));
