// Lessons of the selected month, newest first, grouped by day. With a search or a paid filter: every match, grouped by month.
import { formatHours, monthOf } from '../domain/dates.js';
import { filterLessons } from '../domain/stats.js';
import { esc } from './html.js';
import { eventsOn } from '../domain/events.js';

export const READ_ONLY_TIP = 'Link your phone to edit';
const dayTitle = d => new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
const monthTitle = m => new Date(m + '-15').toLocaleString('en', { month: 'long', year: 'numeric' });
const sum = ls => ls.reduce((s, l) => s + l.durationMinutes, 0);
const newestFirst = (a, b) => b.date.localeCompare(a.date) || a.id - b.id;

export const isFiltering = ({ search, paidFilter }) => !!search.trim() || paidFilter != null;

/** What the Lessons card shows (and what Print prints): the month, or every match of the search and filter. */
export const shownLessons = state => (isFiltering(state)
  ? filterLessons(state.snapshot.lessons, state.search, state.paidFilter)
  : state.snapshot.lessons.filter(l => monthOf(l.date) === state.view)).sort(newestFirst);

const row = (l, when = '') => `<button class="lesson" data-id="${l.id}">
  <span>${esc(l.student)}</span><span class="dur">${formatHours(l.durationMinutes)}</span>
  ${when || l.notes ? `<span class="note">${esc([when, l.notes].filter(Boolean).join(' · '))}</span>` : ''}</button>`;

export function renderLessons(el, state, actions) {
  const { snapshot, view, selDay, source, paidFilter } = state;
  const filtering = isFiltering(state), shown = shownLessons(state);
  const keys = [...new Set(shown.map(l => filtering ? monthOf(l.date) : l.date))];
  const month = new Date(view + '-15').toLocaleString('en', { month: 'long' });
  const ro = source.canEdit ? '' : `disabled title="${READ_ONLY_TIP}"`;
  const evs = selDay && !filtering ? eventsOn(snapshot.events, selDay) : [];
  const eventsPanel = selDay && !filtering ? `<div class="day-events"><div class="de-head"><b>${dayTitle(selDay)}</b><button class="btn small" data-event-new ${ro}>+ Event</button></div>
    ${evs.map(e => `<button class="de-row" data-event="${e.id}" ${ro}><span>${esc(e.text)}</span><span class="sub">Edit</span></button>`).join('')}</div>` : '';
  const chip = (v, label) => `<button class="chip" data-paid="${v}" aria-pressed="${paidFilter === v}">${label}</button>`;
  const typing = document.activeElement?.id === 'l-search';
  el.innerHTML = `<div class="l-head"><h2>Lessons · ${filtering ? `${shown.length} found` : month}</h2>
      <button class="icon-btn small" data-print title="Print statement (Ctrl+P)" aria-label="Print statement">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button></div>
    <input id="l-search" type="search" placeholder="Search students and notes  ( / )" aria-label="Search lessons" value="${esc(state.search)}">
    <div class="chips">${chip(false, 'Not paid')}${chip(true, 'Paid')}</div>${eventsPanel}
    <div class="scroll" id="lesson-list">${keys.length ? keys.map(k => {
      const ls = shown.filter(l => (filtering ? monthOf(l.date) : l.date) === k);
      return filtering
        ? `<div class="day"><div class="day-h">${monthTitle(k)} · ${formatHours(sum(ls))}</div>${ls.map(l => row(l, dayTitle(l.date))).join('')}</div>`
        : `<div class="day ${k === selDay ? 'sel' : ''}" data-d="${k}"><div class="day-h">${dayTitle(k)}</div>${ls.map(l => row(l)).join('')}</div>`;
    }).join('') : `<div class="empty">${filtering ? 'No matching lessons.' : 'No lessons this month.'}</div>`}</div>
    <button class="add" ${source.canEdit ? 'title="Add lesson (N)"' : `disabled title="${READ_ONLY_TIP}"`}>+ Add lesson</button>`;
  const input = el.querySelector('#l-search');
  if (typing) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  input.oninput = () => actions.setSearch(input.value);
  input.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); actions.setSearch(''); el.querySelector('#l-search').blur(); } };
  el.querySelectorAll('[data-paid]').forEach(b => b.onclick = () => {
    const v = b.dataset.paid === 'true';
    actions.setPaidFilter(paidFilter === v ? null : v);
  });
  el.querySelector('[data-print]').onclick = () => print();
  el.querySelector('.add').onclick = actions.add;
  el.querySelector('[data-event-new]')?.addEventListener('click', () => actions.editEvent(selDay));
  el.querySelectorAll('[data-event]').forEach(b => b.onclick = () => actions.editEvent(selDay, Number(b.dataset.event)));
  el.querySelector('#lesson-list').onclick = e => {
    const b = e.target.closest('.lesson');
    if (b) actions.edit(snapshot.lessons.find(l => l.id === Number(b.dataset.id)));
  };
  if (!filtering) el.querySelector(`.day[data-d="${selDay}"]`)?.scrollIntoView({ block: 'nearest' });
}
