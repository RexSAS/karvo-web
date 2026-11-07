import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planImport } from '../domain/importPlan.js';

const A = { date: '2026-01-05', durationMinutes: 60, student: 'Anna', notes: null, paidOn: null };
const A2 = { ...A, student: ' anna ', notes: 'different', paidOn: '2026-02-01' };

test('duplicates ignore case, spaces, notes and paid date, counted per copy', () => {
  const p = planImport([A], [A2, A2]);
  assert.equal(p.toAdd.length, 1);
  assert.equal(p.skipped, 1);
});

test('two identical lessons on a day are both real, and re-import adds nothing', () => {
  const first = planImport([], [A, A]);
  assert.equal(first.toAdd.length, 2);
  const again = planImport(first.toAdd, [A, A]);
  assert.equal(again.toAdd.length, 0);
  assert.equal(again.skipped, 2);
});
