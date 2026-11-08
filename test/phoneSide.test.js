import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createPhoneLink, Refused } from '../link/phoneSide.js';
import { createSource, emptySnapshot } from '../source/core.js';

const text = k => k;
const anna = { id: 1, date: '2026-01-05', durationMinutes: 60, student: 'Anna', notes: null, paidOn: null };
const data = (lessons = [anna]) => ({ ...emptySnapshot(), lessons, rateCents: 3000, timeZoneId: 'Europe/Rome' });
const lesson = (o = {}) => ({ id: 0, date: '2026-01-06', durationMinutes: 90, student: 'Bo', notes: null, paidOn: null, ...o });
const refused = (d, op, args) => { try { applyCommand(d, op, args, text); } catch (e) { assert.ok(e instanceof Refused); return e.message; } assert.fail('not refused'); };

test('add, update, delete', () => {
  let d = applyCommand(data(), 'addLesson', { lesson: lesson() }, text).data;
  const bo = d.lessons.find(l => l.student === 'Bo');
  assert.equal(bo.id, 2);
  d = applyCommand(d, 'updateLesson', { lesson: { ...bo, durationMinutes: 120 } }, text).data;
  assert.equal(d.lessons.find(l => l.id === 2).durationMinutes, 120);
  d = applyCommand(d, 'deleteLesson', { id: 2 }, text).data;
  assert.equal(d.lessons.length, 1);
});

test('invalid lessons are refused with the Android messages in Android order', () => {
  assert.equal(refused(data(), 'addLesson', { lesson: lesson({ durationMinutes: 0, student: ' ' }) }), 'DurationZero · StudentBlank');
  assert.equal(refused(data(), 'addLesson', { lesson: lesson({ durationMinutes: 1441 }) }), 'DurationTooLong');
  assert.equal(refused(data(), 'addLesson', { lesson: lesson({ durationMinutes: 5.5 }) }), 'invalidData');
  assert.equal(refused(data(), 'addLesson', { lesson: lesson({ date: '2026-13-01' }) }), 'invalidData');
  assert.equal(refused(data(), 'addLesson', {}), 'invalidData');
});

test('missing lessons, months, rate, season start', () => {
  assert.equal(refused(data(), 'updateLesson', { lesson: lesson({ id: 99 }) }), 'lessonGone');
  assert.equal(refused(data(), 'deleteLesson', { id: 99 }), 'lessonGone');
  let d = applyCommand(data(), 'markPaid', { month: '2026-01', paidOn: '2026-02-01' }, text).data;
  assert.equal(d.lessons[0].paidOn, '2026-02-01');
  d = applyCommand(d, 'markUnpaid', { month: '2026-01' }, text).data;
  assert.equal(d.lessons[0].paidOn, null);
  assert.equal(applyCommand(d, 'setRate', { rateCents: null }, text).data.rateCents, null);
  assert.equal(refused(d, 'setRate', { rateCents: 0 }), 'invalidRate');
  assert.equal(applyCommand(d, 'setSeasonStart', { month: 12 }, text).data.seasonStartMonth, 12);
  assert.equal(refused(d, 'setSeasonStart', { month: 13 }), 'invalidMonth');
  assert.equal(refused(d, 'format', {}), 'unknownCommand');
});

test('import counts duplicates like Android, restore only into an empty phone', () => {
  const args = { lessons: [lesson({ date: '2026-01-05', durationMinutes: 60, student: ' anna' }), lesson()] };
  const r1 = applyCommand(data(), 'importLessons', args, text);
  assert.deepEqual(r1.result, { added: 1, skipped: 1 });
  assert.deepEqual(applyCommand(r1.data, 'importLessons', args, text).result, { added: 0, skipped: 2 });
  assert.equal(refused(data(), 'restoreAll', { lessons: [lesson()] }), 'phoneNotEmpty');
  assert.equal(applyCommand(data([]), 'restoreAll', { lessons: [lesson()] }, text).data.lessons.length, 1);
});

