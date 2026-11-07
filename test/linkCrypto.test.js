import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveKeys, seal, open, sha256Hex, b64url, fromB64url } from '../link/crypto.js';

const V = JSON.parse(readFileSync(new URL('./vectors/link-v1.json', import.meta.url)));
const hex = s => Uint8Array.from(s.match(/../g), h => parseInt(h, 16));
const toHex = b => Buffer.from(b).toString('hex');
const secret = hex(V.secret), roomId = hex(V.roomId), nonce = hex(V.nonce), pt = new TextEncoder().encode(V.plaintext);

test('auth tokens and their hashes match the vectors', async () => {
  const k = await deriveKeys(secret, roomId);
  assert.equal(toHex(k.authPc), V.authPc);
  assert.equal(toHex(k.authPhone), V.authPhone);
  assert.equal(await sha256Hex(k.authPc), V.authPcSha256);
  assert.equal(await sha256Hex(k.authPhone), V.authPhoneSha256);
});

test('frames match the vectors in both directions', async () => {
  const k = await deriveKeys(secret, roomId);
  assert.equal(toHex(await seal(k.pcToPhone, roomId, 1, pt, nonce)), V.framePcToPhone);
  assert.equal(toHex(await seal(k.phoneToPc, roomId, 2, pt, nonce)), V.framePhoneToPc);
});

test('open reverses seal and rejects anything altered', async () => {
  const k = await deriveKeys(secret, roomId), frame = await seal(k.pcToPhone, roomId, 1, pt);
  assert.deepEqual(await open(k.pcToPhone, roomId, 1, frame), pt);
  const bad = frame.slice(); bad[20] ^= 1;
  await assert.rejects(open(k.pcToPhone, roomId, 1, bad));
  await assert.rejects(open(k.pcToPhone, roomId, 2, frame));
  await assert.rejects(open(k.pcToPhone, new Uint8Array(16), 1, frame));
  await assert.rejects(open(k.phoneToPc, roomId, 1, frame));
});

test('base64url round trip without padding', () => {
  const b = Uint8Array.from([251, 255, 0, 1]);
  assert.equal(b64url(b), '-_8AAQ');
  assert.deepEqual(fromB64url('-_8AAQ'), b);
});
