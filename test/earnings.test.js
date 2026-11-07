import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earningsCents, formatEuro } from '../domain/earnings.js';

test('earnings round to the nearest cent like Android', () => {
  assert.equal(earningsCents(60, 3000), 3000);
  assert.equal(earningsCents(1, 3000), 50);
  assert.equal(earningsCents(1, 1), 0);
  assert.equal(earningsCents(1, 30), 1);
  assert.equal(earningsCents(90, 3333), 5000);
});

test('no rate means no earnings', () => assert.equal(earningsCents(100, null), null));

test('euro formatting', () => {
  assert.equal(formatEuro(127500), '€1,275');
  assert.equal(formatEuro(1250), '€12.50');
});
