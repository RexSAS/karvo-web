// Add / edit / delete the note of one day (PC). Read-only sources never open it (the button is disabled).
import { MAX_NOTE } from '../domain/notes.js';
import { esc } from './html.js';

export function openNoteDialog({ date, title, text = '', onSave }) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog" novalidate><h3>Note · ${esc(title)}</h3>
    <label for="n-text">Shown on the calendar; the phone reminds you at 07:30 that day</label>
    <textarea id="n-text" maxlength="${MAX_NOTE}" rows="3" placeholder="e.g. Ski school meeting 17:00">${esc(text)}</textarea>
    <div class="err" role="alert"></div>
    <div class="btns">${text ? '<button type="button" class="btn danger left" data-del>Delete</button>' : ''}
      <button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`;
  document.body.append(d);
  const $ = q => d.querySelector(q), close = () => { d.close(); d.remove(); };
  const run = async value => { try { await onSave(date, value); close(); } catch (e) { $('.err').textContent = e.message; } };
  $('[data-cancel]').onclick = close;
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('[data-del]')?.addEventListener('click', () => run(null));
  $('form').onsubmit = e => { e.preventDefault(); run($('#n-text').value); };
  d.showModal();
  $('#n-text').focus();
}
