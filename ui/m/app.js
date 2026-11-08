// The iPhone app (opened from the Home Screen): its own lessons, tabs like the Android app, backup reminders,
// and the PC link with the iPhone as master.
import { openStore } from '../../source/idbStore.js';
import { createLocalSource } from '../../source/local.js';
import { students } from '../../domain/stats.js';
import { lessonsToCsv, csvFileBytes, csvFileName } from '../../domain/csv.js';
import { today } from '../../domain/dates.js';
import { esc } from '../html.js';
import { renderLessons, openLessonSheet, openEventSheet } from './lessons.js';
import { renderCalendar } from './calendar.js';
import { today as todayDate, monthOf } from '../../domain/dates.js';
import { eventsOn } from '../../domain/events.js';
import { renderOverview } from './overview.js';
import { renderSettings, APP_VERSION } from './settings.js';
import { startScreen, runTour, openWelcome, openWhatsNew } from './tour.js';
import { reminderState, snooze, recordBackup, recordSync } from './backup.js';
import { startLinks } from './links.js';
import { t, setLang } from './i18n.js';
import { runSplash } from '../splash.js';

const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  lessons: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
};

// Android's Alpine Night backdrop: fixed stars, a far and a near ridge, faint snowflakes on Settings (decorative only).
const STARS = [[.08,.04,.9],[.20,.12,.7],[.33,.07,.5],[.41,.27,.6],[.52,.03,.8],[.61,.18,.5],[.70,.08,.9],[.78,.30,.6],[.86,.14,1],[.93,.40,.7],
  [.12,.32,.5],[.27,.22,.6],[.47,.15,.4],[.57,.34,.5],[.66,.42,.4],[.83,.05,.5],[.03,.19,.6],[.37,.38,.4],[.74,.24,.7],[.96,.09,.5]];
