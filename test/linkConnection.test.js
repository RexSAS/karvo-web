import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from '../link/connection.js';
import { deriveKeys, randomBytes, b64url } from '../link/crypto.js';
import { createChannel } from '../link/protocol.js';

// Web Crypto in Node completes on a worker thread, so give it a few real milliseconds.
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 2)); };

function fakeTimers() {
  let now = 0, next = 1; const jobs = new Map();
  const add = (fn, ms, every) => { const id = next++; jobs.set(id, { fn, at: now + ms, every }); return id; };
  return {
    setTimeout: (fn, ms) => add(fn, ms), setInterval: (fn, ms) => add(fn, ms, ms),
    clearTimeout: id => jobs.delete(id), clearInterval: id => jobs.delete(id),
    async tick(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...jobs.entries()].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, j] = due; now = j.at;
        if (j.every) j.at += j.every; else jobs.delete(id);
        j.fn(); await flush();
      }
      now = end;
    },
  };
}

class FakeWS {
  static all = [];
  constructor(url) { this.url = url; this.sent = []; this.readyState = 0; FakeWS.all.push(this); }
  send(d) { this.sent.push(new Uint8Array(d)); }
  close(code = 1000) { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({ code }); }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(bytes) { this.onmessage?.({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }); }
}

async function setup(extra = {}) {
  FakeWS.all = [];
  const roomId = randomBytes(16), secret = randomBytes(32), k = await deriveKeys(secret, roomId);
  const timers = fakeTimers(), states = [], messages = [], peers = [];
  const conn = createConnection({ record: { roomId: b64url(roomId), secret: b64url(secret), peerName: 'Pixel', ...extra }, relayUrl: 'wss://relay.test',
    WebSocketImpl: FakeWS, appVersion: 'web', myName: 'Chrome on Linux', timers });
  conn.on('state', s => states.push(s)); conn.on('message', m => messages.push(m)); conn.on('peer', p => peers.push(p));
  const phone = () => createChannel({ sendKey: k.phoneToPc, recvKey: k.pcToPhone, roomId, sendDir: 2, recvDir: 1 });
  return { conn, timers, states, messages, peers, k, roomId, phone, ws: () => FakeWS.all.at(-1) };
}
async function openAndGreet(t, ch = t.phone()) {
  await t.conn.start(); await flush();
  t.ws().open(); await flush();
  await ch.decode(t.ws().sent[0]); // the phone reads the PC hello
  t.ws().receive(await ch.hello({ app: '3.1', name: 'Pixel 8' })); await flush();
  return ch;
}

test('connects with the right URL and becomes connected on the phone hello', async () => {
  const t = await setup();
  const ch = await openAndGreet(t);
  assert.match(t.ws().url, new RegExp(`^wss://relay\\.test/room/${b64url(t.roomId)}\\?role=pc&auth=${b64url(t.k.authPc)}$`));
  assert.equal(t.states.at(-1), 'connected');
  assert.deepEqual(t.peers[0], { name: 'Pixel 8', app: '3.1' });
  const sentHellos = await Promise.all(t.ws().sent.map(f => ch.decode(f).catch(() => null)));
  assert.ok(sentHellos.some(m => m?.t === 'hello' && m.name === 'Chrome on Linux'));
});

test('a fresh pairing registers the room hashes', async () => {
  const t = await setup({ unregistered: true });
  await t.conn.start(); await flush();
  assert.match(t.ws().url, /&register=[0-9a-f]{64}\.[0-9a-f]{64}$/);
});

test('messages after hello reach listeners; send works once connected', async () => {
  const t = await setup();
  const ch = await openAndGreet(t);
  t.ws().receive(await ch.encode('snapshot', { lessons: [] })); await flush(); await flush();
  assert.equal(t.messages.at(-1).t, 'snapshot');
  await t.conn.send('command', { id: 1 });
  assert.equal((await ch.decode(t.ws().sent.at(-1))).id, 1);
});

test('send before the phone is there rejects with Phone disconnected', async () => {
  const t = await setup();
  await t.conn.start(); await flush(); t.ws().open(); await flush();
  await assert.rejects(t.conn.send('command', {}), /Phone disconnected/);
});

test('reconnects with backoff 2s, 4s, ... capped at 60s and resets after success', async () => {
  const t = await setup();
  await t.conn.start(); await flush();
  const gaps = [];
  for (let i = 0; i < 7; i++) {
    const n = FakeWS.all.length; t.ws().close(1006); await flush();
    let waited = 0; while (FakeWS.all.length === n) { await t.timers.tick(1000); waited += 1000; }
    gaps.push(waited);
  }
  assert.deepEqual(gaps, [2000, 4000, 8000, 16000, 32000, 60000, 60000]);
  t.ws().open(); await flush();
  t.ws().receive(await t.phone().hello({ app: '3.1', name: 'P' })); await flush(); await flush();
  const n = FakeWS.all.length; t.ws().close(1006); await flush();
  await t.timers.tick(2000);
  assert.equal(FakeWS.all.length, n + 1);
  assert.equal(t.states.includes('offline'), true);
});

test('replaced by another tab: state replaced and no reconnect', async () => {
  const t = await setup();
  await openAndGreet(t);
  const n = FakeWS.all.length;
  t.ws().close(4000); await flush();
  await t.timers.tick(120000);
  assert.equal(t.states.at(-1), 'replaced');
  assert.equal(FakeWS.all.length, n);
});

test('two missed pings close the socket and go offline', async () => {
  const t = await setup();
  await openAndGreet(t);
  const n = FakeWS.all.length;
  await t.timers.tick(95000);
  assert.ok(t.states.includes('offline'));
  assert.ok(FakeWS.all.length > n);
});

test('three bad frames in a row: broken, stop', async () => {
  const t = await setup();
  await t.conn.start(); await flush();
  for (let i = 0; i < 3; i++) {
    t.ws().open(); await flush();
    t.ws().receive(randomBytes(40)); await flush(); await flush();
    await t.timers.tick(60000);
  }
  assert.equal(t.states.at(-1), 'broken');
  const n = FakeWS.all.length; await t.timers.tick(120000);
  assert.equal(FakeWS.all.length, n);
});

test('another protocol version: outdated, stop', async () => {
  const t = await setup();
  await t.conn.start(); await flush(); t.ws().open(); await flush();
  const { seal } = await import('../link/crypto.js');
  t.ws().receive(await seal(t.k.phoneToPc, t.roomId, 2, new TextEncoder().encode('{"t":"hello","v":2,"session":"x","app":"9"}'))); await flush(); await flush();
  assert.equal(t.states.at(-1), 'outdated');
  assert.equal(t.conn.phoneNewer, true);
});

test('stop sends bye and does not reconnect', async () => {
  const t = await setup();
  const ch = await openAndGreet(t);
  const ws = t.ws();
  t.conn.stop(); await flush();
  assert.equal((await ch.decode(ws.sent.at(-1))).t, 'bye');
  const n = FakeWS.all.length; await t.timers.tick(120000);
  assert.equal(FakeWS.all.length, n);
});
