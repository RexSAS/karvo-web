// The rank emblem for a badge as SVG, ported from Android BadgeMedal.kt drawBadge (100×100 units).
// null draws the empty slot as a dashed outline. Decorative: callers describe it in text.
const METALS = [ // face, highlight, shade: bronze, silver, gold, amethyst, ice
  ['#C98A55', '#F6D6B4', '#6E4120'], ['#C3CCD6', '#F6F9FC', '#5F6B7A'], ['#F4C06A', '#FFF3CF', '#94621A'],
  ['#B9A3FF', '#F1EBFF', '#5B46A8'], ['#8FD3F7', '#EFFBFF', '#2F6FAE'],
];
const INK = '#1B2433';
let uid = 0;
const pts = p => p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

export function badgeSvg(badge, size = 52, cls = '') {
  const id = `bg${++uid}`, cx = 50, cy = 53, h = 62, half = h * 0.42;
  const emblem = k => pts([[0, -.5], [1, -.3], [1, .14], [0, .5], [-1, .14], [-1, -.3]].map(([u, v]) => [cx + u * half * k, cy + v * h * k]));
  const open = `<svg class="medal ${cls}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`;
  if (!badge) return `${open}<polygon points="${emblem(.92)}" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="2.8" stroke-dasharray="8 5.5"/></svg>`;
  const [base, light, dark] = METALS[badge.tier], tier = badge.tier, defs = [], out = [];

  if (tier === 4) {
    defs.push(`<linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="${cx}" y1="0" x2="${cx + 50}" y2="0"><stop offset="0" stop-color="${base}" stop-opacity=".4"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></linearGradient>`,
      `<radialGradient id="${id}g"><stop offset="0" stop-color="${base}" stop-opacity=".5"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>`);
    out.push(`<g class="rays">${Array.from({ length: 14 }, (_, i) => `<polygon points="${pts([[cx, cy], [cx + 50, cy - 4.5], [cx + 50, cy + 4.5]])}" fill="url(#${id}r)" transform="rotate(${i * 360 / 14} ${cx} ${cy})"/>`).join('')}</g>`,
      `<circle cx="${cx}" cy="${cy}" r="48" fill="url(#${id}g)"/>`);
  }
  if (tier >= 2) { // wings: angled feathers on both sides, longer from amethyst
    const n = tier >= 3 ? 4 : 3, len = tier >= 3 ? 27 : 20;
    for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
      const x0 = cx + side * half * .9, y0 = cy - h * .22 + i * h * .13, l = len * (1 - i * .16), fw = h * .1, tip = [x0 + side * l, y0 - l * .5], g = `${id}w${side}${i}`;
      defs.push(`<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="${y0}" x2="${tip[0]}" y2="${tip[1]}"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient>`);
      out.push(`<polygon points="${pts([[x0, y0], tip, [x0 + side * l * .86, y0 - l * .5 + fw], [x0, y0 + fw]])}" fill="url(#${g})" stroke="${dark}" stroke-width=".8"/>`);
    }
  }
  if (tier >= 3) { // a gold crown with a ruby
    const y0 = cy - h * .5, w = half * .62;
    out.push(`<polygon points="${pts([[cx - w, y0 + h * .04], [cx - w, y0 - h * .1], [cx - w * .5, y0 - h * .02], [cx, y0 - h * .16], [cx + w * .5, y0 - h * .02], [cx + w, y0 - h * .1], [cx + w, y0 + h * .04]])}" fill="${METALS[2][0]}" stroke="${METALS[2][2]}"/>`,
      `<circle cx="${cx}" cy="${y0 - h * .07}" r="1.6" fill="#E9405B"/>`);
  }
  // The rim (lit left facet, shaded right), then the face.
  defs.push(`<clipPath id="${id}c"><polygon points="${emblem(1)}"/></clipPath>`,
    `<linearGradient id="${id}f" gradientUnits="userSpaceOnUse" x1="0" y1="${cy - h / 2}" x2="0" y2="${cy + h / 2}"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`);
  out.push(`<polygon points="${emblem(1)}" fill="${dark}"/><rect x="${cx - 100}" y="0" width="100" height="100" fill="${base}" clip-path="url(#${id}c)"/>`,
    `<polygon points="${emblem(.8)}" fill="url(#${id}f)" stroke="#fff" stroke-opacity=".5"/>`);
  // Two peaks, the front one with a snow cap.
  const r = half * .78, my = cy - h * .1, b = my + r * .38, pk = [cx + r * .1, my - r * .45];
  out.push(`<polygon points="${pts([[cx - r * .62, b], [cx - r * .22, my - r * .12], [cx + r * .05, b]])}" fill="${INK}" fill-opacity=".42"/>`,
    `<polygon points="${pts([[cx - r * .4, b], pk, [cx + r * .62, b]])}" fill="${INK}" fill-opacity=".82"/>`,
    `<polygon points="${pts([pk, [pk[0] + r * .17, pk[1] + r * .27], [pk[0] + r * .05, pk[1] + r * .21], [pk[0] - r * .04, pk[1] + r * .28], [pk[0] - r * .16, pk[1] + r * .27]])}" fill="#fff"/>`);
  // Rank chevrons: the step inside the metal, narrowing towards the point.
  for (let i = 0; i <= badge.step; i++) {
    const y = cy + h * .08 + i * h * .065, w = half * (.42 - i * .08);
    out.push(`<polygon points="${pts([[cx - w, y], [cx, y + h * .05], [cx + w, y], [cx + w, y + h * .03], [cx, y + h * .08], [cx - w, y + h * .03]])}" fill="${INK}" fill-opacity=".78"/>`);
  }
  return `${open}<defs>${defs.join('')}</defs>${out.join('')}</svg>`;
}
