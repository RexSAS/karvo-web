// The phone's side of the link (spec "Phone behaviour"), the same rules as Android 3.1's LinkCommandHandler/LinkClient.
// Used by the iPhone web app and by tools/fake-phone.mjs.
import { markPaid, markUnpaid } from '../domain/paid.js';
import { planImport } from '../domain/importPlan.js';
import { validateLesson, MAX_DURATION_MINUTES } from '../domain/validate.js';
import { createConnection, deleteRoom, RELAY_URL } from './connection.js';
import { addEvent, updateEvent, deleteEvent, mergeEvents, MAX_EVENT } from '../domain/events.js';

export class Refused extends Error {}

const isDate = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number), u = new Date(Date.UTC(y, m - 1, d));
  return u.getUTCFullYear() === y && u.getUTCMonth() === m - 1 && u.getUTCDate() === d;
};

function checkLesson(l, text) {
  if (!l || typeof l !== 'object' || !isDate(l.date) || typeof l.student !== 'string' || !Number.isInteger(l.durationMinutes)
    || l.durationMinutes < 0 || (l.paidOn != null && !isDate(l.paidOn)) || (l.notes != null && typeof l.notes !== 'string'))
    throw new Refused(text('invalidData'));
  const m = l.durationMinutes;
  const errors = validateLesson(l.student, Math.floor(m / 60), m % 60);
  if (m > MAX_DURATION_MINUTES && !errors.includes('DurationTooLong')) errors.push('DurationTooLong');
  if (errors.length) throw new Refused(errors.map(text).join(' · '));
  return { id: l.id, date: l.date, durationMinutes: m, student: l.student.trim(), notes: l.notes?.trim() || null, paidOn: l.paidOn ?? null };
}

function checkEvent(e, text) {
  if (!e || typeof e !== 'object' || !isDate(e.date) || typeof e.text !== 'string' || !e.text.trim() || e.text.trim().length > MAX_EVENT)
    throw new Refused(text('invalidData'));
  return { date: e.date, text: e.text.trim() };
}

const nextId = lessons => Math.max(0, ...lessons.map(l => l.id)) + 1;
const withIds = (existing, list) => { let id = nextId(existing); return list.map(l => ({ ...l, id: id++ })); };

