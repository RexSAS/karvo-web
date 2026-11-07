import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRateCents, formatRateText } from '../domain/rate.js';

test('valid rates, comma or dot, optional euro sign', () => {
  assert.deepEqual(parseRateCents('30'), { cents: 3000 });
  assert.deepEqual(parseRateCents('27,50'), { cents: 2750 });
  assert.deepEqual(parseRateCents(' 30 € '), { cents: 3000 });
  assert.deepEqual(parseRateCents('30.-'), { cents: 3000 });
});
test('blank clears the rate', () => assert.deepEqual(parseRateCents('  '), { cents: null }));
test('invalid input', () => {
  for (const s of ['0', 'abc', '1.234', '123456', '€', ',-', '-5']) assert.deepEqual(parseRateCents(s), { invalid: true }, s);
});
test('rate text for the input box', () => {
  assert.equal(formatRateText(3000), '30.00');
  assert.equal(formatRateText(null), '');
});
