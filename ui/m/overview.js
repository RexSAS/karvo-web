// Overview tab: the season's hours and money (with the eye), unpaid total, months with paid/unpaid, and the charts.
import { earningsCents } from '../../domain/earnings.js';
import { formatHours, monthOf, today } from '../../domain/dates.js';
import { paidStatus, monthPaidOn, unpaidTotals } from '../../domain/paid.js';
import { seasonOf, seasonLabel, seasonMonths } from '../../domain/seasons.js';
import { seasonStats } from '../../domain/stats.js';
import { moneyHtml, paintMoney } from '../money.js';
import { areaChart, donut, columns } from '../stats.js';
import { esc } from '../html.js';
import { openSheet } from './sheet.js';
import { t, locale } from './i18n.js';

let seasonShift = 0; // 0 = the current season; the arrows move it
const sum = ls => ls.reduce((s, l) => s + l.durationMinutes, 0);
const monthName = m => new Date(m + '-15').toLocaleString(locale(), { month: 'long', year: 'numeric' });

export function renderOverview(view, state, actions) {
  const { lessons, rateCents, seasonStartMonth } = state.snapshot;
  const now = seasonOf(today(), seasonStartMonth);
  const season = { ...now, startYear: now.startYear + seasonShift };
  const s = seasonStats(lessons, season), months = seasonMonths(season);
  const unpaid = unpaidTotals(lessons, today(), rateCents);
  const withLessons = months.filter(m => lessons.some(l => monthOf(l.date) === m)).reverse();
  const eye = state.showMoney ? t('hideMoney') : t('showMoney');
  view.innerHTML = `
    <div class="m-season"><button data-shift="-1" aria-label="◀">◀</button><strong>${esc(t('season', seasonLabel(season)))}</strong>
      <button data-shift="1" aria-label="▶" ${seasonShift >= 0 ? 'disabled' : ''}>▶</button></div>
    <div class="m-card"><div class="m-kpis">
      <div><div class="l">${esc(t('hours'))}</div><div class="v">${formatHours(s.minutes)}</div></div>
      <div><div class="l">${esc(t('earned'))}</div><div class="v">${moneyHtml(earningsCents(s.minutes, rateCents))}</div></div>
      <div><div class="l">${esc(t('lessons'))}</div><div class="v">${s.lessonCount}</div></div>
      <div><div class="l">${esc(t('unpaidTotal'))}</div><div class="v gold">${unpaid.minutes ? moneyHtml(unpaid.earningsCents, 'gold') : esc(t('allPaid'))}</div></div>
    </div><div class="row"><button class="btn small" data-eye>${esc(eye)}</button></div></div>
    <div class="m-card"><h2>${esc(t('months'))}</h2>${withLessons.length ? withLessons.map(m => {
      const ls = lessons.filter(l => monthOf(l.date) === m), st = paidStatus(ls), min = sum(ls);
      const status = st === 'PAID' ? t('paidOn', new Date(monthPaidOn(ls) + 'T12:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' }))
        : st === 'PARTLY_PAID' ? t('partlyPaid') : t('unpaid');
      return `<div class="m-mrow"><span class="name">${esc(monthName(m))}</span>
        <span class="act">${st === 'PAID' ? `<button class="btn small" data-unpay="${m}">${esc(t('markUnpaid'))}</button>`
          : `<button class="btn small gold" data-pay="${m}">${esc(t('markPaid'))}</button>`}</span>
        <span class="sub">${formatHours(min)} · ${moneyHtml(earningsCents(min, rateCents))} · <span class="${st === 'PAID' ? '' : 'gold'}">${esc(status)}</span></span></div>`;
    }).join('') : `<p class="m-note">${esc(t('noLessonsSeason'))}</p>`}</div>
    ${s.lessonCount ? `<div class="m-card"><h2>${esc(t('hoursPerMonth'))}</h2><div class="m-chart" data-c="month"></div></div>
    <div class="m-card"><h2>${esc(t('topStudents'))}</h2><div class="m-donut" data-c="donut"></div></div>
    <div class="m-card"><h2>${esc(t('busiestWeekdays'))}</h2><div class="m-chart" data-c="wd"></div></div>` : ''}`;
  view.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { seasonShift = Math.min(0, seasonShift + Number(b.dataset.shift)); actions.render(); });
  view.querySelector('[data-eye]').onclick = actions.toggleMoney;
  view.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => askPaidDate(b.dataset.pay, d => state.source.markPaid(b.dataset.pay, d)));
  view.querySelectorAll('[data-unpay]').forEach(b => b.onclick = () => {
    if (confirm(t('markUnpaidConfirm', monthName(b.dataset.unpay)))) state.source.markUnpaid(b.dataset.unpay);
  });
  if (s.lessonCount) {
    const cur = monthOf(today());
    areaChart(view.querySelector('[data-c="month"]'), s.perMonth, cur, { setView: () => {} });
    donut(view.querySelector('[data-c="donut"]'), s);
    columns(view.querySelector('[data-c="wd"]'), s.weekdayMinutes);
  }
  paintMoney(state.showMoney, view);
}

function askPaidDate(month, onOk) {
  const s = openSheet(`<form><h3>${esc(t('markPaid'))} · ${esc(monthName(month))}</h3>
    <label for="mp-date">${esc(t('paidDate'))}</label><input type="date" id="mp-date" value="${today()}">
    <div class="btns"><button type="button" class="btn" data-cancel>${esc(t('cancel'))}</button><button class="btn gold">${esc(t('markPaid'))}</button></div></form>`);
  s.el.querySelector('[data-cancel]').onclick = s.close;
  s.el.querySelector('form').onsubmit = e => { e.preventDefault(); const v = s.el.querySelector('#mp-date').value; if (v) { onOk(v); s.close(); } };
}
