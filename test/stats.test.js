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
