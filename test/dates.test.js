import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHours, calendarDays, weekdayIndex, addMonths, monthOf, daysInMonth } from '../domain/dates.js';

test('hours formatting', () => {
  assert.equal(formatHours(120), '2 h');
  assert.equal(formatHours(90), '1.5 h');
  assert.equal(formatHours(80), '1 h 20');
  assert.equal(formatHours(0), '0 h');
});
test('calendar grid starts on Monday and has 42 days', () => {
  const days = calendarDays('2026-11');
  assert.equal(days[0], '2026-10-26');
  assert.equal(days.length, 42);
});
test('weekday index is Monday-based', () => assert.equal(weekdayIndex('2026-11-07'), 5));
test('month arithmetic crosses years', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2025-11', 14), '2027-01');
});
test('month of a date and month length', () => {
  assert.equal(monthOf('2026-02-14'), '2026-02');
  assert.equal(daysInMonth('2028-02'), 29);
});
