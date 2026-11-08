import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEvent, updateEvent, deleteEvent, eventsOn, upcomingDays, normalizeEvents, mergeEvents, MAX_EVENT } from '../domain/events.js';

const E = [{ id: 1, date: '2026-11-08', text: 'Meeting 17:00' }, { id: 2, date: '2026-11-08', text: 'Dinner' }, { id: 3, date: '2026-11-11', text: 'Race' }, { id: 4, date: '2026-11-20', text: 'Later' }];

test('add, update, delete events; several per day', () => {
  let ev = addEvent([], { date: '2026-11-10', text: '  Meeting ' });
  assert.deepEqual(ev, [{ id: 1, date: '2026-11-10', text: 'Meeting' }]);
  ev = addEvent(ev, { date: '2026-11-10', text: 'Dinner' });
  assert.equal(eventsOn(ev, '2026-11-10').length, 2);
  ev = updateEvent(ev, { id: 2, date: '2026-11-11', text: 'Dinner moved' });
  assert.deepEqual(eventsOn(ev, '2026-11-11').map(e => e.text), ['Dinner moved']);
  assert.deepEqual(deleteEvent(ev, 1).map(e => e.id), [2]);
  assert.equal(MAX_EVENT, 200);
});

test('the next days: today, tomorrow, in 2 and 3 days — nothing further, nothing past', () => {
  const days = upcomingDays(E, '2026-11-08', 3);
  assert.deepEqual(days.map(d => [d.inDays, d.events.map(e => e.text)]), [[0, ['Meeting 17:00', 'Dinner']], [3, ['Race']]]);
});

test('old one-note-per-day data becomes events', () => {
  assert.deepEqual(normalizeEvents({ lessons: [], dayNotes: { '2026-11-10': 'Meeting' } }).events, [{ id: 1, date: '2026-11-10', text: 'Meeting' }]);
  assert.deepEqual(normalizeEvents({ lessons: [], events: E }).events, E);
  assert.deepEqual(normalizeEvents({ lessons: [] }).events, []);
});

test('merging restored events skips exact duplicates and gives new ids', () => {
  const merged = mergeEvents([{ id: 5, date: '2026-11-10', text: 'A' }], [{ date: '2026-11-10', text: 'A' }, { date: '2026-11-12', text: 'B' }]);
  assert.deepEqual(merged, [{ id: 5, date: '2026-11-10', text: 'A' }, { id: 6, date: '2026-11-12', text: 'B' }]);
});

import { applyCommand, Refused } from '../link/phoneSide.js';
import { createSource, emptySnapshot } from '../source/core.js';
import { createLinkedSource } from '../source/linked.js';
import { needsSyncBackup } from '../source/pcBackups.js';
const text = k => k;
const data = { ...emptySnapshot(), lessons: [], events: [] };

test('the phone applies add/update/delete event and refuses bad ones', () => {
  let d = applyCommand(data, 'addEvent', { event: { date: '2026-11-10', text: ' Meeting ' } }, text).data;
  d = applyCommand(d, 'addEvent', { event: { date: '2026-11-10', text: 'Dinner' } }, text).data;
  assert.deepEqual(d.events.map(e => [e.id, e.text]), [[1, 'Meeting'], [2, 'Dinner']]);
  d = applyCommand(d, 'updateEvent', { event: { id: 2, date: '2026-11-11', text: 'Dinner moved' } }, text).data;
  assert.equal(d.events[1].date, '2026-11-11');
  d = applyCommand(d, 'deleteEvent', { id: 1 }, text).data;
  assert.deepEqual(d.events.map(e => e.id), [2]);
  for (const [op, args] of [['addEvent', { event: { date: '2026-02-30', text: 'x' } }], ['addEvent', { event: { date: '2026-11-10', text: ' ' } }],
    ['addEvent', { event: { date: '2026-11-10', text: 'x'.repeat(201) } }], ['updateEvent', { event: { id: 9, date: '2026-11-10', text: 'x' } }], ['deleteEvent', { id: 9 }]])
    assert.throws(() => applyCommand(d, op, args, text), Refused, op);
});

test('restoring to an empty phone brings the PC events, merged and validated', () => {
  const lesson = { id: 0, date: '2026-11-06', durationMinutes: 60, student: 'Bo', notes: null, paidOn: null };
  const r = applyCommand({ ...data, events: [{ id: 1, date: '2026-11-12', text: 'phone' }] }, 'restoreAll',
    { lessons: [lesson], events: [{ date: '2026-11-10', text: 'Meeting' }, { date: '2026-11-12', text: 'phone' }] }, text).data;
  assert.deepEqual(r.events.map(e => e.text), ['phone', 'Meeting']);
  assert.throws(() => applyCommand(data, 'restoreAll', { lessons: [lesson], events: [{ date: 'nope', text: 'x' }] }, text), Refused);
  assert.equal(applyCommand(data, 'restoreAll', { lessons: [lesson] }, text).data.lessons.length, 1);
});

test('local sources edit events; read-only ones refuse; old notes are converted', async () => {
  const src = createSource({ status: 'phone', canEdit: true, initial: { ...emptySnapshot(), events: undefined, dayNotes: { '2026-11-09': 'old note' } } });
  await src.addEvent({ date: '2026-11-10', text: 'Meeting' });
  let s; src.subscribe(x => { s = x; })();
  assert.deepEqual(s.events.map(e => e.text), ['old note', 'Meeting']);
  await assert.rejects(src.addEvent({ date: '2026-11-10', text: ' ' }));
  const ro = createSource({ status: 'backup', canEdit: false, initial: emptySnapshot() });
  await assert.rejects(ro.addEvent({ date: '2026-11-10', text: 'x' }), /read-only/);
});

test('the linked source sends event commands and shows the phone events', async () => {
  const h = { state: [], message: [], peer: [] }, sent = [];
  const conn = { state: 'connected', on(ev, fn) { h[ev].push(fn); }, async send(t, f) { sent.push({ t, ...f }); } };
  const src = createLinkedSource(conn, null, { timeoutMs: 50 });
  src.addEvent({ date: '2026-11-10', text: 'Meeting' }).catch(() => {}); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(sent.at(-1), { t: 'command', id: sent.at(-1).id, op: 'addEvent', args: { event: { date: '2026-11-10', text: 'Meeting' } } });
  src.restoreAll([{ id: 1 }], [{ id: 7, date: '2026-11-10', text: 'A' }]).catch(() => {}); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(sent.at(-1).args, { lessons: [{ id: 1 }], events: [{ date: '2026-11-10', text: 'A' }] });
  h.message.forEach(fn => fn({ t: 'snapshot', lessons: [], rateCents: null, seasonStartMonth: 11, timeZoneId: 'Europe/Rome' }));
  let s; src.subscribe(x => { s = x; })();
  assert.deepEqual(s.events, []); // a 3.1 phone sends none
  await new Promise(r => setTimeout(r, 80));
});

test('a PC copy with events but no lessons is still backed up', () =>
  assert.equal(needsSyncBackup([], { lessons: [], events: [{ id: 1, date: '2026-11-10', text: 'x' }] }), true));
