// Welcome on first open (with a quick spotlight tour), What's new once after an update, and the tour itself.
import { openSheet } from './sheet.js';
import { esc } from '../html.js';
import { t } from './i18n.js';

// The Karvo logo (its gradients are in index.html), with the splash's animation.
const LOGO = '<svg class="m-logo" viewBox="18 24.5 72 54" aria-label="Karvo"><circle class="sun" cx="33.5" cy="41" r="6.2" fill="#F4C06A"/><path class="m-far" d="M56.6,33.6 L83,75 L63.5,75 C55.5,68.5 54,62.5 60.5,56.5 C68,49.5 66,41.5 56.6,33.6 Z" fill="url(#k-shade)"/><path class="m-near" d="M25,75 L53,28 C61.5,39 62.5,47.5 55,54.5 C48,61 49.5,68 57,75 Z" fill="url(#k-lit)"/></svg>';
const up = (html, i) => html.replace(/^<(\w+)/, `<$1 class="up" style="--d:${i * 80}ms"`); // staggered entrance

const num = v => Number(String(v ?? '').replace(/^web-/, '')) || null;

/** 'welcome' on a fresh app, 'whatsNew' after an update (also for apps from before this screen existed), else 'none'. */
export function startScreen(seenVersion, current, hasLessons) {
  if (seenVersion == null) return hasLessons ? 'whatsNew' : 'welcome';
  const seen = num(seenVersion), now = num(current);
  return seen != null && now != null && seen < now ? 'whatsNew' : 'none';
}

/** Steps: the tab they live on, the element they point at, and their texts. */
export const TOUR = [
  { tab: 'lessons', sel: '.m-fab', title: 'tourAddTitle', body: 'tourAddBody' },
  { tab: 'lessons', sel: '.m-events', title: 'tourEventsTitle', body: 'tourEventsBody' },
  { tab: 'overview', sel: '.m-tabs [data-tab="overview"]', title: 'tourOverviewTitle', body: 'tourOverviewBody' },
  { tab: 'settings', sel: '#ms-rate', title: 'tourSettingsTitle', body: 'tourSettingsBody' },
  { tab: 'settings', sel: '.m-view [data-backup]', title: 'tourBackupTitle', body: 'tourBackupBody' },
  { tab: 'settings', sel: '.m-view [data-links]', title: 'tourPcTitle', body: 'tourPcBody' },
];

/** Dims the app except the step's element; Next / Skip. `setTab` switches the app to the step's tab. */
export function runTour(setTab) {
  const el = document.createElement('div');
  el.className = 'm-tour';
  el.innerHTML = '<div class="hole"></div><div class="tip"></div>';
  document.body.append(el);
  const hole = el.querySelector('.hole');
  let i = 0;
  const show = () => {
    const step = TOUR[i];
    if (!step) { el.classList.add('out'); return setTimeout(() => el.remove(), 200); }
    setTab(step.tab);
    const target = document.querySelector(step.sel);
    target?.scrollIntoView({ block: 'center' });
    const r = target?.getBoundingClientRect();
    const low = r && r.top + r.height / 2 > innerHeight / 2;
    // The same hole moves from target to target (CSS transition); with no target it shrinks to the centre.
    Object.assign(hole.style, r ? { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` }
      : { left: '50%', top: '50%', width: '0px', height: '0px' });
    el.querySelector('.tip').outerHTML = `<div class="tip ${low ? 'top' : 'bottom'}" role="dialog" aria-live="polite"><small>${i + 1}/${TOUR.length}</small><h3>${esc(t(step.title))}</h3><p>${esc(t(step.body))}</p>
      <div class="btns"><button class="btn" data-skip>${esc(t('tourSkip'))}</button><button class="btn primary" data-next>${esc(t(i === TOUR.length - 1 ? 'tourDone' : 'tourNext'))}</button></div></div>`;
    const end = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    el.querySelector('[data-skip]').onclick = end;
    el.querySelector('[data-next]').onclick = () => { i++; show(); };
  };
  show();
}

export function openWelcome(onTour) {
  const { el, close } = openSheet(`<div class="m-start">${LOGO}${[`<h3>${esc(t('welcomeTitle'))}</h3>`, `<p>${esc(t('welcomeBody'))}</p>`].map((h, i) => up(h, i + 6)).join('')}
    <div class="btns up" style="--d:640ms"><button class="btn" data-skip>${esc(t('tourSkip'))}</button><button class="btn primary" data-tour>${esc(t('welcomeTour'))}</button></div></div>`);
  el.querySelector('[data-skip]').onclick = close;
  el.querySelector('[data-tour]').onclick = () => { close(); onTour(); };
}

export function openWhatsNew(version) {
  const { el, close } = openSheet(`<div class="m-start"><h3>${esc(t('whatsNewTitle', version))}</h3>
    <ul>${t('whatsNewItems').split('|').map((x, i) => up(`<li>${esc(x)}</li>`, i + 1)).join('')}</ul><div class="btns"><button class="btn primary" data-ok>OK</button></div></div>`);
  el.querySelector('[data-ok]').onclick = close;
}
