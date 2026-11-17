// A printable statement of what the Lessons card shows (the month, or a search like one student's unpaid lessons).
// Filled just before printing, so the browser's own Ctrl+P prints it too; styles.css shows only #print on paper.
import { formatHours, today } from '../domain/dates.js';
import { earningsCents, formatEuro } from '../domain/earnings.js';
import { esc } from './html.js';
import { shownLessons, isFiltering } from './lessons.js';

const day = d => new Date(d + 'T12:00').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const monthTitle = m => new Date(m + '-15').toLocaleString('en', { month: 'long', year: 'numeric' });

export function statementHtml(state) {
  const ls = shownLessons(state).reverse(); // oldest first, as on a bill
  const { rateCents } = state.snapshot, minutes = ls.reduce((s, l) => s + l.durationMinutes, 0);
  const what = isFiltering(state)
    ? [state.search.trim() && `“${state.search.trim()}”`, state.paidFilter === false && 'not paid', state.paidFilter === true && 'paid'].filter(Boolean).join(' · ')
    : monthTitle(state.view);
  const money = cents => cents == null ? '' : `<td class="num">${formatEuro(cents)}</td>`;
  return `<h1>Karvo · Lesson statement</h1><p class="sub">${esc(what)}${ls.length ? ` · ${day(ls[0].date)} – ${day(ls.at(-1).date)}` : ''}</p>
    <table><thead><tr><th>Date</th><th>Student</th><th class="num">Hours</th>${rateCents == null ? '' : '<th class="num">Amount</th>'}<th>Paid</th></tr></thead>
    <tbody>${ls.map(l => `<tr><td>${day(l.date)}</td><td>${esc(l.student)}</td><td class="num">${formatHours(l.durationMinutes)}</td>${money(earningsCents(l.durationMinutes, rateCents))}<td>${l.paidOn ? day(l.paidOn) : '—'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2">${ls.length} lessons${rateCents == null ? '' : ` · rate ${formatEuro(rateCents)}/h`}</td><td class="num">${formatHours(minutes)}</td>${money(earningsCents(minutes, rateCents))}<td></td></tr></tfoot></table>
    <p class="sub">Printed ${day(today())}</p>`;
}

export function fillStatementOnPrint(getState) {
  const el = document.getElementById('print');
  addEventListener('beforeprint', () => { el.innerHTML = statementHtml(getState()); });
}
