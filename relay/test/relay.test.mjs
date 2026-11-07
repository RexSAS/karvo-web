// Runs against `wrangler dev` (started here) or against RELAY=wss://link.rxsas.it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { deriveKeys, randomBytes, b64url, sha256Hex } from '../../link/crypto.js';

let base = process.env.RELAY, dev;
const http = () => base.replace(/^ws/, 'http');

before(async () => {
  if (base) return;
  dev = spawn('npx', ['wrangler', 'dev', '--local', '--port', '8799'], { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('wrangler dev did not start')), 60000);
    const watch = d => { if (/Ready on/.test(d)) { clearTimeout(t); ok(); } };
    dev.stdout.on('data', watch); dev.stderr.on('data', watch);
  });
  base = 'ws://localhost:8799';
});
after(() => { if (dev) process.kill(-dev.pid); }); // whole group: npx leaves wrangler/workerd children behind

async function room() {
  const roomId = b64url(randomBytes(16)), k = await deriveKeys(randomBytes(32), randomBytes(16));
  return { roomId, pc: b64url(k.authPc), phone: b64url(k.authPhone), register: `${await sha256Hex(k.authPc)}.${await sha256Hex(k.authPhone)}` };
}
const url = (r, role, auth, extra = '') => `${base}/room/${r.roomId}?role=${role}&auth=${auth}${extra}`;
function connect(u) {
  const ws = new WebSocket(u); ws.binaryType = 'arraybuffer';
  ws.inbox = []; ws.closed = new Promise(ok => ws.addEventListener('close', e => ok(e.code)));
  ws.addEventListener('message', e => ws.inbox.push(new Uint8Array(e.data)));
  return new Promise((ok, fail) => { ws.addEventListener('open', () => ok(ws)); ws.addEventListener('error', fail); });
}
const until = async (fn, ms = 3000) => { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw new Error('timeout'); await new Promise(r => setTimeout(r, 20)); } };

test('frames are relayed byte-identical in both directions', async () => {
  const r = await room();
  const pc = await connect(url(r, 'pc', r.pc, `&register=${r.register}`)), phone = await connect(url(r, 'phone', r.phone));
  const a = randomBytes(300), b = randomBytes(50);
  pc.send(a); await until(() => phone.inbox.length === 1); assert.deepEqual(phone.inbox[0], a);
  phone.send(b); await until(() => pc.inbox.length === 1); assert.deepEqual(pc.inbox[0], b);
  pc.close(); phone.close();
});

test('wrong token is 401, unknown room is 404', async () => {
  const r = await room();
  (await connect(url(r, 'pc', r.pc, `&register=${r.register}`))).close();
  assert.equal((await fetch(url(r, 'phone', r.pc).replace(/^ws/, 'http'))).status, 401);
  const other = await room();
  assert.equal((await fetch(url(other, 'phone', other.phone).replace(/^ws/, 'http'))).status, 404);
  assert.equal((await fetch(url(other, 'phone', other.phone, `&register=${other.register}`).replace(/^ws/, 'http'))).status, 404);
});

test('a second socket for a role replaces the first with 4000', async () => {
  const r = await room();
  const first = await connect(url(r, 'pc', r.pc, `&register=${r.register}`));
  const second = await connect(url(r, 'pc', r.pc));
  assert.equal(await first.closed, 4000);
  second.close();
});

test('an oversize frame closes the socket with 4001', async () => {
  const r = await room();
  const pc = await connect(url(r, 'pc', r.pc, `&register=${r.register}`));
  pc.send(new Uint8Array(1024 * 1024 + 1));
  assert.equal(await pc.closed, 4001);
});

test('more than 20 frames in a second closes the socket with 4001', async () => {
  const r = await room();
  const pc = await connect(url(r, 'pc', r.pc, `&register=${r.register}`));
  for (let i = 0; i < 30; i++) pc.send(new Uint8Array([i]));
  assert.equal(await pc.closed, 4001);
});

test('DELETE removes the room', async () => {
  const r = await room();
  (await connect(url(r, 'pc', r.pc, `&register=${r.register}`))).close();
  assert.equal((await fetch(`${http()}/room/${r.roomId}?role=pc&auth=${r.pc}`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(url(r, 'phone', r.phone).replace(/^ws/, 'http'))).status, 404);
});
