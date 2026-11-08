import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setNote, upcomingNotes, MAX_NOTE } from '../domain/notes.js';
import { applyCommand, Refused } from '../link/phoneSide.js';
import { createSource, emptySnapshot } from '../source/core.js';
import { createLinkedSource } from '../source/linked.js';

test('set, trim, replace and delete a day note', () => {
  let n = setNote({}, '2026-11-10', '  Meeting 17:00 ');
  assert.deepEqual(n, { '2026-11-10': 'Meeting 17:00' });
  n = setNote(n, '2026-11-10', 'Race');
  assert.equal(n['2026-11-10'], 'Race');
  assert.deepEqual(setNote(n, '2026-11-10', '   '), {});
  assert.deepEqual(setNote(n, '2026-11-10', null), {});
  assert.equal(MAX_NOTE, 200);
});

test('upcoming notes: today first, then the next ones, past ones left out', () => {
  const n = { '2026-11-01': 'old', '2026-11-08': 'today', '2026-11-20': 'later', '2026-11-09': 'tomorrow' };
  assert.deepEqual(upcomingNotes(n, '2026-11-08').map(x => x.date), ['2026-11-08', '2026-11-09', '2026-11-20']);
});

const text = k => k;
const data = { ...emptySnapshot(), lessons: [], dayNotes: {} };
test('the phone applies setDayNote and refuses bad ones', () => {
  assert.deepEqual(applyCommand(data, 'setDayNote', { date: '2026-11-10', text: 'Meeting' }, text).data.dayNotes, { '2026-11-10': 'Meeting' });
  assert.deepEqual(applyCommand({ ...data, dayNotes: { '2026-11-10': 'x' } }, 'setDayNote', { date: '2026-11-10', text: null }, text).data.dayNotes, {});
  assert.deepEqual(applyCommand({ ...emptySnapshot(), lessons: [] }, 'setDayNote', { date: '2026-11-10', text: 'From old data' }, text).data.dayNotes, { '2026-11-10': 'From old data' });
  for (const args of [{ date: '2026-02-30', text: 'x' }, { date: '2026-11-10', text: 'x'.repeat(201) }, { date: '2026-11-10', text: 5 }])
    assert.throws(() => applyCommand(data, 'setDayNote', args, text), Refused);
});

test('local sources edit notes; read-only ones refuse', async () => {
  const src = createSource({ status: 'phone', canEdit: true, initial: { ...emptySnapshot() } });
  await src.setDayNote('2026-11-10', 'Meeting');
  let s; src.subscribe(x => { s = x; })();
  assert.deepEqual(s.dayNotes, { '2026-11-10': 'Meeting' });
  const ro = createSource({ status: 'backup', canEdit: false, initial: emptySnapshot() });
  await assert.rejects(ro.setDayNote('2026-11-10', 'x'), /read-only/);
});

test('the linked source sends setDayNote and shows the phone notes', async () => {
  const h = { state: [], message: [], peer: [] }, sent = [];
  const conn = { state: 'connected', on(ev, fn) { h[ev].push(fn); }, async send(t, f) { sent.push({ t, ...f }); } };
  const src = createLinkedSource(conn, null);
  const p = src.setDayNote('2026-11-10', 'Meeting'); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(sent.at(-1).args, { date: '2026-11-10', text: 'Meeting' });
  h.message.forEach(fn => fn({ t: 'ack', id: sent.at(-1).id, ok: true })); await p;
  h.message.forEach(fn => fn({ t: 'snapshot', lessons: [], rateCents: null, seasonStartMonth: 11, timeZoneId: 'Europe/Rome', dayNotes: { '2026-11-10': 'Meeting' } }));
  let s; src.subscribe(x => { s = x; })();
  assert.deepEqual(s.dayNotes, { '2026-11-10': 'Meeting' });
  h.message.forEach(fn => fn({ t: 'snapshot', lessons: [], rateCents: null, seasonStartMonth: 11, timeZoneId: 'Europe/Rome' }));
  src.subscribe(x => { s = x; })();
  assert.deepEqual(s.dayNotes, {}); // a 3.1 phone sends none
});
