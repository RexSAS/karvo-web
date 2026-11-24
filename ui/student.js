// One student's window (as Android StudentScreen): totals, the last 6 months, this season against the last, all their lessons.
import { studentDetail } from '../domain/stats.js';
import { seasonLabel } from '../domain/seasons.js';
import { payOf } from '../domain/rates.js';
import { formatHours, today, todayIn } from '../domain/dates.js';
import { moneyHtml, paintMoney } from './money.js';
import { areaChart } from './stats.js';
import { esc } from './html.js';

const day = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(d + 'T12:00').toLocaleDateString('en', o);
const monthTitle = m => new Date(m + '-15').toLocaleString('en', { month: 'long', year: 'numeric' });

export function openStudent(key, { snapshot, showMoney }, actions) {
  const s = studentDetail(snapshot.lessons, key, snapshot.timeZoneId ? todayIn(snapshot.timeZoneId) : today(), snapshot.seasonStartMonth);
  if (!s) return;
  const d = document.createElement('dialog');
  d.className = 'wide';
  const fig = (v, l) => `<div><div class="v">${v}</div><div class="sub">${l}</div></div>`;
  d.innerHTML = `<form method="dialog"><h3>${esc(s.name)}</h3>
    <div class="st-figs">${fig(formatHours(s.totalMinutes), 'Total hours')}${fig(s.lessonCount, 'Lessons')}${fig(formatHours(s.averageMinutes), 'Average lesson')}
      ${fig(moneyHtml(payOf(snapshot).earnings(s.months.flatMap(m => m.lessons)), 'gold'), 'Earnings')}</div>
    <div class="sub">First lesson ${day(s.firstLesson)} · last ${day(s.lastLesson)}</div>
    <h4>Last 6 months</h4><div class="chart" data-c="six"></div>
    <div class="st-figs">${fig(formatHours(s.thisSeasonMinutes), `This season · ${seasonLabel(s.season)}`)}${fig(formatHours(s.lastSeasonMinutes), 'Last season')}</div>
    <div class="st-months">${s.months.map(m => `<div class="day-h st-mh"><b>${monthTitle(m.month)}</b><span>${formatHours(m.minutes)}</span></div>
      ${m.lessons.map(l => `<button type="button" class="lesson" data-id="${l.id}"><span>${day(l.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span class="dur">${formatHours(l.durationMinutes)}</span>${l.notes ? `<span class="note">${esc(l.notes)}</span>` : ''}</button>`).join('')}`).join('')}</div>
    <div class="btns"><button class="btn">Close</button></div></form>`;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  paintMoney(showMoney, d);
  d.showModal();
  // The chart measures its box, so it is drawn once the window is open; a month or a lesson leaves the window for it.
  areaChart(d.querySelector('[data-c="six"]'), s.lastSixMonths, null, { setView: m => { d.close(); actions.setView(m); } });
  d.querySelector('.st-months').onclick = e => {
    const b = e.target.closest('.lesson');
    if (b) { d.close(); actions.edit(snapshot.lessons.find(l => l.id === Number(b.dataset.id))); }
  };
}
