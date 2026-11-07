// Status line in the header: demo, read-only backup, or a storage problem.
import { esc } from './html.js';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function relativeTime(iso, now = Date.now()) {
  const s = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]])
    if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
  return 'just now';
}

export function renderBanner(el, { status, syncedAt, storageError }) {
  let html = '';
  if (storageError) html = `<span class="banner warn">Can't save on this PC · use Export CSV in Settings to keep your data</span>`;
  else if (status === 'demo') html = `<span class="banner">Demo data · nothing is saved · <a href="./">Exit demo</a></span>`;
  else if (status === 'backup' && syncedAt) html = `<span class="banner">Phone not connected · last synced ${esc(relativeTime(syncedAt))} · Read only</span>`;
  el.innerHTML = html;
}
