// Lessons tab: months newest first with their hours, search, and the add/edit/delete sheet.
import { formatHours, monthOf, today } from '../../domain/dates.js';
import { validateLesson, parseDurationField } from '../../domain/validate.js';
import { students } from '../../domain/stats.js';
import { upcomingDays, MAX_EVENT } from '../../domain/events.js';
import { esc } from '../html.js';
import { openSheet } from './sheet.js';
import { t, locale } from './i18n.js';

const monthTitle = m => new Date(m + '-15').toLocaleString(locale(), { month: 'long', year: 'numeric' });
const dayTitle = d => new Date(d + 'T12:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function renderLessons(view, { snapshot, search }, actions) {
  const q = search.trim().toLowerCase();
  const list = snapshot.lessons.filter(l => !q || l.student.toLowerCase().includes(q) || (l.notes ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const months = [...new Set(list.map(l => monthOf(l.date)))];
  const soon = upcomingDays(snapshot.events, today(), 3);
  const when = n => (n === 0 ? t('today') : n === 1 ? t('tomorrow') : t('inDays', n));
  const notesCard = q ? '' : `<div class="m-card m-notes"><div class="m-notes-head"><h2>${esc(t('events'))}</h2><button class="btn small" data-event-new>${esc(t('addEvent'))}</button></div>
    ${soon.length ? soon.map(d => d.events.map((e, i) => `<button class="m-note-row" data-event="${e.id}"><span class="d">${i ? '' : esc(when(d.inDays))}</span><span>${esc(e.text)}</span></button>`).join('')).join('')
      : `<p class="m-note">${esc(t('noEventsSoon'))}</p>`}</div>`;
  view.innerHTML = `<input class="m-search" type="search" placeholder="${esc(t('search'))}" value="${esc(search)}" aria-label="${esc(t('search'))}">${notesCard}
    ${months.length ? months.map(m => {
      const ls = list.filter(l => monthOf(l.date) === m);
      return `<div class="m-month"><span>${esc(monthTitle(m))}</span><span>${formatHours(ls.reduce((s, l) => s + l.durationMinutes, 0))}</span></div>
        ${ls.map(l => `<button class="m-row" data-id="${l.id}"><span class="who">${esc(l.student)}</span><span class="dur">${formatHours(l.durationMinutes)}</span>
          <span class="when">${esc(dayTitle(l.date))}</span>${l.notes ? `<span class="note">${esc(l.notes)}</span>` : ''}</button>`).join('')}`;
    }).join('') : `<div class="m-empty">${esc(t(snapshot.lessons.length ? 'noResults' : 'noLessons'))}</div>`}`;
  const input = view.querySelector('.m-search');
  input.oninput = () => actions.setSearch(input.value);
  view.onclick = e => {
    const n = e.target.closest('[data-event],[data-event-new]');
    if (n) return actions.editEvent(n.dataset.event ? Number(n.dataset.event) : null);
    const b = e.target.closest('.m-row'); if (b) actions.edit(snapshot.lessons.find(l => l.id === Number(b.dataset.id)));
  };
}

/** Add or edit one lesson; onSave/onDelete return promises (the sheet stays open with the error if they fail). */
export function openLessonSheet({ lesson = null, names, onSave, onDelete }) {
  const s = openSheet(`<form novalidate>
    <h3>${esc(t(lesson ? 'editLesson' : 'newLesson'))}</h3>
    <label for="ml-date">${esc(t('date'))}</label><input type="date" id="ml-date" value="${esc(lesson?.date ?? today())}">
    <label for="ml-student">${esc(t('student'))}</label><input id="ml-student" list="ml-names" autocomplete="off" autocapitalize="words" value="${esc(lesson?.student ?? '')}">
    <datalist id="ml-names">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="two">
      <div><label for="ml-h">${esc(t('hours'))}</label><input id="ml-h" type="number" inputmode="numeric" min="0" max="24" value="${lesson ? Math.floor(lesson.durationMinutes / 60) : 1}"></div>
      <div><label for="ml-m">${esc(t('minutes'))}</label><input id="ml-m" type="number" inputmode="numeric" min="0" max="59" step="5" value="${lesson ? lesson.durationMinutes % 60 : 0}"></div>
    </div>
    <label for="ml-notes">${esc(t('notes'))}</label><textarea id="ml-notes" rows="2">${esc(lesson?.notes ?? '')}</textarea>
    <div class="err" role="alert"></div>
    <div class="btns">
      ${lesson ? `<button type="button" class="btn danger" data-del>${esc(t('delete'))}</button>` : ''}
      <button type="button" class="btn" data-cancel>${esc(t('cancel'))}</button>
      <button class="btn primary">${esc(t('save'))}</button>
    </div></form>`);
  const $ = q => s.el.querySelector(q), err = $('.err');
  const run = async fn => { try { await fn(); s.close(); } catch (e) { err.textContent = e.message; } };
  $('[data-cancel]').onclick = s.close;
  $('[data-del]')?.addEventListener('click', () => { if (confirm(t('deleteConfirm'))) run(() => onDelete(lesson.id)); });
  $('form').onsubmit = e => {
    e.preventDefault();
    const student = $('#ml-student').value, h = parseDurationField($('#ml-h').value), m = parseDurationField($('#ml-m').value), date = $('#ml-date').value;
    if (Number.isNaN(h) || Number.isNaN(m)) { err.textContent = t('useWholeNumbers'); return; }
    const errors = validateLesson(student, h, m);
    if (!date) { err.textContent = t('pickDate'); return; }
    if (errors.length) { err.textContent = errors.map(x => t(x)).join(' · '); return; }
    run(() => onSave({ ...(lesson ?? { paidOn: null }), date, student: student.trim(), durationMinutes: h * 60 + m, notes: $('#ml-notes').value.trim() || null }));
  };
  return s;
}

/** Add (event = null) or edit one event. */
export function openEventSheet({ event = null, onSave, onDelete }) {
  const s = openSheet(`<form novalidate><h3>${esc(t(event ? 'editEvent' : 'newEvent'))}</h3>
    <label for="me-date">${esc(t('date'))}</label><input type="date" id="me-date" value="${esc(event?.date ?? today())}">
    <label for="me-text">${esc(t('event'))}</label><textarea id="me-text" rows="3" maxlength="${MAX_EVENT}" placeholder="${esc(t('eventPlaceholder'))}">${esc(event?.text ?? '')}</textarea>
    <p class="m-note">${esc(t('eventHint'))}</p>
    <div class="err" role="alert"></div>
    <div class="btns">${event ? `<button type="button" class="btn danger" data-del>${esc(t('delete'))}</button>` : ''}
      <button type="button" class="btn" data-cancel>${esc(t('cancel'))}</button><button class="btn primary">${esc(t('save'))}</button></div></form>`);
  const $ = q => s.el.querySelector(q);
  const run = async fn => { try { await fn(); s.close(); } catch (e) { $('.err').textContent = e.message; } };
  $('[data-cancel]').onclick = s.close;
  $('[data-del]')?.addEventListener('click', () => { if (confirm(t('deleteEventConfirm'))) run(() => onDelete(event.id)); });
  $('form').onsubmit = e => {
    e.preventDefault();
    const date = $('#me-date').value, text = $('#me-text').value.trim();
    if (!date) { $('.err').textContent = t('pickDate'); return; }
    if (!text) { $('.err').textContent = t('writeEvent'); return; }
    run(() => onSave({ date, text }));
  };
  return s;
}