function fakeConnection() {
  const h = { state: [], message: [], peer: [] }, sent = [];
  return { sent, state: 'offline', started: 0, stopped: 0,
    on(ev, fn) { h[ev].push(fn); return () => {}; },
    async start() { this.started++; }, async stop() { this.stopped++; },
    async send(t, f) { if (this.state !== 'connected') throw new Error('Phone disconnected'); sent.push({ t, ...f }); },
    emit(ev, v) { if (ev === 'state') this.state = v; h[ev].forEach(fn => fn(v)); } };
}
const tick = () => new Promise(r => setTimeout(r, 5));
const fakeStore = (fail = false) => ({ async load() { return null; }, async save() { if (fail) throw new Error('quota'); }, async remove() {} });

test('a command whose save fails is refused and changes nothing', async () => {
  const source = createSource({ status: 'phone', canEdit: true, initial: data(), store: fakeStore(true), strict: true });
  const c = fakeConnection();
  createPhoneLink({ pairing: { roomId: 'r', secret: 's', pcName: 'PC' }, source, text, connect: () => c });
  c.emit('state', 'connected'); c.emit('peer', { name: 'PC' }); await tick();
  c.emit('message', { t: 'command', id: 1, op: 'addLesson', args: { lesson: lesson() } }); await tick();
  const ack = c.sent.find(m => m.t === 'ack');
  assert.equal(ack.ok, false);
  let now; source.subscribe(s => { now = s; })();
  assert.equal(now.lessons.length, 1);
});

test('commands apply in order, acks in order, and every linked PC gets the snapshot', async () => {
  const source = createSource({ status: 'phone', canEdit: true, initial: data(), store: fakeStore(), strict: true });
  const a = fakeConnection(), b = fakeConnection();
  let syncs = 0;
  createPhoneLink({ pairing: { roomId: 'a', secret: 's', pcName: 'A' }, source, text, connect: () => a, onPcSync: () => syncs++ });
  createPhoneLink({ pairing: { roomId: 'b', secret: 's', pcName: 'B' }, source, text, connect: () => b });
  for (const c of [a, b]) { c.emit('state', 'connected'); c.emit('peer', { name: 'X' }); }
  await tick();
  assert.equal(syncs, 1);
  a.emit('message', { t: 'command', id: 1, op: 'addLesson', args: { lesson: lesson() } });
  a.emit('message', { t: 'command', id: 2, op: 'markPaid', args: { month: '2026-01', paidOn: '2026-02-01' } });
  await tick(); await tick();
  assert.deepEqual(a.sent.filter(m => m.t === 'ack').map(m => [m.id, m.ok]), [[1, true], [2, true]]);
  const last = b.sent.filter(m => m.t === 'snapshot').at(-1);
  assert.equal(last.lessons.length, 2);
  assert.ok(last.lessons.every(l => l.paidOn === '2026-02-01'));
  assert.equal(last.timeZoneId, 'Europe/Rome');
});

test('unpaired from the PC reports the pairing gone', async () => {
  const source = createSource({ status: 'phone', canEdit: true, initial: data(), store: fakeStore(), strict: true });
  const c = fakeConnection(); let gone = 0;
  const link = createPhoneLink({ pairing: { roomId: 'r', secret: 's', pcName: 'PC' }, source, text, connect: () => c });
  link.on('gone', () => gone++);
  c.emit('state', 'connected'); c.emit('message', { t: 'unpaired' }); c.emit('state', 'unlinked'); await tick();
  assert.equal(gone, 1);
});

test('the first snapshot goes out even though the connection announces the PC before it reports connected', async () => {
  const source = createSource({ status: 'phone', canEdit: true, initial: data(), store: fakeStore(), strict: true });
  const c = fakeConnection(); let syncs = 0;
  createPhoneLink({ pairing: { roomId: 'r', secret: 's', pcName: 'PC' }, source, text, connect: () => c, onPcSync: () => syncs++ });
  c.emit('peer', { name: 'PC' });       // link/connection.js emits 'peer' first…
  c.emit('state', 'connected'); await tick(); // …then 'connected'
  assert.equal(c.sent.filter(m => m.t === 'snapshot').length, 1);
  assert.equal(syncs, 1);
});
