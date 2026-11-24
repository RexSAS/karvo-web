// A printable statement of what the Lessons card shows (the month, or a search like one student's unpaid lessons).
// Filled just before printing, so the browser's own Ctrl+P prints it too; styles.css shows only #print on paper.
import { formatHours, today } from '../domain/dates.js';
import { formatEuro } from '../domain/earnings.js';
import { payOf } from '../domain/rates.js';
import { esc } from './html.js';
import { shownLessons, isFiltering } from './lessons.js';

const day = d => new Date(d + 'T12:00').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const dayRow = (d, year) => new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: year ? 'numeric' : undefined });
const monthTitle = m => new Date(m + '-15').toLocaleString('en', { month: 'long', year: 'numeric' });
// The carved peak in flat colours: the page's gradient defs are hidden on paper.
const LOGO = `<svg class="logo" viewBox="18 24.5 72 54" aria-hidden="true"><circle cx="33.5" cy="41" r="6.2" fill="#E0A23C"/><path d="M65.07,46.88 L83,75 L63.5,75 C55.5,68.5 54,62.5 60.5,56.5 C63.77,53.45 65.23,50.21 65.07,46.88 Z" fill="#5B8DDC"/><path d="M25,75 L53,28 C61.5,39 62.5,47.5 55,54.5 C48,61 49.5,68 57,75 Z" fill="#1B2550"/></svg>`;

export function statementHtml(state) {
  const ls = shownLessons(state).reverse(); // oldest first, as on a bill
  const pay = payOf(state.snapshot), sum = xs => xs.reduce((s, l) => s + l.durationMinutes, 0);
  // The rates these lessons use, for the Total line ("€30 per hour", or each rate by name when there are several).
  const used = [...new Set(ls.map(l => pay.rateOf(l)))].filter(Boolean);
  const rateNote = used.length === 1 ? `${formatEuro(used[0].cents)} per hour` : used.map(r => `${esc(r.title)} ${formatEuro(r.cents)}/h`).join(' · ');
  const multiYear = ls.length > 0 && ls[0].date.slice(0, 4) !== ls.at(-1).date.slice(0, 4);
  const minutes = sum(ls), unpaidLs = ls.filter(l => !l.paidOn), unpaid = sum(unpaidLs), withRate = pay.isSet;
  const what = isFiltering(state)
    ? [state.search.trim() && `“${state.search.trim()}”`, state.paidFilter === false && 'not paid', state.paidFilter === true && 'paid'].filter(Boolean).join(' · ')
    : monthTitle(state.view);
  const money = cents => cents == null ? '' : `<td class="num">${formatEuro(cents)}</td>`;
  const kpi = (label, value, cls = '') => `<div class="kpi ${cls}"><div class="l">${label}</div><div class="v">${value}</div></div>`;
  return `<div class="st-head">${LOGO}<div class="brand">Karvo<small>Ski lesson hours</small></div>
      <div class="doc"><h1>Lesson statement</h1><div>${esc(what)}</div>${ls.length ? `<div class="sub">${day(ls[0].date)} – ${day(ls.at(-1).date)}</div>` : ''}</div></div>
    <div class="kpis">${kpi('Lessons', ls.length)}${kpi('Hours', formatHours(minutes))}${withRate ? kpi('Amount', formatEuro(pay.earnings(ls)), 'main') : ''}${withRate && unpaid ? kpi('Not paid yet', formatEuro(pay.earnings(unpaidLs)), 'owed') : ''}</div>
    <table><thead><tr><th>Date</th><th>Student</th><th class="num">Hours</th>${withRate ? '<th class="num">Amount</th>' : ''}<th>Payment</th></tr></thead>
    <tbody>${ls.map((l, i) => {
      const first = !i || l.date !== ls[i - 1].date; // the date only on a day's first lesson
      return `<tr${i && first ? ' class="newday"' : ''}><td class="date">${first ? dayRow(l.date, multiYear) : ''}</td><td>${esc(l.student)}</td><td class="num">${formatHours(l.durationMinutes)}</td>${money(pay.earnings([l]))}<td class="pay">${l.paidOn ? `Paid ${day(l.paidOn)}` : '<span class="due">Not paid</span>'}</td></tr>`;
    }).join('')}
    <tr class="total"><td colspan="2">Total${withRate && rateNote ? `<span class="rate">${rateNote}</span>` : ''}</td><td class="num">${formatHours(minutes)}</td>${money(pay.earnings(ls))}<td></td></tr></tbody></table>
    <div class="st-foot"><span>Printed ${day(today())}</span><span>karvo.rxsas.it</span></div>`;
}

export function fillStatementOnPrint(getState) {
  const el = document.getElementById('print');
  addEventListener('beforeprint', () => { el.innerHTML = statementHtml(getState()); });
}
