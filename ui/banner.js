// Status line in the header: demo, linked phone, read-only backup, or a storage problem.
import { esc } from './html.js';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function relativeTime(iso, now = Date.now()) {
  const s = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]])
    if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
  return 'just now';
}

const LINK_TEXT = {
  replaced: 'Open in another tab · this tab is read only',
  broken: 'Link broken · re-link this PC',
};

export function bannerText({ status, syncedAt, storageError, link }) {
  if (storageError) return ['warn', "Can't save on this PC · use Export CSV in Settings to keep your data"];
  if (status === 'demo') return ['', 'Demo data · nothing is saved · <a href="./">Exit demo</a>'];
  if (status === 'linked') return ['ok', `Connected to ${esc(link?.peerName || 'your phone')}`];
  const synced = syncedAt ? ` · last synced ${esc(relativeTime(syncedAt))}` : '';
  if (link?.paired) {
    if (LINK_TEXT[link.state]) return ['warn', LINK_TEXT[link.state]];
    if (link.state === 'outdated') return ['warn', link.phoneNewer ? 'Reload this page to connect to your phone' : 'Update Karvo on your phone to connect'];
    return ['', `Open Karvo on your phone to connect${synced}`];
  }
  if (status === 'backup' && syncedAt) return ['', `Phone not connected${synced} · Read only`];
  return null;
}

export function renderBanner(el, info) {
  const b = bannerText(info);
  el.innerHTML = b ? `<span class="banner ${b[0]}">${b[1]}</span>` : '';
}
