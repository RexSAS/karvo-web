import { test } from 'node:test';
import assert from 'node:assert/strict';
import { students, seasonStats, studentKey } from '../domain/stats.js';

const L = (id, date, student, durationMinutes = 60) => ({ id, date, durationMinutes, student, notes: null, paidOn: null });
const season = { startYear: 2025, startMonth: 11 };

test('same student with different case and spaces is one, latest spelling wins', () => {
  const s = students([L(1, '2026-01-01', 'marco '), L(2, '2026-02-01', 'Marco')]);
  assert.equal(s.length, 1);
  assert.equal(s[0].name, 'Marco');
  assert.equal(s[0].minutes, 120);
  assert.equal(studentKey(' Marco '), 'marco');
});

test('students sorted by minutes then name', () =>
  assert.deepEqual(students([L(1, '2026-01-01', 'Bea'), L(2, '2026-01-01', 'Al'), L(3, '2026-01-02', 'Cy', 120)]).map(s => s.name), ['Cy', 'Al', 'Bea']));

test('season stats: top 4, other, weekdays, months', () => {
  const ls = ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => L(i + 1, '2026-01-03', n, 60 * (6 - i)));
  ls.push(L(99, '2026-11-01', 'A', 600)); // next season: ignored
  const s = seasonStats(ls, season);
  assert.equal(s.top.length, 4);
  assert.equal(s.otherMinutes, 120 + 60);
  assert.equal(s.weekdayMinutes[5], 21 * 60); // 2026-01-03 is a Saturday
  assert.equal(s.perMonth.length, 12);
  assert.equal(s.perMonth.find(m => m.month === '2026-01').minutes, 21 * 60);
  assert.equal(s.minutes, 21 * 60);
  assert.equal(s.lessonCount, 6);
});

import { lifetimeStats } from '../domain/stats.js';
test('lifetime: totals over everything, hours per season oldest first, top students and weekdays', () => {
  const ls = [L(1, '2024-12-07', 'A', 60), L(2, '2025-01-04', 'B', 120), L(3, '2025-12-06', 'A', 180), L(4, '2026-11-07', 'C', 30)];
  const s = lifetimeStats(ls, 11);
  assert.equal(s.minutes, 390);
  assert.equal(s.lessonCount, 4);
  assert.deepEqual(s.perSeason.map(p => [p.label, p.minutes]), [['2024/25', 180], ['2025/26', 180], ['2026/27', 30]]);
  assert.equal(s.top[0].name, 'A');
  assert.equal(s.weekdayMinutes[5], 390); // all Saturdays
  assert.deepEqual(lifetimeStats([], 11).perSeason, []);
});
