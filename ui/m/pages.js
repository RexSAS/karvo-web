// Inner pages of Overview (Badges, a student) and the two start-of-moment sheets (badge unlocked, new season), as on Android.
import { BADGES, badgeProgress } from '../../domain/badges.js';
import { seasonOf, seasonLabel, seasonMonths } from '../../domain/seasons.js';
import { studentDetail } from '../../domain/stats.js';
import { earningsCents } from '../../domain/earnings.js';
import { formatHours, monthOf, today } from '../../domain/dates.js';
import { badgeSvg } from '../badge.js';
import { moneyHtml, paintMoney } from '../money.js';
import { areaChart } from '../stats.js';
import { esc } from '../html.js';
import { openSheet } from './sheet.js';
import { t, tn, locale } from './i18n.js';

const KEVIN = '<img class="m-kevin" src="img/kevin-idle.svg" alt="" width="120" height="116">';
const badgeName = b => (b ? t('badge_' + b.id) : t('badgeNone'));
const sum = ls => ls.reduce((s, l) => s + l.durationMinutes, 0);
const monthTitle = m => new Date(m + '-15').toLocaleString(locale(), { month: 'long', year: 'numeric' });
const shortDate = d => new Date(d + 'T12:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
const dayTitle = d => new Date(d + 'T12:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Minutes taught in the season containing [date]: what the badges count. */
export const seasonMinutes = (lessons, date, startMonth) => {
  const months = seasonMonths(seasonOf(date, startMonth));
  return sum(lessons.filter(l => months.includes(monthOf(l.date))));
};

/** The season badge big, the way to the next one, the whole ladder and the best badge of every season. */
export function renderBadges(view, { snapshot }) {
  const { lessons, seasonStartMonth } = snapshot;
  const season = seasonOf(today(), seasonStartMonth), mins = seasonMinutes(lessons, today(), seasonStartMonth), p = badgeProgress(mins);
  const bySeason = new Map();
  lessons.forEach(l => { const y = seasonOf(l.date, seasonStartMonth).startYear; bySeason.set(y, (bySeason.get(y) ?? 0) + l.durationMinutes); });
  const seasons = [...bySeason.entries()].sort((a, b) => b[0] - a[0]);
  view.innerHTML = `<div class="m-badge-hero">${badgeSvg(p.earned, 200)}<h3>${esc(badgeName(p.earned))}</h3>
      <p>${esc(t('season', seasonLabel(season)))} · ${formatHours(mins)}</p></div>
    <div class="m-card"><strong>${esc(p.next ? t('badgeNext', badgeName(p.next), formatHours(p.next.minutes)) : t('badgeAllEarned'))}</strong>
      <div class="m-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.fraction * 100)}"><i style="width:${p.fraction * 100}%"></i></div>
      ${p.next ? `<p class="m-note">${esc(t('badgeToGo', formatHours(p.minutesToNext)))}</p>` : ''}</div>
    <div class="m-card"><h2>${esc(t('badgesAll'))}</h2>${BADGES.map(b => `<div class="m-brow${mins >= b.minutes ? '' : ' locked'}">${badgeSvg(b, 52)}
      <span class="name">${esc(badgeName(b))}</span><span class="sub">${formatHours(b.minutes)}${mins >= b.minutes ? ` <b class="gold" aria-label="${esc(t('badgeEarned'))}">✓</b>` : ''}</span></div>`).join('')}</div>
    ${seasons.length ? `<div class="m-card"><h2>${esc(t('badgesBySeason'))}</h2>${seasons.map(([y, m]) => {
      const best = badgeProgress(m).earned;
      return `<div class="m-brow">${badgeSvg(best, 52)}<span class="name">${esc(seasonLabel({ startYear: y, startMonth: seasonStartMonth }))}
        <small>${esc(badgeName(best))}</small></span><span class="sub">${formatHours(m)}</span></div>`;
    }).join('')}</div>` : ''}`;
}

/** One student: totals (money behind the eye), last 6 months, this season vs last, and their lessons by month. */
export function renderStudent(view, state, actions) {
  const { lessons, seasonStartMonth, rateCents } = state.snapshot;
  const d = studentDetail(lessons, state.page.key, today(), seasonStartMonth);
  if (!d) { view.innerHTML = `<p class="m-note">${esc(t('studentGone'))}</p>`; return; }
  view.innerHTML = `<div class="m-card m-hero m-student"><div class="m-kpis">
      <div><div class="l">${esc(t('totalHours'))}</div><div class="v">${formatHours(d.totalMinutes).replace(/ (h|min)/g, '<small> $1</small>')}</div></div>
      <div><div class="l">${esc(t('lessons'))}</div><div class="v">${d.lessonCount}</div></div>
      <div><div class="l">${esc(t('avgLesson'))}</div><div class="v">${formatHours(d.averageMinutes)}</div></div>
      ${rateCents != null ? `<div><div class="l">${esc(t('earnings'))}</div><div class="v">${moneyHtml(earningsCents(d.totalMinutes, rateCents), 'gold')}</div></div>` : ''}
    </div><p class="m-note">${esc(t('firstLast', shortDate(d.firstLesson), shortDate(d.lastLesson)))}</p>
    ${rateCents != null ? `<div class="row"><button class="btn small" data-eye>${esc(state.showMoney ? t('hideMoney') : t('showMoney'))}</button></div>` : ''}</div>
    <div class="m-card"><h2>${esc(t('lastSixMonths'))}</h2><div class="m-chart" data-c="six"></div></div>
    <div class="m-card"><div class="m-kpis">
      <div><div class="l">${esc(t('thisSeasonLabel', seasonLabel(d.season)))}</div><div class="v">${formatHours(d.thisSeasonMinutes)}</div></div>
      <div><div class="l">${esc(t('lastSeason'))}</div><div class="v">${formatHours(d.lastSeasonMinutes)}</div></div></div></div>
    ${d.months.map(m => `<div class="m-month"><span>${esc(monthTitle(m.month))}</span><span>${formatHours(m.minutes)}</span></div>
      ${m.lessons.map(l => `<button class="m-row" data-id="${l.id}"><span class="who">${esc(dayTitle(l.date))}</span><span class="dur">${formatHours(l.durationMinutes)}</span>
        ${l.notes ? `<span class="note">${esc(l.notes)}</span>` : ''}</button>`).join('')}`).join('')}`;
  view.querySelector('[data-eye]')?.addEventListener('click', actions.toggleMoney);
  view.onclick = e => { const b = e.target.closest('.m-row'); if (b) actions.edit(lessons.find(l => l.id === Number(b.dataset.id))); };
  areaChart(view.querySelector('[data-c="six"]'), d.lastSixMonths, monthOf(today()), { setView: () => {} });
  paintMoney(state.showMoney, view);
}

/** The in-app unlock moment: rays, the badge popping in, then its name. */
export function openBadgeUnlock(badge, onSeeAll) {
  const { el, close } = openSheet(`<div class="m-start m-unlock"><div class="burst" aria-hidden="true"></div>${badgeSvg(badge, 160, 'pop')}
    <small class="up" style="--d:500ms">${esc(t('badgeUnlocked'))}</small><h3 class="up" style="--d:600ms">${esc(t('badge_' + badge.id))}</h3>
    <p class="up" style="--d:700ms">${esc(t('badgeUnlockedAt', formatHours(badge.minutes)))}</p>
    <div class="btns"><button class="btn" data-all>${esc(t('badgeSeeAll'))}</button><button class="btn primary" data-ok>${esc(t('badgeOk'))}</button></div></div>`);
  el.querySelector('[data-ok]').onclick = close;
  el.querySelector('[data-all]').onclick = () => { close(); onSeeAll(); };
}

/** The first open in a new season: a hello and last season in one line (see domain seasonWelcome). */
export function openSeasonWelcome(w) {
  const { el, close } = openSheet(`<div class="m-start">${KEVIN}<h3>${esc(t('seasonWelcomeTitle', seasonLabel(w.season)))}</h3>
    <p>${esc(t('seasonWelcomeBody'))}</p>
    ${w.lessonCount ? `<p>${esc(t('seasonWelcomeLast', seasonLabel(w.last), formatHours(w.minutes), tn('lessonCount', w.lessonCount), tn('studentCount', w.students)))}</p>` : ''}
    ${w.unpaidMonths ? `<p class="gold">${esc(tn('seasonUnpaid', w.unpaidMonths, seasonLabel(w.last)))}</p>` : ''}
    <div class="btns"><button class="btn primary" data-ok>OK</button></div></div>`);
  el.querySelector('[data-ok]').onclick = close;
}
