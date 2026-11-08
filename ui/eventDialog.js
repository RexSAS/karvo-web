// Add / edit / delete one event on a day (PC). Read-only sources never open it (the buttons are disabled).
import { MAX_EVENT } from '../domain/events.js';
import { esc } from './html.js';

export function openEventDialog({ title, event = null, onSave, onDelete }) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog" novalidate><h3>${event ? 'Edit event' : 'New event'} · ${esc(title)}</h3>
    <label for="e-text">Shown on the calendar; the phone reminds you at 07:30 that day</label>
    <textarea id="e-text" maxlength="${MAX_EVENT}" rows="3" placeholder="e.g. Ski school meeting 17:00">${esc(event?.text ?? '')}</textarea>
    <div class="err" role="alert"></div>
    <div class="btns">${event ? '<button type="button" class="btn danger left" data-del>Delete</button>' : ''}
      <button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`;
  document.body.append(d);
  const $ = q => d.querySelector(q), close = () => { d.close(); d.remove(); };
  const run = async fn => { try { await fn(); close(); } catch (e) { $('.err').textContent = e.message; } };
  $('[data-cancel]').onclick = close;
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('[data-del]')?.addEventListener('click', () => { if (confirm('Delete this event?')) run(() => onDelete(event.id)); });
  $('form').onsubmit = e => {
    e.preventDefault();
    const text = $('#e-text').value.trim();
    if (!text) { $('.err').textContent = 'Write the event'; return; }
    run(() => onSave(text));
  };
  d.showModal();
  $('#e-text').focus();
}
