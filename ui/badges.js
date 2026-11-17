// The Badges window on PC (as Android BadgesScreen): the season's badge big, how far the next one is, every badge,
// and the best badge of each season. The emblem drawing and the titles are shared with the iPhone app.
import { BADGES, badgeProgress } from '../domain/badges.js';
import { seasonLabel } from '../domain/seasons.js';
import { formatHours } from '../domain/dates.js';
import { badgeSvg as draw } from './badge.js';
import { STRINGS } from './m/i18n.js';

export const badgeTitle = b => STRINGS.en['badge_' + b.id]; // the PC is English only
export const badgeSvg = (b, cls = '') => draw(b, 52, cls);

/** The Badges window: the season's badge big, how far the next one is, every badge, and the best badge of each season. */
export function openBadges({ season, minutes, seasons }) {
  const p = badgeProgress(minutes), d = document.createElement('dialog');
  d.className = 'wide';
  const row = (svg, title, sub, right) => `<div class="b-row">${svg}<div><b>${title}</b>${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="sub">${right}</span></div>`;
  d.innerHTML = `<form method="dialog">
    <div class="b-hero">${badgeSvg(p.earned, 'big')}<h3>${(p.earned && badgeTitle(p.earned)) ?? 'No badge yet'}</h3><div class="sub">Season ${seasonLabel(season)} · ${formatHours(minutes)}</div></div>
    <div class="b-next"><b>${p.next ? `Next: ${badgeTitle(p.next)} at ${formatHours(p.next.minutes)}` : 'Every badge earned this season'}</b>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.fraction * 100)}"><i style="width:${p.fraction * 100}%"></i></div>
      ${p.next ? `<div class="sub">${formatHours(p.minutesToNext)} to go</div>` : ''}</div>
    <h4>All badges</h4>
    <div class="b-list">${BADGES.map(b => row(badgeSvg(b, minutes >= b.minutes ? '' : 'locked'), badgeTitle(b), '', `${formatHours(b.minutes)}${minutes >= b.minutes ? ' <span class="gold" aria-label="Earned">✓</span>' : ''}`)).join('')}</div>
    ${seasons.length ? `<h4>Best badge of each season</h4><div class="b-list">${seasons.map(s => { const best = badgeProgress(s.minutes).earned;
      return row(badgeSvg(best), s.label, (best && badgeTitle(best)) ?? 'No badge yet', formatHours(s.minutes)); }).join('')}</div>` : ''}
    <div class="btns"><button class="btn">Close</button></div></form>`;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  d.scrollTop = 0; // focus lands on Close at the bottom; the window still opens on the big badge
}
