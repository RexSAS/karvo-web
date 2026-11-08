import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, t, setLang } from '../ui/m/i18n.js';

test('every string exists in English and Italian', () => {
  assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
  for (const [k, v] of Object.entries(STRINGS.it)) assert.ok(v.trim(), k);
});
test('placeholders are filled', () => {
  setLang('it');
  assert.equal(t('lastBackup', 3), 'Ultimo backup 3 giorni fa');
  setLang('en');
  assert.equal(t('lastBackup', 3), 'Last backup 3 days ago');
});
