// Month grid: hours per day, tint by load, today ring, selection, and the month's paid badge.
import { calendarDays, formatHours, addMonths, monthOf, today } from '../domain/dates.js';
import { paidStatus } from '../domain/paid.js';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BADGE = { PAID: ['✓ Paid', ''], PARTLY_PAID: ['Partly paid', 'unpaid'], UNPAID: ['€ Unpaid', 'unpaid'] };
const monthTitle = month => new Date(month + '-15').toLocaleString('en', { month: 'long', year: 'numeric' });

export function renderCalendar(el, { snapshot, view, selDay }, actions) {
  const byDay = {};
  snapshot.lessons.forEach(l => { byDay[l.date] = (byDay[l.date] ?? 0) + l.durationMinutes; });
  const max = Math.max(1, ...Object.values(byDay)), now = today();
  const inMonth = snapshot.lessons.filter(l => monthOf(l.date) === view);
  const [badge, cls] = BADGE[paidStatus(inMonth)];
  el.innerHTML = `<div class="cal-head">
      <button data-go="-1" aria-label="Previous month">◀</button>
      <h3>${monthTitle(view)}</h3>
      <button data-go="1" aria-label="Next month">▶</button>
      <button class="pill" data-today>Today</button>
      ${inMonth.length ? `<span class="badge ${cls}">${badge}</span>` : ''}
    </div>
    <div class="cal-grid">${WD.map(w => `<div class="wd">${w}</div>`).join('')}${calendarDays(view).map(d => {
      const min = byDay[d] ?? 0;
      const c = ['cell', monthOf(d) !== view && 'other', d === now && 'today', d === selDay && 'sel', min && 'has'].filter(Boolean).join(' ');
      return `<button class="${c}" data-day="${d}" style="--load:${min / max}" aria-label="${d}${min ? ', ' + formatHours(min) : ''}">
        <span class="n">${Number(d.slice(8))}</span><span class="h">${min ? formatHours(min) : ''}</span></button>`;
    }).join('')}</div>`;
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => actions.setView(addMonths(view, Number(b.dataset.go))));
  el.querySelector('[data-today]').onclick = () => actions.selectDay(now);
  el.querySelector('.cal-grid').onclick = e => { const c = e.target.closest('.cell'); if (c) actions.selectDay(c.dataset.day); };
}
