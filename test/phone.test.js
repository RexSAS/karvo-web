import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneKind } from '../ui/phone.js';

test('detects iPhones and Android phones, not tablets or PCs', () => {
  assert.equal(phoneKind('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), 'ios');
  assert.equal(phoneKind('Mozilla/5.0 (Linux; Android 16; A069P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'), 'android');
  assert.equal(phoneKind('Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'), null); // Android tablet
  assert.equal(phoneKind('Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), null);
  assert.equal(phoneKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'), null);
});

import { phoneRoute } from '../ui/phone.js';
test('iPhone from the Home Screen gets the app, in Safari the install steps', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  assert.equal(phoneRoute(iphone, true), 'iphone');
  assert.equal(phoneRoute(iphone, false), 'install');
  assert.equal(phoneRoute('Mozilla/5.0 (Linux; Android 16; A069P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36', false), 'android');
  assert.equal(phoneRoute('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false), null);
});