/** Applies one PC command to the phone's data. Pure: returns { data, result } or throws Refused. */
export function applyCommand(data, op, args, text) {
  const lessons = data.lessons, a = args ?? {};
  const month = m => { if (typeof m !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Refused(text('invalidData')); return m; };
  const list = () => { if (!Array.isArray(a.lessons)) throw new Refused(text('invalidData')); return a.lessons.map(l => checkLesson(l, text)); };
  switch (op) {
    case 'addLesson': return { data: { ...data, lessons: [...lessons, ...withIds(lessons, [checkLesson(a.lesson, text)])] } };
    case 'updateLesson': {
      const l = checkLesson(a.lesson, text);
      if (!lessons.some(x => x.id === l.id)) throw new Refused(text('lessonGone'));
      return { data: { ...data, lessons: lessons.map(x => x.id === l.id ? l : x) } };
    }
    case 'deleteLesson':
      if (!lessons.some(x => x.id === a.id)) throw new Refused(text('lessonGone'));
      return { data: { ...data, lessons: lessons.filter(x => x.id !== a.id) } };
    case 'markPaid':
      if (!isDate(a.paidOn)) throw new Refused(text('invalidData'));
      return { data: { ...data, lessons: markPaid(lessons, month(a.month), a.paidOn) } };
    case 'markUnpaid': return { data: { ...data, lessons: markUnpaid(lessons, month(a.month)) } };
    case 'setRate':
      if (a.rateCents !== null && !(Number.isInteger(a.rateCents) && a.rateCents > 0)) throw new Refused(text('invalidRate'));
      return { data: { ...data, rateCents: a.rateCents } };
    case 'setSeasonStart':
      if (!(Number.isInteger(a.month) && a.month >= 1 && a.month <= 12)) throw new Refused(text('invalidMonth'));
      return { data: { ...data, seasonStartMonth: a.month } };
    case 'importLessons': {
      const { toAdd, skipped } = planImport(lessons, list());
      return { data: { ...data, lessons: [...lessons, ...withIds(lessons, toAdd)] }, result: { added: toAdd.length, skipped } };
    }
    case 'restoreAll': {
      const incoming = list();
      // The PC's events come along (3.2+ PCs); validated first, then merged with any the phone already has.
      const events = a.events == null ? [] : a.events;
      if (!Array.isArray(events)) throw new Refused(text('invalidData'));
      const checked = events.map(e => checkEvent(e, text));
      if (lessons.length) throw new Refused(text('phoneNotEmpty'));
      return { data: { ...data, lessons: withIds([], incoming), events: mergeEvents(data.events ?? [], checked) } };
    }
    case 'addEvent': return { data: { ...data, events: addEvent(data.events ?? [], checkEvent(a.event, text)) } };
    case 'updateEvent': {
      const e = checkEvent(a.event, text);
      if (!(data.events ?? []).some(x => x.id === a.event.id)) throw new Refused(text('eventGone'));
      return { data: { ...data, events: updateEvent(data.events, { ...e, id: a.event.id }) } };
    }
    case 'deleteEvent':
      if (!(data.events ?? []).some(x => x.id === a.id)) throw new Refused(text('eventGone'));
      return { data: { ...data, events: deleteEvent(data.events, a.id) } };
    default: throw new Refused(text('unknownCommand'));
  }
}

const snapshotOf = d => ({ lessons: d.lessons, rateCents: d.rateCents, seasonStartMonth: d.seasonStartMonth, events: d.events ?? [],
  timeZoneId: d.timeZoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone });

/**
 * One linked PC: the relay connection (role phone), commands applied one at a time to [source], acks, and a
 * snapshot to the PC after every change from either side. Events: 'state', 'gone' (unlinked or room deleted).
 */
export function createPhoneLink({ pairing, source, text, onPcSync = () => {}, relayUrl = RELAY_URL, appVersion = 'web', myName = 'iPhone',
  connect = () => createConnection({ record: pairing, role: 'phone', relayUrl, appVersion, myName }) }) {
  const conn = connect();
  const listeners = { state: [], gone: [] };
  const emit = (ev, v) => listeners[ev].forEach(fn => fn(v));
  let data = null, queue = Promise.resolve(), gone = false;
  const sendSnapshot = () => { if (conn.state === 'connected' && data) conn.send('snapshot', snapshotOf(data)).catch(() => {}); };
  const unsub = source.subscribe(d => { data = d; sendSnapshot(); });

  conn.on('state', s => {
    // connection.js emits 'peer' before 'connected', so the first snapshot waits for 'connected'.
    if (s === 'connected') { onPcSync(); sendSnapshot(); }
    emit('state', s);
    if ((s === 'unlinked') && !gone) { gone = true; emit('gone'); }
  });
  conn.on('message', msg => {
    if (msg.t === 'unpaired') { if (!gone) { gone = true; emit('gone'); } return; }
    if (msg.t !== 'command') return;
    // One at a time, in arrival order; the ack goes out only after the change is saved (or refused).
    queue = queue.then(async () => {
      let ack;
      try {
        let result;
        await source.apply(latest => { const r = applyCommand(latest, msg.op, msg.args, text); result = r.result; return r.data; });
        ack = { id: msg.id, ok: true, ...(result ? { result } : {}) };
      } catch (e) {
        ack = { id: msg.id, ok: false, error: e instanceof Refused ? e.message : text('saveFailed') };
      }
      await conn.send('ack', ack).catch(() => {});
    });
  });

  return {
    get state() { return conn.state; },
    pairing,
    on(ev, fn) { listeners[ev].push(fn); },
    start: () => conn.start(),
    stop: () => conn.stop(),
    async unpair() {
      if (conn.state === 'connected') await conn.send('unpaired').catch(() => {});
      await conn.stop(); unsub();
      await deleteRoom(pairing, relayUrl).catch(() => {});
    },
    dispose() { unsub(); return conn.stop(); },
  };
}
