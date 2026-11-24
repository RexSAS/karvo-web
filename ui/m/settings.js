// Settings tab: rates, season start, language, backup (Back up now / Import CSV), Linked PCs, privacy, version.
import { ratesListHtml, wireRates } from '../rates.js';
import { reminderState } from './backup.js';
import { renderLinks } from './links.js';
import { pickTextFile } from '../files.js';
import { esc } from '../html.js';
import { reportFormHtml, wireReport, showMyReports } from '../report.js';
import { openSheet } from './sheet.js';
import { t, getLang, locale } from './i18n.js';

export const APP_VERSION = 'web-8';
const PRIVACY_URL = 'https://github.com/RexSAS/Karvo/blob/main/PRIVACY.md';

export function renderSettings(view, state, actions) {
  const { seasonStartMonth, lessons } = state.snapshot;
  const r = reminderState(state.meta, new Date(), lessons.length > 0);
  const last = [state.meta.lastBackupAt, state.meta.lastPcSyncAt].filter(Boolean).sort().pop();
  const months = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 15).toLocaleString(locale(), { month: 'long' }));
  view.innerHTML = `
    <div class="m-card" data-rates>${ratesListHtml(state.snapshot, t)}</div>
    <div class="m-card">
      <label class="m-field" for="ms-season">${esc(t('seasonStart'))}</label>
      <select class="m-input" id="ms-season">${months.map((m, i) => `<option value="${i + 1}" ${i + 1 === seasonStartMonth ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
      <label class="m-field" for="ms-lang">${esc(t('language'))}</label>
      <select class="m-input" id="ms-lang"><option value="en" ${getLang() === 'en' ? 'selected' : ''}>English</option><option value="it" ${getLang() === 'it' ? 'selected' : ''}>Italiano</option></select>
    </div>
    <div class="m-card"><h2>${esc(t('backup'))}</h2>
      <div>${esc(last ? t('lastBackup', r.days) : t('lastBackupNever'))}</div>
      <p class="m-note">${esc(t('backupHint'))}</p>
      <div class="row"><button class="btn primary" data-backup>${esc(t('backupNow'))}</button><button class="btn" data-import>${esc(t('importCsv'))}</button></div>
      <div class="${state.flash?.err ? 'm-err' : 'm-ok'}" data-msg role="status">${esc(state.flash?.text ?? '')}</div>
    </div>
    <div class="m-card" data-links></div>
    <div class="m-card"><div class="row"><button class="btn" data-report>${esc(t('reportProblem'))}</button><button class="btn" data-my-reports>${esc(t('myReports'))}</button></div>
      <p class="m-note">${esc(t('reportProblemHint'))}</p></div>
    <div class="m-card"><button class="btn" data-tour>${esc(t('tourAgain'))}</button>
      <div class="m-about"><a class="m-link" href="${PRIVACY_URL}" target="_blank" rel="noopener">${esc(t('privacy'))}</a>
      <span class="m-note">${esc(t('version', APP_VERSION))}</span></div></div>`;
  const $ = q => view.querySelector(q);
  wireRates($('[data-rates]'), { getSnapshot: () => state.snapshot, source: state.source, t, open: openSheet, onError: () => actions.flash(t('saveFailed'), true) });
  $('#ms-season').onchange = e => state.source.setSeasonStart(Number(e.target.value)).catch(() => actions.flash(t('saveFailed'), true));
  $('#ms-lang').onchange = e => actions.setLang(e.target.value);
  $('[data-backup]').onclick = async () => { if (await actions.backupNow()) actions.flash(t('backupDone')); };
  $('[data-import]').onclick = async () => {
    const text = await pickTextFile();
    if (text == null) return;
    try { const { added, skipped } = await state.source.importCsv(text); actions.flash(t('imported', added, skipped)); }
    catch (e) { actions.flash(e.message, true); }
  };
  $('[data-tour]').onclick = () => actions.tour();
  $('[data-report]').onclick = () => { const s = openSheet(reportFormHtml(t)); wireReport(s.el, t, `${APP_VERSION} iPhone`, s.close); };
  $('[data-my-reports]').onclick = () => { const s = openSheet('<form novalidate></form>'); showMyReports(s.el, t, s.close); };
  renderLinks($('[data-links]'), state, actions);
}
