import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPairing, parseQr, pcName } from '../link/pairing.js';
import { b64url, randomBytes } from '../link/crypto.js';

test('QR text round-trips the keys and a name with spaces and accents', () => {
  const p = newPairing('Chrome su Windows · è');
  assert.match(p.qrText, /^karvo:link\?v=1&r=[\w-]+&k=[\w-]+&n=/);
  const q = parseQr(p.qrText);
  assert.deepEqual(q.roomId, p.roomId);
  assert.deepEqual(q.secret, p.secret);
  assert.equal(q.name, 'Chrome su Windows · è');
  assert.equal(p.roomId.length, 16);
  assert.equal(p.secret.length, 32);
});

test('other versions, schemes and key lengths are refused', () => {
  const k = b64url(randomBytes(32)), r = b64url(randomBytes(16));
  assert.throws(() => parseQr(`karvo:link?v=2&r=${r}&k=${k}&n=x`));
  assert.throws(() => parseQr(`https://example.com/?v=1&r=${r}&k=${k}&n=x`));
  assert.throws(() => parseQr(`karvo:link?v=1&r=${b64url(randomBytes(15))}&k=${k}&n=x`));
  assert.throws(() => parseQr(`karvo:link?v=1&r=${r}&k=${b64url(randomBytes(31))}&n=x`));
});

test('PC name from the user agent', () => {
  assert.equal(pcName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'), 'Chrome on Windows');
  assert.equal(pcName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'), 'Edge on Windows');
  assert.equal(pcName('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'), 'Firefox on Linux');
  assert.equal(pcName('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'), 'Safari on macOS');
  assert.equal(pcName(''), 'Browser');
});
