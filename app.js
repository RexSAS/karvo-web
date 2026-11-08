// Starts the app: picks the data source, keeps UI state, and redraws every panel from each new snapshot.
// With a linked phone, the live phone is the source while connected and the read-only backup otherwise.
import { createDemoSource } from './source/demo.js';
import { createBackupSource } from './source/backup.js';
import { createLinkedSource, needsRestore, guardedStore } from './source/linked.js';
import { openStore } from './source/idbStore.js';
import { emptySnapshot, createSource } from './source/core.js';
import { createConnection, deleteRoom, RELAY_URL } from './link/connection.js';
import { pcName } from './link/pairing.js';
import { monthOf, today } from './domain/dates.js';
import { runSplash } from './ui/splash.js';
import { renderBanner } from './ui/banner.js';
import { renderEmpty } from './ui/empty.js';
import { paintMoney } from './ui/money.js';
import { pickTextFile } from './ui/files.js';
import { renderCalendar } from './ui/calendar.js';
import { renderLessons } from './ui/lessons.js';
import { openLessonDialog } from './ui/lessonDialog.js';
import { renderOverview } from './ui/overview.js';
import { renderStats } from './ui/stats.js';
import { openSettings } from './ui/settings.js';
import { openLinkDialog } from './ui/link.js';
import { showPhoneScreen } from './ui/phone.js';
import { students } from './domain/stats.js';

const APP_VERSION = 'web-2';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
// Testing only: point at a local relay (wrangler dev). Never another host, so a link can't be redirected.
const RELAY = /^ws:\/\/localhost(:\d+)?$/.test(params.get('relay') ?? '') ? params.get('relay') : RELAY_URL;

const state = {
  source: null, unsub: null, snapshot: emptySnapshot(), view: monthOf(today()), selDay: null, showMoney: false,
  store: null, backup: null, conn: null, pairing: null, link: { paired: false, state: 'offline', peerName: '', phoneNewer: false },
};

export const actions = {
  setView(month) { state.view = month; state.selDay = null; render(); },
  selectDay(date) { state.view = monthOf(date); state.selDay = date; render(); },
  setStatsLifetime(on) { state.statsLifetime = on; render(); },
  toggleMoney() {
    state.showMoney = !state.showMoney;
    document.body.classList.add('reveal');
    render();
    setTimeout(() => document.body.classList.remove('reveal'), 300);
  },
  add() {
    openLessonDialog({ defaultDate: state.selDay ?? (state.view === monthOf(today()) ? today() : state.view + '-01'),
      studentNames: students(state.snapshot.lessons).map(s => s.name), readOnly: false,
      onSave: async l => { await state.source.addLesson(l); actions.selectDay(l.date); } });
  },
  edit(lesson) {
    openLessonDialog({ lesson, studentNames: students(state.snapshot.lessons).map(s => s.name), readOnly: !state.source.canEdit,
      onSave: l => state.source.updateLesson(l), onDelete: id => state.source.deleteLesson(id) });
  },
  async importCsv() {
    const text = await pickTextFile();
    if (text == null) return null;
    return state.source.importCsv(text);
  },
  linkPhone() {
    openLinkDialog({ relayUrl: RELAY, appVersion: APP_VERSION, onLinked: async (conn, record) => {
      startLink(record, conn); // first: the phone's first snapshot may already be on its way
      try { await state.store?.savePairing(record); } catch { state.backup.storageError = true; }
    } });
  },
  async unlink() {
    const { conn, pairing } = state;
    if (conn?.state === 'connected') await conn.send('unpaired').catch(() => {});
    await conn?.stop();
    if (pairing) deleteRoom(pairing, RELAY);
    await state.store?.removePairing().catch(() => {});
    state.conn = state.pairing = null;
    state.link = { paired: false, state: 'offline', peerName: '', phoneNewer: false };
    await useBackup();
  },
};

const panels = [['lessons', renderLessons], ['calendar', renderCalendar], ['overview', renderOverview], ['stats', renderStats]];

