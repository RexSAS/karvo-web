import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkedSource, needsRestore } from '../source/linked.js';
import { todayIn } from '../domain/dates.js';
import { BackupFormatError } from '../domain/csv.js';

function fakeConnection() {
  const handlers = { state: [], message: [], peer: [] }, sent = [];
  return {
    sent, state: 'connected',
    on(ev, fn) { handlers[ev].push(fn); return () => {}; },
    async send(t, f) { if (this.state !== 'connected') throw new Error('Phone disconnected'); sent.push({ t, ...f }); },
    emit(ev, v) { if (ev === 'state') this.state = v; handlers[ev].forEach(fn => fn(v)); },
  };
}
const fakeStore = () => ({ saved: null, async save(s) { this.saved = s; } });
const L = { id: 7, date: '2026-01-05', durationMinutes: 60, student: 'Anna', notes: null, paidOn: null };
const snap = (lessons = [L]) => ({ t: 'snapshot', lessons, rateCents: 3000, seasonStartMonth: 11, timeZoneId: 'Europe/Rome' });
const last = src => { let s; src.subscribe(x => { s = x; })(); return s; };
const tick = () => new Promise(r => setTimeout(r, 0));

test('a phone snapshot reaches subscribers and is saved as the backup', async () => {
  const c = fakeConnection(), store = fakeStore(), src = createLinkedSource(c, store, { initial: null });
  c.emit('message', snap()); await tick();
  assert.equal(last(src).lessons[0].student, 'Anna');
  assert.equal(last(src).timeZoneId, 'Europe/Rome');
  assert.ok(last(src).syncedAt);
  assert.equal(store.saved.lessons.length, 1);
  assert.equal(src.status, 'linked');
  assert.equal(src.canEdit, true);
});

test('a command resolves on ok ack and rejects with the phone message otherwise', async () => {
  const c = fakeConnection(), src = createLinkedSource(c, fakeStore());
  const p = src.addLesson({ ...L, id: undefined });
  await tick();
  const cmd = c.sent.at(-1);
  assert.equal(cmd.t, 'command'); assert.equal(cmd.op, 'addLesson'); assert.equal(cmd.args.lesson.student, 'Anna');
  c.emit('message', { t: 'ack', id: cmd.id, ok: true });
  await p;
  const q = src.markPaid('2026-01', '2026-02-01'); await tick();
  assert.deepEqual(c.sent.at(-1).args, { month: '2026-01', paidOn: '2026-02-01' });
  c.emit('message', { t: 'ack', id: c.sent.at(-1).id, ok: false, error: 'Enter a student name' });
  await assert.rejects(q, /Enter a student name/);
});

test('an ack for an unknown id is ignored', async () => {
  const c = fakeConnection(), src = createLinkedSource(c, fakeStore());
  c.emit('message', { t: 'ack', id: 999, ok: true });
  const p = src.deleteLesson(7); await tick();
  c.emit('message', { t: 'ack', id: c.sent.at(-1).id, ok: true });
  await p;
});

test('a snapshot before the ack is shown and the command still resolves', async () => {
  const c = fakeConnection(), src = createLinkedSource(c, fakeStore());
  const p = src.updateLesson({ ...L, durationMinutes: 90 }); await tick();
  c.emit('message', snap([{ ...L, durationMinutes: 90 }])); await tick();
  assert.equal(last(src).lessons[0].durationMinutes, 90);
  c.emit('message', { t: 'ack', id: c.sent.at(-1).id, ok: true });
  await p;
});

test('losing the phone while waiting rejects with Phone disconnected', async () => {
  const c = fakeConnection(), src = createLinkedSource(c, fakeStore());
  const p = src.setRate(2500); await tick();
  c.emit('state', 'offline');
  await assert.rejects(p, /Phone disconnected/);
});

test('no ack in time rejects with Phone disconnected', async () => {
  const c = fakeConnection(), src = createLinkedSource(c, fakeStore(), { timeoutMs: 20 });
  await assert.rejects(src.setSeasonStart(12), /Phone disconnected/);
});

test('CSV import parses on the PC, sends the lessons, returns the phone result', async () => {
  const c = fakeConnection(), src = createLinkedSource(c, fakeStore());
  await assert.rejects(src.importCsv('nope'), e => e instanceof BackupFormatError);
  assert.equal(c.sent.length, 0);
  const p = src.importCsv('date,student,duration_minutes,duration_hours,notes,paid_on\r\n2026-01-05,Anna,60,1,,\r\n'); await tick();
  const cmd = c.sent.at(-1);
  assert.equal(cmd.op, 'importLessons'); assert.equal(cmd.args.lessons.length, 1);
  c.emit('message', { t: 'ack', id: cmd.id, ok: true, result: { added: 1, skipped: 0 } });
  assert.deepEqual(await p, { added: 1, skipped: 0 });
});

test('restore only when the phone is empty and the backup is not', () => {
  assert.equal(needsRestore({ lessons: [] }, { lessons: [L, L] }), 2);
  assert.equal(needsRestore({ lessons: [L] }, { lessons: [L, L] }), 0);
  assert.equal(needsRestore({ lessons: [] }, { lessons: [] }), 0);
  assert.equal(needsRestore({ lessons: [] }, null), 0);
});

test('today in the phone time zone', () => {
  const at = new Date('2026-11-07T23:30:00Z');
  assert.equal(todayIn('Pacific/Auckland', at), '2026-11-08');
  assert.equal(todayIn('Pacific/Honolulu', at), '2026-11-07');
  assert.equal(todayIn('Not/AZone', at).length, 10);
});
