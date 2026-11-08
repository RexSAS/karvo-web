#!/usr/bin/env node
// A pretend phone for testing the link without a real one: pairs from the PC's QR text and runs the same
// phone-side code as the iPhone web app (link/phoneSide.js), with its data in a JSON file.
//   node tools/fake-phone.mjs "<qr text>" [--relay ws://localhost:8799] [--empty] [--state file.json]
//   node tools/fake-phone.mjs --state file.json [--relay ...]        (reconnect with a saved pairing)
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { parseQr } from '../link/pairing.js';
import { b64url } from '../link/crypto.js';
import { RELAY_URL } from '../link/connection.js';
import { createPhoneLink } from '../link/phoneSide.js';
import { createSource } from '../source/core.js';
import { demoLessons } from '../source/demo.js';

const EN = { StudentBlank: 'Enter a student name', DurationZero: 'Duration must be more than 0', DurationTooLong: 'Max 24 hours',
  MinutesOver59: 'Minutes must be 0–59', lessonGone: 'That lesson no longer exists',
  phoneNotEmpty: 'This phone already has lessons, so nothing was restored', invalidRate: 'Enter a rate like 30 or 27.50',
  invalidMonth: 'Pick a month from January to December', invalidData: "The phone couldn't read that change",
  unknownCommand: 'Update Karvo on your phone to do this from the PC', eventGone: 'That event no longer exists', saveFailed: "The phone couldn't save that change" };

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

const source = createSource({ status: 'phone', canEdit: true, initial: saved.data, strict: true,
  store: { async save(d) { saved.data = d; persist(); }, async remove() {}, async load() { return saved.data; } } });
const link = createPhoneLink({ pairing: saved.record, source, text: k => EN[k] ?? k, relayUrl, appVersion: '0-fake', myName: 'Fake phone' });
link.on('state', s => console.log(`[state] ${s}`));
link.on('gone', () => { console.log('Unlinked by the PC'); rmSync(statePath, { force: true }); link.dispose(); process.exit(0); });
source.subscribe(d => console.log(`[data] ${d.lessons.length} lessons`));
process.on('SIGINT', async () => { await link.stop(); setTimeout(() => process.exit(0), 200); });
await link.start();
console.log(`Fake phone: ${saved.data.lessons.length} lessons, relay ${relayUrl}, state ${statePath}`);