const FAR = [[0,.55],[.12,.35],[.22,.5],[.38,.12],[.52,.45],[.64,.28],[.78,.55],[.9,.22],[1,.4]];
const NEAR = [[0,.82],[.15,.6],[.28,.76],[.45,.5],[.6,.78],[.75,.62],[.88,.8],[1,.7]];
const FLAKE = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z"/></svg>';
const ridge = pts => `M0,100 ${pts.map(([x, y]) => `L${x * 100},${y * 100}`).join(' ')} L100,100 Z`;
function backdrop() {
  const el = document.createElement('div');
  el.className = 'm-backdrop';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg class="stars" viewBox="0 0 100 100" preserveAspectRatio="none">${STARS.map(([x, y, a], i) =>
    `<ellipse cx="${x * 100}" cy="${y * 100}" rx="${i % 3 ? .28 : .4}" ry="${i % 3 ? .13 : .19}" fill="#fff" opacity="${a}"/>`).join('')}</svg>
    <svg class="ridges" viewBox="0 0 100 100" preserveAspectRatio="none"><defs>
      <linearGradient id="bd-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D5AA8" stop-opacity=".45"/><stop offset="1" stop-color="#3D5AA8" stop-opacity="0"/></linearGradient>
      <linearGradient id="bd-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9F0FF" stop-opacity=".28"/><stop offset=".3" stop-color="#4F69B8" stop-opacity=".45"/><stop offset="1" stop-color="#0C1530"/></linearGradient></defs>
      <path d="${ridge(FAR)}" fill="url(#bd-far)"/><path d="${ridge(NEAR)}" fill="url(#bd-near)"/></svg>
    <i class="flake f1">${FLAKE}</i><i class="flake f2">${FLAKE}</i><i class="flake f3">${FLAKE}</i>`;
  return el;
}

const state = { tab: 'lessons', snapshot: null, meta: null, search: '', showMoney: false, source: null, store: null, links: null };

function fatal(message) {
  document.body.className = 'm';
  document.body.innerHTML = `<div class="m-full"><h2>Karvo</h2><p>${esc(message)}</p></div>`;
}

async function saveMeta(next) {
  state.meta = next;
  await state.store.saveKey('meta', next).catch(() => {});
  render();
}

export const actions = {
  setTab(tab) { state.tab = tab; state.cal = null; state.flash = null; render(); },
  /** Opens (or moves) the calendar on the Lessons tab; null closes it. */
  setCal(cal) { state.cal = cal; render(); },
  openCalendar() { const d = todayDate(); actions.setCal({ month: monthOf(d), day: d }); },
  /** A result line in Settings that survives the redraw the change itself causes. */
  flash(text, err = false) { state.flash = { text, err }; render(); },
  setSearch(q) { state.search = q; render({ keepFocus: true }); },
  toggleMoney() { state.showMoney = !state.showMoney; render(); },
  add() {
    openLessonSheet({ names: students(state.snapshot.lessons).map(s => s.name), onSave: l => state.source.addLesson(l) });
  },
  edit(lesson) {
    openLessonSheet({ lesson, names: students(state.snapshot.lessons).map(s => s.name),
      onSave: l => state.source.updateLesson(l), onDelete: id => state.source.deleteLesson(id) });
  },
  editEvent(id, date) {
    const event = id == null ? null : state.snapshot.events.find(e => e.id === id);
    openEventSheet({ event, date, onSave: v => event ? state.source.updateEvent({ ...event, ...v }) : state.source.addEvent(v),
      onDelete: eid => state.source.deleteEvent(eid) });
  },
  /** CSV through the Share sheet; only a completed share counts as a backup. */
  async backupNow() {
    const file = new File([csvFileBytes(lessonsToCsv(state.snapshot.lessons))], csvFileName(today()), { type: 'text/csv' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { return false; } // cancelled: not a backup
    } else {
      const url = URL.createObjectURL(file);
      Object.assign(document.createElement('a'), { href: url, download: file.name }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    await saveMeta(recordBackup(state.meta));
    return true;
  },
  snooze() { return saveMeta(snooze(state.meta)); },
  setLang(l) { setLang(l); return saveMeta({ ...state.meta, lang: l }); },
  tour() { runTour(tab => actions.setTab(tab)); },
  pcSynced() { return saveMeta(recordSync(state.meta)); },
  get state() { return state; },
  render: () => render(),
};

function renderBlocking(r) {
  let el = document.querySelector('.m-full.m-backup');
  if (r.level !== 'blocking') { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'm-full m-backup'; document.body.append(el); }
  el.innerHTML = `<h2>${esc(t('backupNeededTitle'))}</h2><p>${esc(backupLine(r))}</p><p>${esc(t('backupNeededBody'))}</p>
    <button class="btn primary" data-backup>${esc(t('backupNow'))}</button>
    ${r.canSnooze ? `<button class="btn" data-snooze>${esc(t('remindTomorrow'))}</button>` : ''}`;
  el.querySelector('[data-backup]').onclick = () => actions.backupNow();
  el.querySelector('[data-snooze]')?.addEventListener('click', () => actions.snooze());
}

const neverBackedUp = () => !state.meta.lastBackupAt && !state.meta.lastPcSyncAt;
export const backupLine = r => t(neverBackedUp() ? 'noBackupDays' : 'lastBackup', r.days);

function render({ keepFocus = false } = {}) {
  if (!state.snapshot) return;
  // Count from the first lesson, not from install: an empty app keeps its start date fresh.
  if (!state.snapshot.lessons.length && Date.now() - Date.parse(state.meta.startedAt ?? 0) > 36e5) {
    saveMeta({ ...state.meta, startedAt: new Date().toISOString() }); return;
  }
  const r = reminderState(state.meta, new Date(), state.snapshot.lessons.length > 0);
  const screen = document.querySelector('.m-screen');
  const titles = { lessons: t('lessons'), overview: t('overview'), settings: t('settings') };
  const cal = state.tab === 'lessons' && state.cal;
  screen.querySelector('.m-head h1').textContent = cal ? t('calendar') : titles[state.tab];
  screen.querySelector('[data-back]').hidden = !cal;
  screen.querySelector('[data-cal]').hidden = state.tab !== 'lessons' || !!cal;
  const banner = screen.querySelector('.m-banner-slot');
  const todays = eventsOn(state.snapshot.events, today()).map(e => e.text).join(' · ');
  banner.innerHTML = (todays ? `<div class="m-banner m-today" role="status"><span>${esc(t('eventToday', todays))}</span></div>` : '') + (r.level === 'banner'
    ? `<div class="m-banner" role="status"><span>${esc(backupLine(r))}</span><button data-backup>${esc(t('backupNow'))}</button></div>` : '');
  banner.querySelector('[data-backup]')?.addEventListener('click', () => actions.backupNow());
  const view = screen.querySelector('.m-view');
  const focused = keepFocus && document.activeElement?.classList.contains('m-search') ? document.activeElement.selectionStart : null;
  const scroll = view.scrollTop;
  (cal ? renderCalendar : { lessons: renderLessons, overview: renderOverview, settings: renderSettings }[state.tab])(view, state, actions);
  view.scrollTop = scroll;
  if (focused != null) { const s = view.querySelector('.m-search'); s.focus(); s.setSelectionRange(focused, focused); }
  screen.querySelectorAll('.m-tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false'));
  screen.querySelectorAll('.m-tabs button span').forEach(s => { s.textContent = titles[s.parentElement.dataset.tab]; });
  screen.querySelector('.m-fab').hidden = state.tab !== 'lessons' || !!cal;
  document.querySelector('.m-backdrop')?.setAttribute('data-tab', state.tab);
  renderBlocking(r);
}

export async function startIphone() {
  document.body.className = 'm';
  try {
    state.store = await openStore();
    state.meta = (await state.store.loadKey('meta')) ?? { startedAt: new Date().toISOString(), lang: (navigator.language || '').startsWith('it') ? 'it' : 'en' };
    await state.store.saveKey('meta', state.meta).catch(() => {}); // a full iPhone must still open (and offer Back up now)
    state.source = await createLocalSource(state.store);
  } catch { return fatal(t('cantSave')); }
  setLang(state.meta.lang);
  navigator.serviceWorker?.register('sw.js').catch(() => {});
  navigator.storage?.persist?.().catch(() => {});

  document.querySelectorAll('header, main#app, section#empty, #banner').forEach(e => e.remove());
  const screen = document.createElement('div');
  screen.className = 'm-screen';
  screen.innerHTML = `<div class="m-head"><button class="m-icon" data-back aria-label="${esc(t('close'))}" hidden>${ICONS.back}</button><h1></h1>
    <button class="m-icon" data-cal aria-label="${esc(t('calendar'))}">${ICONS.calendar}</button></div><div class="m-banner-slot"></div><div class="m-view"></div>
    <button class="m-fab" aria-label="${esc(t('addLesson'))}">+</button>
    <nav class="m-tabs">${['lessons', 'overview', 'settings'].map(k => `<button data-tab="${k}">${ICONS[k]}<span></span></button>`).join('')}</nav>`;
  document.body.prepend(screen);
  screen.before(backdrop());
  runSplash();
  screen.querySelector('.m-fab').onclick = actions.add;
  screen.querySelector('[data-cal]').onclick = () => actions.openCalendar();
  screen.querySelector('[data-back]').onclick = () => actions.setCal(null);
  screen.querySelector('.m-tabs').onclick = e => { const b = e.target.closest('button'); if (b) actions.setTab(b.dataset.tab); };
  state.source.subscribe(s => { state.snapshot = s; render(); });
  // Once per version: welcome (fresh app) or What's new (after an update), then the version is remembered.
  const start = startScreen(state.meta.seenVersion, APP_VERSION, state.snapshot.lessons.length > 0);
  await saveMeta({ ...state.meta, seenVersion: APP_VERSION });
  if (start === 'welcome') openWelcome(() => actions.tour());
  if (start === 'whatsNew') openWhatsNew('Karvo');
  state.links = await startLinks(state, actions);
  setInterval(() => render(), 60 * 60 * 1000); // reminders move on while the app stays open
}
