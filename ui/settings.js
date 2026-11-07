// Settings: hourly rate, season start, CSV import/export, and deleting this PC's backup.
import { parseRateCents, formatRateText } from '../domain/rate.js';
import { pickTextFile, downloadCsv } from './files.js';
import { esc } from './html.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function openSettings(source, getSnapshot, link = null) {
  const snapshot = getSnapshot();
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog" novalidate>
    <h3>Settings</h3>
    <label for="s-rate">Hourly rate (€)</label><input id="s-rate" inputmode="decimal" placeholder="e.g. 30" value="${formatRateText(snapshot.rateCents)}">
    <label for="s-season">Season starts in</label>
    <select id="s-season">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === snapshot.seasonStartMonth ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <div class="err" data-err role="alert"></div>
    <div class="btns"><button type="button" class="btn" data-cancel>Close</button><button class="btn primary">Save</button></div>
    <hr>
    <label>Lessons file (same CSV as the Android app)</label>
    <div class="btns" style="justify-content:flex-start;margin-top:4px">
      <button type="button" class="btn small" data-import>Import CSV</button>
      <button type="button" class="btn small" data-export ${snapshot.lessons.length ? '' : 'disabled'}>Export CSV</button>
    </div>
    <div class="ok-msg" data-msg role="status"></div>
    ${link ? `<hr><label>Phone link</label>
    <div class="row" style="margin-top:4px">${link.paired
      ? `<span>Linked phone: ${esc(link.peerName)}</span><button type="button" class="btn small danger" data-unlink>Unlink</button>`
      : '<span class="sub" style="color:var(--muted)">No phone linked</span><button type="button" class="btn small primary" data-link>Link your phone</button>'}</div>` : ''}
    ${source.status === 'backup' && snapshot.lessons.length ? '<hr><button type="button" class="btn small danger" data-wipe>Delete backup from this PC</button>' : ''}
  </form>`;
  document.body.append(d);
  const $ = s => d.querySelector(s), close = () => { d.close(); d.remove(); };
  const say = (text, isErr) => { $('[data-msg]').textContent = isErr ? '' : text; $('[data-err]').textContent = isErr ? text : ''; };
  $('[data-cancel]').onclick = close;
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('form').onsubmit = async e => {
    e.preventDefault();
    const rate = parseRateCents($('#s-rate').value);
    if (rate.invalid) return say('Enter a rate like 30 or 27.50', true);
    if (rate.cents !== snapshot.rateCents) await source.setRate(rate.cents);
    const season = Number($('#s-season').value);
    if (season !== snapshot.seasonStartMonth) await source.setSeasonStart(season);
    close();
  };
  $('[data-import]').onclick = async () => {
    const text = await pickTextFile();
    if (text == null) return;
    try {
      const { added, skipped } = await source.importCsv(text);
      $('[data-export]').disabled = !getSnapshot().lessons.length;
      say(`Added ${added} lesson${added === 1 ? '' : 's'}, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`);
    } catch (err) { say(err.message, true); }
  };
  $('[data-export]').onclick = () => downloadCsv(getSnapshot().lessons); // current data, including imports made in this dialog
  $('[data-unlink]')?.addEventListener('click', async () => {
    if (!confirm(`Unlink ${link.peerName}? This PC keeps its read-only backup.`)) return;
    await link.unlink();
    close();
  });
  $('[data-link]')?.addEventListener('click', () => { close(); link.linkPhone(); });
  $('[data-wipe]')?.addEventListener('click', async () => {
    if (!confirm('Delete all lessons stored on this PC? Your phone is not affected.')) return;
    await source.clear();
    close();
  });
  d.showModal();
  return d;
}
