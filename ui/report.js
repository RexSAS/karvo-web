// "Report a problem" form (iPhone sheet and PC dialog): sent to the relay, which opens a GitHub issue on RexSAS/Karvo.
// If sending fails (offline, limit reached), "Send by email instead" still works.
import { esc, reportMailto } from './html.js';

const ENDPOINT = 'https://link.rxsas.it/report';

export async function sendReport(report) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return (await r.json()).number;
}

// shortcut: the list of sent reports lives in this browser only (lost if site data is cleared); the issues stay on GitHub.
const KEY = 'karvo.reports';
export const sentReports = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } };
const rememberReport = r => { try { localStorage.setItem(KEY, JSON.stringify([r, ...sentReports()])); } catch {} };

/** Public repo, so no token: { open, replies: [{ author, body, date }] }. */
async function reportStatus(n) {
  const get = async path => {
    const r = await fetch(`https://api.github.com/repos/RexSAS/Karvo/issues/${n}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const [issue, comments] = await Promise.all([get(''), get('/comments')]);
  return { open: issue.state === 'open', replies: comments.map(c => ({ author: c.user.login === 'RexSAS' ? 'Karvo' : c.user.login, body: c.body, date: c.created_at.slice(0, 10) })) };
}

async function showMyReports(root, t, close) {
  const list = sentReports().slice(0, 10);
  const form = root.querySelector('form');
  form.innerHTML = `<h3>${esc(t('myReports'))}</h3>
    ${list.length ? list.map(r => `<div style="margin:12px 0" data-n="${r.n}"><b>${esc(r.t)}</b>
      <div style="color:var(--muted);font-size:13px">#${r.n} · <span data-state>${esc(t('reportLoading'))}</span></div><div data-replies></div></div>`).join('')
      : `<p>${esc(t('myReportsEmpty'))}</p>`}
    <div class="err" role="alert"></div>
    <div class="btns"><button type="button" class="btn primary" data-cancel>${esc(t('close'))}</button></div>`;
  form.querySelector('[data-cancel]').onclick = close;
  for (const r of list) {
    const el = form.querySelector(`[data-n="${r.n}"]`);
    try {
      const s = await reportStatus(r.n);
      el.querySelector('[data-state]').textContent = t(s.open ? 'reportOpen' : 'reportClosed');
      el.querySelector('[data-replies]').innerHTML = s.replies.length
        ? s.replies.map(c => `<div style="background:var(--s4,rgba(127,127,127,.12));border-radius:8px;padding:8px;margin-top:6px">
            <div style="color:var(--muted);font-size:12px">${esc(c.author)} · ${esc(c.date)}</div><div style="white-space:pre-wrap">${esc(c.body)}</div></div>`).join('')
        : `<div style="font-size:13px">${esc(t('reportNoReplies'))}</div>`;
    } catch {
      el.querySelector('[data-state]').textContent = '?';
      form.querySelector('.err').textContent = t('myReportsFailed');
    }
  }
}

/** t: text lookup (the iPhone's t, or English on PC). */
export const reportFormHtml = t => `<form novalidate>
    <h3>${esc(t('reportProblem'))}</h3>
    <label for="rp-title">${esc(t('reportTitle'))}</label><input id="rp-title" maxlength="120" autocomplete="off">
    <label for="rp-text">${esc(t('reportText'))}</label><textarea id="rp-text" rows="5" maxlength="4000" placeholder="${esc(t('reportProblemBody'))}"></textarea>
    <p style="color:var(--muted);font-size:13px;margin:6px 0 0">${esc(t('reportPublic'))}</p>
    <div class="err" role="alert"></div>
    ${sentReports().length ? `<p style="margin:6px 0 0"><a href="#" data-mine>${esc(t('myReports'))}</a></p>` : ''}
    <div class="btns"><a class="btn" data-mail>${esc(t('reportEmail'))}</a>
      <button type="button" class="btn" data-cancel>${esc(t('cancel'))}</button><button class="btn primary" data-send>${esc(t('send'))}</button></div></form>`;

export function wireReport(root, t, version, close) {
  const $ = q => root.querySelector(q), err = $('.err');
  const title = () => $('#rp-title').value.trim(), text = () => $('#rp-text').value.trim();
  const mail = () => { $('[data-mail]').href = reportMailto('Karvo – ' + (title() || t('reportProblem')), text() || t('reportProblemBody'), version); };
  mail();
  $('#rp-title').oninput = $('#rp-text').oninput = mail;
  $('[data-cancel]').onclick = close;
  $('[data-mine]')?.addEventListener('click', e => { e.preventDefault(); showMyReports(root, t, close); });
  $('form').onsubmit = async e => {
    e.preventDefault();
    if (title().length < 3) { err.textContent = t('reportTitleShort'); return; }
    if (!text()) { err.textContent = t('reportTextEmpty'); return; }
    const send = $('[data-send]');
    send.disabled = true; send.textContent = t('sending'); err.textContent = '';
    try {
      const n = await sendReport({ title: title(), text: text(), app: `Karvo ${version}`, device: navigator.userAgent.slice(0, 200) });
      rememberReport({ n, t: title() });
      $('form').innerHTML = `<h3>${esc(t('reportSent', n))}</h3><p>${esc(t('reportSentHint'))}</p>
        <div class="btns"><button type="button" class="btn" data-mine>${esc(t('myReports'))}</button><button type="button" class="btn primary" data-cancel>${esc(t('close'))}</button></div>`;
      $('[data-cancel]').onclick = close;
      $('[data-mine]').onclick = () => showMyReports(root, t, close);
    } catch (e) {
      err.textContent = t(e.status === 429 ? 'reportTooMany' : 'reportFailed');
      send.disabled = false; send.textContent = t('send');
    }
  };
  $('#rp-title').focus();
}
