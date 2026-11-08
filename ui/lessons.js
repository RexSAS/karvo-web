// Lessons of the selected month, newest first, grouped by day.
import { formatHours, monthOf } from '../domain/dates.js';
import { esc } from './html.js';

export const READ_ONLY_TIP = 'Link your phone to edit';
const dayTitle = d => new Date(d + 'T12:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });

export function renderLessons(el, { snapshot, view, selDay, source }, actions) {
  const inMonth = snapshot.lessons.filter(l => monthOf(l.date) === view)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id - b.id);
  const days = [...new Set(inMonth.map(l => l.date))];
  const month = new Date(view + '-15').toLocaleString('en', { month: 'long' });
  const note = selDay ? snapshot.dayNotes?.[selDay] : null;
  const ro = source.canEdit ? '' : `disabled title="${READ_ONLY_TIP}"`;
  const notePanel = selDay ? `<div class="day-note">${note
    ? `<span class="dn-text"><b>${dayTitle(selDay)}</b> · ${esc(note)}</span><button class="btn small" data-note ${ro}>Edit</button>`
    : `<span class="dn-text sub">${dayTitle(selDay)}</span><button class="btn small" data-note ${ro}>+ Add note</button>`}</div>` : '';
  el.innerHTML = `<h2>Lessons · ${month}</h2>${notePanel}
    <div class="scroll" id="lesson-list">${days.length ? days.map(d => `<div class="day ${d === selDay ? 'sel' : ''}" data-d="${d}">
      <div class="day-h">${dayTitle(d)}</div>
      ${inMonth.filter(l => l.date === d).map(l => `<button class="lesson" data-id="${l.id}">
        <span>${esc(l.student)}</span><span class="dur">${formatHours(l.durationMinutes)}</span>
        ${l.notes ? `<span class="note">${esc(l.notes)}</span>` : ''}</button>`).join('')}
    </div>`).join('') : '<div class="empty">No lessons this month.</div>'}</div>
    <button class="add" ${source.canEdit ? '' : `disabled title="${READ_ONLY_TIP}"`}>+ Add lesson</button>`;
  el.querySelector('.add').onclick = actions.add;
  el.querySelector('[data-note]')?.addEventListener('click', () => actions.editNote(selDay));
  el.querySelector('#lesson-list').onclick = e => {
    const b = e.target.closest('.lesson');
    if (b) actions.edit(snapshot.lessons.find(l => l.id === Number(b.dataset.id)));
  };
  el.querySelector(`.day[data-d="${selDay}"]`)?.scrollIntoView({ block: 'nearest' });
}
