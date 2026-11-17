// "Report a problem" form (iPhone sheet and PC dialog): sent to the relay, which opens a GitHub issue on RexSAS/Karvo.
// If sending fails (offline, limit reached), "Send by email instead" still works.
import { esc, reportMailto } from './html.js';

const ENDPOINT = 'https://link.rxsas.it/report';

export async function sendReport(report) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).number;
}

/** t: text lookup (the iPhone's t, or English on PC). */
export const reportFormHtml = t => `<form novalidate>
    <h3>${esc(t('reportProblem'))}</h3>
    <label for="rp-title">${esc(t('reportTitle'))}</label><input id="rp-title" maxlength="120" autocomplete="off">
    <label for="rp-text">${esc(t('reportText'))}</label><textarea id="rp-text" rows="5" maxlength="4000" placeholder="${esc(t('reportProblemBody'))}"></textarea>
    <p style="color:var(--muted);font-size:13px;margin:6px 0 0">${esc(t('reportPublic'))}</p>
    <div class="err" role="alert"></div>
    <div class="btns"><a class="btn" data-mail>${esc(t('reportEmail'))}</a>
      <button type="button" class="btn" data-cancel>${esc(t('cancel'))}</button><button class="btn primary" data-send>${esc(t('send'))}</button></div></form>`;

export function wireReport(root, t, version, close) {
  const $ = q => root.querySelector(q), err = $('.err');
  const title = () => $('#rp-title').value.trim(), text = () => $('#rp-text').value.trim();
  const mail = () => { $('[data-mail]').href = reportMailto('Karvo – ' + (title() || t('reportProblem')), text() || t('reportProblemBody'), version); };
  mail();
  $('#rp-title').oninput = $('#rp-text').oninput = mail;
  $('[data-cancel]').onclick = close;
  $('form').onsubmit = async e => {
    e.preventDefault();
    if (title().length < 3) { err.textContent = t('reportTitleShort'); return; }
    if (!text()) { err.textContent = t('reportTextEmpty'); return; }
    const send = $('[data-send]');
    send.disabled = true; send.textContent = t('sending'); err.textContent = '';
    try {
      const n = await sendReport({ title: title(), text: text(), app: `Karvo ${version}`, device: navigator.userAgent.slice(0, 200) });
      $('form').innerHTML = `<h3>${esc(t('reportSent', n))}</h3><div class="btns"><button type="button" class="btn primary" data-cancel>${esc(t('close'))}</button></div>`;
      $('[data-cancel]').onclick = close;
    } catch {
      err.textContent = t('reportFailed');
      send.disabled = false; send.textContent = t('send');
    }
  };
  $('#rp-title').focus();
}
