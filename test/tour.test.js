import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startScreen, TOUR } from '../ui/m/tour.js';
import { STRINGS } from '../ui/m/i18n.js';

test('fresh app gets the welcome, an existing one What’s new', () => {
  assert.equal(startScreen(undefined, 'web-4', false), 'welcome');
  assert.equal(startScreen(undefined, 'web-4', true), 'whatsNew');
});
test('What’s new only once per version, never for a downgrade or junk', () => {
  assert.equal(startScreen('web-3', 'web-4', true), 'whatsNew');
  assert.equal(startScreen('web-4', 'web-4', true), 'none');
  assert.equal(startScreen('web-5', 'web-4', true), 'none');
  assert.equal(startScreen('x', 'web-4', true), 'none');
});
test('every tour step has its texts in both languages', () => {
  for (const s of TOUR) for (const k of [s.title, s.body]) assert.ok(STRINGS.en[k] && STRINGS.it[k], k);
});
