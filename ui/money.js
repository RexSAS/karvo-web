// Money is hidden as "€ ••••" until the eye is pressed, and hidden again on every page load.
import { formatEuro } from '../domain/earnings.js';
import { esc } from './html.js';

export const HIDDEN = '€ ••••';
export const NO_RATE = 'Set a rate';

export const moneyHtml = (cents, cls = '') =>
  `<span class="money ${cls}" data-v="${esc(cents == null ? NO_RATE : formatEuro(cents))}"></span>`;

export function paintMoney(show, root = document) {
  root.querySelectorAll('.money').forEach(e => {
    const v = e.dataset.v, noRate = v === NO_RATE, visible = show || noRate;
    e.classList.toggle('hidden', !visible);
    e.classList.toggle('norate', noRate);
    e.textContent = visible ? v : HIDDEN;
    e.setAttribute('aria-label', visible ? v : 'Amount hidden');
  });
}

/** When the money comes out, a glint runs along the gold horizon line (styles.css, body.glint), as in the Android app. */
export function glint(show) {
  if (!show) return;
  document.body.classList.add('glint');
  setTimeout(() => document.body.classList.remove('glint'), 700);
}
