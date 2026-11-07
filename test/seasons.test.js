import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf, seasonLabel, seasonMonths, inSeason } from '../domain/seasons.js';

test('season boundary is the 1st of the start month', () => {
  assert.deepEqual(seasonOf('2026-11-01', 11), { startYear: 2026, startMonth: 11 });
  assert.deepEqual(seasonOf('2026-10-31', 11), { startYear: 2025, startMonth: 11 });
});
test('labels', () => {
  assert.equal(seasonLabel({ startYear: 2025, startMonth: 11 }), '2025/26');
  assert.equal(seasonLabel({ startYear: 2026, startMonth: 1 }), '2026');
  assert.equal(seasonLabel({ startYear: 2099, startMonth: 11 }), '2099/00');
});
test('twelve months from the start', () => {
  const m = seasonMonths({ startYear: 2025, startMonth: 11 });
  assert.equal(m.length, 12);
  assert.equal(m[0], '2025-11');
  assert.equal(m[11], '2026-10');
});
test('inSeason', () => {
  const s = { startYear: 2025, startMonth: 11 };
  assert.ok(inSeason('2026-10-31', s));
  assert.ok(!inSeason('2026-11-01', s));
  assert.ok(!inSeason('2025-10-31', s));
});
