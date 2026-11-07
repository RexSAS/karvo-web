// Starts the app: picks the data source, keeps UI state, and redraws every panel from each new snapshot.
import { createDemoSource } from './source/demo.js';
import { createBackupSource } from './source/backup.js';
import { openStore } from './source/idbStore.js';
import { emptySnapshot, createSource } from './source/core.js';
import { monthOf, today } from './domain/dates.js';
import { runSplash } from './ui/splash.js';
import { renderBanner } from './ui/banner.js';
import { renderEmpty } from './ui/empty.js';
import { paintMoney } from './ui/money.js';
import { pickTextFile } from './ui/files.js';
import { renderCalendar } from './ui/calendar.js';
import { renderLessons } from './ui/lessons.js';
import { openLessonDialog } from './ui/lessonDialog.js';
import { renderOverview } from './ui/overview.js';
import { renderStats } from './ui/stats.js';
import { openSettings } from './ui/settings.js';
import { students } from './domain/stats.js';

const $ = id => document.getElementById(id);
const state = { source: null, snapshot: emptySnapshot(), view: monthOf(today()), selDay: null, showMoney: false };

export const actions = {
  setView(month) { state.view = month; state.selDay = null; render(); },
  selectDay(date) { state.view = monthOf(date); state.selDay = date; render(); },
  toggleMoney() {
    state.showMoney = !state.showMoney;
    document.body.classList.add('reveal');
    render();
    setTimeout(() => document.body.classList.remove('reveal'), 300);
  },
  add() {
    openLessonDialog({ defaultDate: state.selDay ?? (state.view === monthOf(today()) ? today() : state.view + '-01'),
      studentNames: students(state.snapshot.lessons).map(s => s.name), readOnly: false,
      onSave: async l => { await state.source.addLesson(l); actions.selectDay(l.date); } });
  },
  edit(lesson) {
    openLessonDialog({ lesson, studentNames: students(state.snapshot.lessons).map(s => s.name), readOnly: !state.source.canEdit,
      onSave: l => state.source.updateLesson(l), onDelete: id => state.source.deleteLesson(id) });
  },
  async importCsv() {
    const text = await pickTextFile();
    if (text == null) return null;
    return state.source.importCsv(text);
  },
};

const panels = [['lessons', renderLessons], ['calendar', renderCalendar], ['overview', renderOverview], ['stats', renderStats]]; // [element id, render(el, state, actions)]

function render() {
  const { source, snapshot } = state;
  renderBanner($('banner'), { status: source.status, syncedAt: snapshot.syncedAt, storageError: source.storageError });
  const empty = source.status === 'backup' && snapshot.lessons.length === 0;
  $('empty').hidden = !empty;
  $('app').hidden = empty;
  if (empty) renderEmpty($('empty'), { importCsv: () => actions.importCsv().catch(e => alert(e.message)) });
  else panels.forEach(([id, fn]) => fn($(id), state, actions));
  paintMoney(state.showMoney);
}

async function chooseSource() {
  if (new URLSearchParams(location.search).has('demo')) return createDemoSource();
  try { return await createBackupSource(await openStore()); }
  catch {
    const src = createSource({ status: 'backup', canEdit: false, initial: emptySnapshot() });
    src.storageError = true;
    return src;
  }
}

runSplash();
state.source = await chooseSource();
state.source.subscribe(snapshot => { state.snapshot = snapshot; render(); });
addEventListener('resize', render);
$('settings-btn').onclick = () => openSettings(state.source, () => state.snapshot);

// Tooltips for anything with data-tip (chart marks).
const tip = $('tip');
document.addEventListener('mousemove', e => {
  const t = e.target.closest?.('[data-tip]');
  if (!t) { tip.style.display = 'none'; return; }
  tip.textContent = t.dataset.tip;
  Object.assign(tip.style, { display: 'block', left: e.clientX + 12 + 'px', top: e.clientY + 12 + 'px' });
});
