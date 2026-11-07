// Right column: the selected month's hours, money and payment, plus everything still unpaid.
import { earningsCents } from '../domain/earnings.js';
import { formatHours, monthOf, today, todayIn, addMonths } from '../domain/dates.js';
import { paidStatus, monthPaidOn, unpaidTotals } from '../domain/paid.js';
import { students } from '../domain/stats.js';
import { moneyHtml } from './money.js';
import { READ_ONLY_TIP } from './lessons.js';

const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/></svg>';
const monthName = (m, opts = { month: 'long', year: 'numeric' }) => new Date(m + '-15').toLocaleString('en', opts);
const sum = ls => ls.reduce((s, l) => s + l.durationMinutes, 0);

export function renderOverview(el, { snapshot, view, showMoney, source }, actions) {
  const { lessons, rateCents } = snapshot, inMonth = lessons.filter(l => monthOf(l.date) === view);
  const minutes = sum(inMonth), unpaid = unpaidTotals(lessons, snapshot.timeZoneId ? todayIn(snapshot.timeZoneId) : today(), rateCents);
  const ro = source.canEdit ? '' : `disabled title="${READ_ONLY_TIP}"`;
  // The school pays a month after it ends, so the pay button sits on the month before the selected one.
  const prev = addMonths(view, -1), inPrev = lessons.filter(l => monthOf(l.date) === prev);
  const status = ls => {
    if (!ls.length) return '<span class="sub">No lessons</span>';
    const st = paidStatus(ls);
    return st === 'PAID' ? `<span>✓ Paid ${new Date(monthPaidOn(ls) + 'T12:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>`
      : `<span><span class="gold">${st === 'PARTLY_PAID' ? 'Partly paid' : 'Unpaid'} · </span>${moneyHtml(earningsCents(sum(ls.filter(l => !l.paidOn)), rateCents), 'gold')}</span>`;
  };
  const payBtn = !inPrev.length ? '' : paidStatus(inPrev) === 'PAID'
    ? `<button class="btn small" data-unpay ${ro}>Mark unpaid</button>`
    : `<button class="btn small gold" data-pay ${ro}>Mark paid</button>`;
  el.innerHTML = `<h2>Overview · ${monthName(view, { month: 'short', year: 'numeric' })}</h2>
    <div class="scroll">
      <div class="kpi"><div class="l">Hours</div><div class="v">${formatHours(minutes)}</div></div>
      <div class="kpi"><div class="l">Earned</div><div class="row"><span class="v">${moneyHtml(earningsCents(minutes, rateCents))}</span>
        <button class="icon-btn" data-eye aria-pressed="${showMoney}" aria-label="${showMoney ? 'Hide' : 'Show'} money" title="${showMoney ? 'Hide' : 'Show'} money">${showMoney ? EYE_OFF : EYE}</button></div></div>
      <div class="kpi"><div class="l">This month</div><div class="row">${status(inMonth)}</div></div>
      <div class="kpi"><div class="l">Last month · ${monthName(prev, { month: 'long' })}</div><div class="row">${status(inPrev)}${payBtn}</div></div>
      <div class="kpi"><div class="l">Lessons</div><div class="v">${inMonth.length}</div><div class="sub">${students(inMonth).length} students</div></div>
      <div class="kpi"><div class="l">Unpaid</div><div class="v">${moneyHtml(unpaid.earningsCents, 'gold')}</div>
        <div class="sub">${unpaid.months ? `${unpaid.months} month${unpaid.months > 1 ? 's' : ''} · ${formatHours(unpaid.minutes)}` : 'All paid'}</div>
        ${unpaid.byMonth.map(m => `<button class="um" data-m="${m.month}"><span>${monthName(m.month)}</span>${moneyHtml(m.earningsCents)}</button>`).join('')}</div>
    </div>`;
  el.querySelector('[data-eye]').onclick = actions.toggleMoney;
  el.querySelector('[data-pay]')?.addEventListener('click', () => askPaidDate(prev, d => source.markPaid(prev, d)));
  el.querySelector('[data-unpay]')?.addEventListener('click', () => { if (confirm(`Mark ${monthName(prev)} as unpaid?`)) source.markUnpaid(prev); });
  el.querySelectorAll('.um').forEach(b => b.onclick = () => actions.setView(b.dataset.m));
}

function askPaidDate(month, onOk) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog"><h3>Mark ${monthName(month)} as paid</h3>
    <label for="p-date">Paid on</label><input type="date" id="p-date" required value="${today()}">
    <div class="btns"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn gold">Mark paid</button></div></form>`;
  document.body.append(d);
  const close = () => { d.close(); d.remove(); };
  d.querySelector('[data-cancel]').onclick = close;
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  d.querySelector('form').onsubmit = e => { e.preventDefault(); const v = d.querySelector('#p-date').value; if (v) { onOk(v); close(); } };
  d.showModal();
}
