// Calendar (from the icon on Lessons): months with gold dots on event days and blue dots on lesson days;
// any day opens below the grid with its events (add, edit) and its lessons.
import { calendarDays, addMonths, monthOf, today, formatHours } from '../../domain/dates.js';
import { eventsOn } from '../../domain/events.js';
import { esc } from '../html.js';
import { t, locale } from './i18n.js';

const monthTitle = m => new Date(m + '-15').toLocaleString(locale(), { month: 'long', year: 'numeric' });
const dayTitle = d => new Date(d + 'T12:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
const weekdays = () => Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale(), { weekday: 'narrow' }));

/** `cal` is { month: 'YYYY-MM', day: 'YYYY-MM-DD' }; `actions.setCal(next)` moves it, `actions.editEvent(id, date)` opens the event sheet. */
export function renderCalendar(view, { snapshot, cal }, actions) {
  const now = today();
  const eventDays = new Set(snapshot.events.map(e => e.date));
  const lessonDays = new Set(snapshot.lessons.map(l => l.date));
  const evs = eventsOn(snapshot.events, cal.day);
  const ls = snapshot.lessons.filter(l => l.date === cal.day);
  view.innerHTML = `<div class="m-card m-cal">
      <div class="m-cal-head"><button class="m-cal-nav" data-m="-1" aria-label="‹">‹</button><strong>${esc(monthTitle(cal.month))}</strong><button class="m-cal-nav" data-m="1" aria-label="›">›</button></div>
      <div class="m-cal-grid">${weekdays().map(w => `<span class="wd">${esc(w)}</span>`).join('')}
        ${calendarDays(cal.month).map(d => `<button class="m-cal-day${monthOf(d) !== cal.month ? ' other' : ''}${d === now ? ' today' : ''}${d === cal.day ? ' sel' : ''}" data-day="${d}">
          <span>${Number(d.slice(8))}</span><i>${eventDays.has(d) ? '<b class="ev"></b>' : ''}${lessonDays.has(d) ? '<b class="ls"></b>' : ''}</i></button>`).join('')}</div>
    </div>
    <div class="m-card m-events" data-dayview>
      <div class="m-events-head"><h2>${esc(dayTitle(cal.day))}</h2><button class="btn small" data-event-new>${esc(t('addEvent'))}</button></div>
      ${evs.length ? evs.map(e => `<button class="m-event-row one" data-event="${e.id}"><span>${esc(e.text)}</span></button>`).join('') : `<p class="m-note">${esc(t('noEventsDay'))}</p>`}
      ${ls.length ? `<h2 class="m-cal-sub">${esc(t('lessons'))}</h2>${ls.map(l => `<div class="m-cal-lesson"><span>${esc(l.student)}</span><span>${formatHours(l.durationMinutes)}</span></div>`).join('')}` : ''}
    </div>`;
  view.onclick = e => {
    const nav = e.target.closest('[data-m]');
    if (nav) { const month = addMonths(cal.month, Number(nav.dataset.m)); return actions.setCal({ month, day: month === monthOf(now) ? now : month + '-01' }); }
    const d = e.target.closest('[data-day]');
    if (d) return actions.setCal({ month: monthOf(d.dataset.day), day: d.dataset.day });
    const ev = e.target.closest('[data-event],[data-event-new]');
    if (ev) actions.editEvent(ev.dataset.event ? Number(ev.dataset.event) : null, cal.day);
  };
}
