import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveKeys, randomBytes, seal } from '../link/crypto.js';
import { createChannel, ProtocolError } from '../link/protocol.js';

async function pair() {
  const roomId = randomBytes(16), k = await deriveKeys(randomBytes(32), roomId);
  const pc = createChannel({ sendKey: k.pcToPhone, recvKey: k.phoneToPc, roomId, sendDir: 1, recvDir: 2 });
  const phone = createChannel({ sendKey: k.phoneToPc, recvKey: k.pcToPhone, roomId, sendDir: 2, recvDir: 1 });
  return { pc, phone, k, roomId };
}
async function shake({ pc, phone }) {
  const h1 = await phone.decode(await pc.hello({ app: 'web', name: 'PC' }));
  const h2 = await pc.decode(await phone.hello({ app: '3.1', name: 'Pixel' }));
  return [h1, h2];
}

test('hello exchange then messages decode in order', async () => {
  const c = await pair();
  const [h1, h2] = await shake(c);
  assert.equal(h1.t, 'hello'); assert.equal(h1.name, 'PC'); assert.equal(h2.app, '3.1');
  for (const n of [1, 2, 3]) {
    const m = await c.phone.decode(await c.pc.encode('command', { id: n }));
    assert.equal(m.t, 'command'); assert.equal(m.q, n); assert.equal(m.id, n);
  }
});

test('a replayed message is rejected', async () => {
  const c = await pair(); await shake(c);
  await c.phone.decode(await c.pc.encode('ping'));
  const second = await c.pc.encode('ping');
  await c.phone.decode(second);
  await assert.rejects(c.phone.decode(second), ProtocolError);
});

test('a message from an older session is rejected', async () => {
  const c = await pair(); await shake(c);
  const old = await c.pc.encode('ping');
  const phone2 = createChannel({ sendKey: c.k.phoneToPc, recvKey: c.k.pcToPhone, roomId: c.roomId, sendDir: 2, recvDir: 1 });
  await phone2.decode(await c.pc.hello({}));
  await assert.rejects(phone2.decode(old), ProtocolError);
});

test('tampered frames and messages before hello are rejected', async () => {
  const c = await pair();
  const hello = await c.pc.hello({});
  const bad = hello.slice(); bad[15] ^= 1;
  await assert.rejects(c.phone.decode(bad), ProtocolError);
  const notHello = await seal(c.k.pcToPhone, c.roomId, 1, new TextEncoder().encode('{"s":null,"q":1,"t":"ping"}'));
  await assert.rejects(c.phone.decode(notHello), ProtocolError);
});

test('another protocol version is reported as a version error', async () => {
  const c = await pair();
  const frame = await seal(c.k.pcToPhone, c.roomId, 1, new TextEncoder().encode('{"s":null,"q":0,"t":"hello","v":2,"app":"web-9","session":"x"}'));
  await assert.rejects(c.phone.decode(frame), e => e instanceof ProtocolError && e.code === 'version' && e.peerVersion === 2);
});

test('encode before the peer hello throws', async () => {
  const c = await pair();
  await assert.rejects(c.pc.encode('ping'));
});

test('a repeated hello of the current session is ignored and does not reset the sequence', async () => {
  const c = await pair();
  const hello = await c.pc.hello({});
  assert.equal((await c.phone.decode(hello)).isNew, true);
  await c.pc.decode(await c.phone.hello({}));
  const m = await c.pc.encode('ping');
  await c.phone.decode(m);
  assert.equal((await c.phone.decode(hello)).isNew, false);
  await assert.rejects(c.phone.decode(m), ProtocolError);
});

test('a reconnected peer (new session) is accepted, and its old frames are not', async () => {
  const c = await pair(); await shake(c);
  const old = await c.pc.encode('ping');
  const pc2 = createChannel({ sendKey: c.k.pcToPhone, recvKey: c.k.phoneToPc, roomId: c.roomId, sendDir: 1, recvDir: 2 });
  assert.equal((await c.phone.decode(await pc2.hello({}))).isNew, true);
  await pc2.decode(await c.phone.hello({}));
  await assert.rejects(c.phone.decode(old), ProtocolError);
  assert.equal((await c.phone.decode(await pc2.encode('ping'))).t, 'ping');
});

test('an old hello cannot be used to replay newer frames', async () => {
  const c = await pair();
  const oldPc = createChannel({ sendKey: c.k.pcToPhone, recvKey: c.k.phoneToPc, roomId: c.roomId, sendDir: 1, recvDir: 2 });
  const oldHello = await oldPc.hello({});
  await shake(c);
  const m = await c.pc.encode('command', { id: 1 });
  await c.phone.decode(m);
  await c.phone.decode(oldHello);
  await assert.rejects(c.phone.decode(m), ProtocolError);
});
