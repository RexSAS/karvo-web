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