function render() {
  const { source, snapshot } = state;
  renderBanner($('banner'), { status: source.status, syncedAt: snapshot.syncedAt, storageError: source.storageError, link: state.link });
  const empty = source.status === 'backup' && snapshot.lessons.length === 0;
  $('empty').hidden = !empty;
  $('app').hidden = empty;
  if (empty) renderEmpty($('empty'), { paired: state.link.paired, linkPhone: actions.linkPhone, importCsv: () => actions.importCsv().catch(e => alert(e.message)) });
  else panels.forEach(([id, fn]) => fn($(id), state, actions));
  paintMoney(state.showMoney);
}

function useSource(src) {
  if (state.source === src) return;
  state.unsub?.();
  state.source = src;
  state.unsub = src.subscribe(snapshot => { state.snapshot = snapshot; render(); });
}

async function useBackup() {
  // Re-read the store: while linked it received every phone snapshot.
  if (state.store) { try { state.backup = await createBackupSource(state.store); } catch {} }
  useSource(state.backup);
  render();
}

function startLink(record, existing = null) {
  state.pairing = record;
  state.link = { paired: true, state: existing?.state ?? 'offline', peerName: record.peerName, phoneNewer: false };
  const conn = state.conn = existing ?? createConnection({ record, relayUrl: RELAY, appVersion: APP_VERSION, myName: pcName(navigator.userAgent) });
  const backupSnap = state.snapshot;
  const store = guardedStore(state.store ?? { save: async () => {} }, backupSnap.lessons.length);
  const linked = createLinkedSource(conn, store, { peerName: record.peerName });
  let asked = false, declined = false;

  linked.subscribe(async snap => {
    if (conn !== state.conn) return;
    useSource(linked);
    if (asked || declined) return;
    asked = true;
    const n = needsRestore(snap, backupSnap);
    if (!n) return;
    if (confirm(`Restore ${n} lessons to the phone?\n\nYour phone has no lessons. This PC has a backup of ${n}.`))
      linked.restoreAll(backupSnap.lessons).catch(e => alert(e.message));
    else declined = true; // keep the PC backup (the guard holds empty snapshots back) and don't ask again in this tab
  });
  conn.on('peer', p => {
    state.link.peerName = p.name;
    if (p.name !== record.peerName) { record.peerName = p.name; state.store?.savePairing(record).catch(() => {}); }
  });
  conn.on('message', m => { if (m.t === 'unpaired') actions.unlink(); });
  conn.on('state', s => {
    if (conn !== state.conn) return;
    Object.assign(state.link, { state: s, phoneNewer: conn.phoneNewer });
    if (s === 'unlinked') return actions.unlink();
    if (s !== 'connected' && state.source === linked) { asked = false; useBackup(); }
    else render();
  });
  if (!existing) conn.start();
  else if (existing.state === 'connected') render();
}

async function boot() {
  if (showPhoneScreen()) return 'phone';
  runSplash();
  if (params.has('demo')) { useSource(createDemoSource()); return; }
  try {
    state.store = await openStore();
    state.backup = await createBackupSource(state.store);
  } catch {
    state.backup = createSource({ status: 'backup', canEdit: false, initial: emptySnapshot() });
    state.backup.storageError = true;
  }
  useSource(state.backup);
  const pairing = await state.store?.loadPairing().catch(() => null);
  if (pairing) startLink(pairing);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') state.conn?.retryNow(); });
  addEventListener('pagehide', () => state.conn?.stop());
}

if (await boot() !== 'phone') startPcUi();

function startPcUi() {
addEventListener('resize', render);
$('settings-btn').onclick = () => openSettings(state.source, () => state.snapshot,
  params.has('demo') ? null : { paired: state.link.paired, peerName: state.link.peerName, unlink: actions.unlink, linkPhone: actions.linkPhone });

// Tooltips for anything with data-tip (chart marks).
const tip = $('tip');
document.addEventListener('mousemove', e => {
  const t = e.target.closest?.('[data-tip]');
  if (!t) { tip.style.display = 'none'; return; }
  tip.textContent = t.dataset.tip;
  Object.assign(tip.style, { display: 'block', left: e.clientX + 12 + 'px', top: e.clientY + 12 + 'px' });
});
}
