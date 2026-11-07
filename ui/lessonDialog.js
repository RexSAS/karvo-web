// Add / edit / delete one lesson. Read-only sources open it with every input disabled.
import { validateLesson } from '../domain/validate.js';
import { esc } from './html.js';
import { READ_ONLY_TIP } from './lessons.js';

const MESSAGES = { StudentBlank: 'Enter a student', DurationZero: "Duration can't be 0", DurationTooLong: 'Max 24 hours', MinutesOver59: 'Minutes must be 0–59' };

export function openLessonDialog({ lesson = null, defaultDate, studentNames, readOnly, onSave, onDelete }) {
  const d = document.createElement('dialog');
  const dis = readOnly ? 'disabled' : '';
  d.innerHTML = `<form method="dialog" novalidate>
    <h3>${lesson ? (readOnly ? 'Lesson' : 'Edit lesson') : 'New lesson'}</h3>
    <label for="l-date">Date</label><input type="date" id="l-date" required value="${esc(lesson?.date ?? defaultDate)}" ${dis}>
    <label for="l-student">Student</label><input id="l-student" list="l-students" autocomplete="off" value="${esc(lesson?.student ?? '')}" ${dis}>
    <datalist id="l-students">${studentNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="two">
      <div><label for="l-h">Hours</label><input type="number" id="l-h" min="0" max="24" value="${lesson ? Math.floor(lesson.durationMinutes / 60) : 1}" ${dis}></div>
      <div><label for="l-m">Minutes</label><input type="number" id="l-m" min="0" max="59" step="5" value="${lesson ? lesson.durationMinutes % 60 : 0}" ${dis}></div>
    </div>
    <label for="l-notes">Notes</label><textarea id="l-notes" ${dis}>${esc(lesson?.notes ?? '')}</textarea>
    <div class="err" role="alert"></div>
    <div class="btns">
      ${lesson && !readOnly ? '<button type="button" class="btn danger left" data-del>Delete</button>' : ''}
      ${readOnly ? `<span class="left sub" style="color:var(--muted);font-size:12px">${READ_ONLY_TIP}</span>` : ''}
      <button type="button" class="btn" data-cancel>${readOnly ? 'Close' : 'Cancel'}</button>
      ${readOnly ? '' : '<button class="btn primary">Save</button>'}
    </div></form>`;
  document.body.append(d);
  const $ = s => d.querySelector(s), err = $('.err');
  const close = () => { d.close(); d.remove(); };
  const run = async fn => { try { await fn(); close(); } catch (e) { err.textContent = e.message; } };
  $('[data-cancel]').onclick = close;
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('[data-del]')?.addEventListener('click', () => { if (confirm('Delete this lesson?')) run(() => onDelete(lesson.id)); });
  $('form').onsubmit = e => {
    e.preventDefault();
    if (readOnly) return;
    const student = $('#l-student').value, h = Number($('#l-h').value) || 0, m = Number($('#l-m').value) || 0, date = $('#l-date').value;
    const errors = validateLesson(student, h, m);
    if (!date) { err.textContent = 'Pick a date'; return; }
    if (errors.length) { err.textContent = errors.map(x => MESSAGES[x]).join(' · '); return; }
    run(() => onSave({ ...(lesson ?? { paidOn: null }), date, student: student.trim(), durationMinutes: h * 60 + m, notes: $('#l-notes').value.trim() || null }));
  };
  d.showModal();
  if (!readOnly) $('#l-student').focus();
  return d;
}
