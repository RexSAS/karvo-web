#!/usr/bin/env node
// A pretend phone for testing the link without Android: pairs from the PC's QR text, keeps lessons in memory,
// and applies every command with the same rules the spec gives the real phone.
//   node tools/fake-phone.mjs "<qr text>" [--relay ws://localhost:8799] [--empty] [--state file.json]
//   node tools/fake-phone.mjs --state file.json [--relay ...]        (reconnect with a saved pairing)
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { parseQr } from '../link/pairing.js';
import { b64url } from '../link/crypto.js';
import { createConnection, RELAY_URL } from '../link/connection.js';
import { demoLessons } from '../source/demo.js';
import { markPaid, markUnpaid } from '../domain/paid.js';
import { planImport } from '../domain/importPlan.js';
import { validateLesson } from '../domain/validate.js';

const args = process.argv.slice(2), opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const relayUrl = opt('--relay') ?? RELAY_URL, statePath = opt('--state') ?? 'fake-phone.json';
const qr = args.find(a => a.startsWith('karvo:link?'));

let saved = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
if (qr) {
  const p = parseQr(qr);
  saved = { record: { roomId: b64url(p.roomId), secret: b64url(p.secret), peerName: p.name }, data: null };
}
if (!saved) { console.error('Give the QR text from the PC, or --state with a saved pairing.'); process.exit(1); }
saved.data ??= { lessons: args.includes('--empty') ? [] : demoLessons(), rateCents: 3000, seasonStartMonth: 11, timeZoneId: 'Europe/Rome' };
const persist = () => writeFileSync(statePath, JSON.stringify(saved));
persist();

const data = saved.data;
const MESSAGES = { StudentBlank: 'Enter a student name', DurationZero: 'Duration must be more than 0', DurationTooLong: 'Max 24 hours', MinutesOver59: 'Minutes must be 0–59' };
const nextId = () => Math.max(0, ...data.lessons.map(l => l.id)) + 1;
function checkLesson(l) {
  const m = l?.durationMinutes;
  if (!Number.isInteger(m) || !/^\d{4}-\d{2}-\d{2}$/.test(l?.date ?? '')) throw new Error('Invalid lesson');
  const errors = validateLesson(String(l.student ?? ''), Math.floor(m / 60), m % 60);
  if (errors.length) throw new Error(errors.map(e => MESSAGES[e]).join(' · '));
  return { id: l.id, date: l.date, durationMinutes: m, student: l.student.trim(), notes: l.notes?.trim() || null, paidOn: l.paidOn ?? null };
}
const ops = {
  addLesson: ({ lesson }) => { data.lessons.push({ ...checkLesson(lesson), id: nextId() }); },
  updateLesson: ({ lesson }) => {
    const i = data.lessons.findIndex(l => l.id === lesson?.id);
    if (i < 0) throw new Error('That lesson no longer exists');
    data.lessons[i] = checkLesson(lesson);
  },
  deleteLesson: ({ id }) => { data.lessons = data.lessons.filter(l => l.id !== id); },
  markPaid: ({ month, paidOn }) => { data.lessons = markPaid(data.lessons, month, paidOn); },
  markUnpaid: ({ month }) => { data.lessons = markUnpaid(data.lessons, month); },
  setRate: ({ rateCents }) => {
    if (rateCents !== null && !(Number.isInteger(rateCents) && rateCents > 0)) throw new Error('Invalid rate');
    data.rateCents = rateCents;
  },
  setSeasonStart: ({ month }) => { if (!(month >= 1 && month <= 12)) throw new Error('Invalid month'); data.seasonStartMonth = month; },
  importLessons: ({ lessons }) => {
    const { toAdd, skipped } = planImport(data.lessons, lessons.map(checkLesson));
    toAdd.forEach(l => data.lessons.push({ ...l, id: nextId() }));
    return { added: toAdd.length, skipped };
  },
  restoreAll: ({ lessons }) => {
    if (data.lessons.length) throw new Error('This phone already has lessons, so nothing was restored');
    lessons.map(checkLesson).forEach(l => data.lessons.push({ ...l, id: nextId() }));
  },
};

const conn = createConnection({ record: saved.record, role: 'phone', relayUrl, appVersion: '0-fake', myName: 'Fake phone' });
const sendSnapshot = () => conn.send('snapshot', data).catch(() => {});
conn.on('state', s => console.log(`[state] ${s}`));
conn.on('peer', p => { console.log(`Linked to ${p.name}`); setTimeout(sendSnapshot, 50); });
conn.on('message', async msg => {
  if (msg.t === 'unpaired') { console.log('Unlinked by the PC'); rmSync(statePath, { force: true }); conn.stop(); process.exit(0); }
  if (msg.t !== 'command') return;
  let reply;
  try {
    if (!ops[msg.op]) throw new Error(`Unknown command ${msg.op}`);
    reply = { id: msg.id, ok: true, result: ops[msg.op](msg.args ?? {}) };
  } catch (e) { reply = { id: msg.id, ok: false, error: e.message }; }
  console.log(`[command] ${msg.op} → ${reply.ok ? 'ok' : reply.error}`);
  persist();
  await conn.send('ack', reply).catch(() => {});
  if (reply.ok) sendSnapshot();
});
process.on('SIGINT', () => { conn.stop(); setTimeout(() => process.exit(0), 200); });
await conn.start();
console.log(`Fake phone: ${data.lessons.length} lessons, relay ${relayUrl}, state ${statePath}`);
