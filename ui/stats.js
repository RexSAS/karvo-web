// Bottom row: the selected month's season as a line (hours per month), a donut (top students) and columns (weekdays).
import { seasonOf, seasonLabel } from '../domain/seasons.js';
import { seasonStats, lifetimeStats } from '../domain/stats.js';
import { formatHours, monthOf, today } from '../domain/dates.js';
import { esc } from './html.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CAT = ['#3D9BE9', '#BE8128', '#9B6FE0', '#1E9E7C'], OTHER = '#3A4A66'; // validated with dataviz validate_palette.js (dark)
const mName = m => MONTHS[Number(m.slice(5)) - 1];

export function renderStats(el, { snapshot, view, statsLifetime }, actions) {
  const season = seasonOf(view + '-01', snapshot.seasonStartMonth);
  const s = statsLifetime ? lifetimeStats(snapshot.lessons, snapshot.seasonStartMonth) : seasonStats(snapshot.lessons, season);
  el.innerHTML = `<div class="stats-head"><h2>Statistics · ${statsLifetime ? 'lifetime' : `season ${seasonLabel(season)}`} · ${formatHours(s.minutes)}</h2>
      <span class="seg" role="group" aria-label="Statistics period">
        <button data-mode="season" aria-pressed="${!statsLifetime}">Season</button><button data-mode="lifetime" aria-pressed="${!!statsLifetime}">Lifetime</button></span></div>
    <div class="stats-grid">
      <div><h4>${statsLifetime ? 'Hours per season' : 'Hours per month'}</h4><div class="chart" data-c="month"></div></div>
      <div><h4>Top students</h4><div class="donut" data-c="donut"></div></div>
      <div><h4>Busiest weekdays</h4><div class="chart" data-c="wd"></div></div>
    </div>`;
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => actions.setStatsLifetime(b.dataset.mode === 'lifetime'));
  const [a, d, w] = ['month', 'donut', 'wd'].map(k => el.querySelector(`[data-c="${k}"]`));
  if (!s.lessonCount) { [a, d, w].forEach(x => x.innerHTML = `<div class="empty">${statsLifetime ? 'No lessons yet.' : 'No lessons this season.'}</div>`); return; }
  if (statsLifetime) areaChart(a, s.perSeason, seasonLabel(seasonOf(view + '-01', snapshot.seasonStartMonth)), actions);
  else areaChart(a, s.perMonth, view, actions);
  donut(d, s, statsLifetime ? 'all time' : 'this season');
  columns(w, s.weekdayMinutes);
}

export function areaChart(el, perMonth, cur, actions) {
  const W = el.clientWidth, H = el.clientHeight, B = H - 18, T = 16, n = perMonth.length;
  // Points are months ({month}) or seasons ({label}); future months get a label but no point (no fake drop to 0).
  const shown = perMonth.filter(p => !p.month || p.month <= monthOf(today())).length;
  const key = p => p.month ?? p.label, label = p => p.month ? mName(p.month) : p.label;
  const mx = Math.max(1, ...perMonth.map(p => p.minutes)), x = i => W * (i + .5) / n, y = v => B - (B - T) * v / mx;
  const line = perMonth.slice(0, shown).map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.minutes)}`).join('');
  const ci = perMonth.findIndex(p => key(p) === cur);
  el.innerHTML = `<svg><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8CCBFF" stop-opacity=".35"/><stop offset="1" stop-color="#8CCBFF" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" x2="${W}" y1="${B}" y2="${B}" stroke="var(--line)"/>
    ${shown ? `<path d="${line}L${x(shown - 1)},${B}L${x(0)},${B}Z" fill="url(#ag)"/><path d="${line}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round"/>` : ''}
    ${perMonth.map((p, i) => `<g class="hit" ${p.month ? `data-m="${p.month}"` : ''} data-tip="${p.month ? `${mName(p.month)} ${p.month.slice(0, 4)}` : p.label}: ${formatHours(p.minutes)}">
      <rect x="${x(i) - W / n / 2}" y="0" width="${W / n}" height="${H}" fill="transparent"/>
      <line class="cross" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${B}"/>
      ${i < shown ? `<circle cx="${x(i)}" cy="${y(p.minutes)}" r="${i === ci ? 6 : 4}" fill="${i === ci ? 'var(--primary)' : 'var(--s2)'}" stroke="var(--primary)" stroke-width="2"/>` : ''}
      <text x="${x(i)}" y="${H - 2}" text-anchor="middle">${label(p)}</text></g>`).join('')}
    ${ci >= 0 && ci < shown ? `<text class="val" x="${x(ci)}" y="${y(perMonth[ci].minutes) - 12}" text-anchor="middle">${formatHours(perMonth[ci].minutes)}</text>` : ''}</svg>`;
  el.onclick = e => { const g = e.target.closest('[data-m]'); if (g) actions.setView(g.dataset.m); };
}

export function donut(el, s, centerLabel = 'this season') {
  const parts = s.top.map((t, i) => [t.name, t.minutes, CAT[i]]);
  if (s.otherMinutes) parts.push(['Other', s.otherMinutes, OTHER]);
  const S = Math.max(60, Math.min(el.clientHeight, 150)), r = S / 2 - 12, C = 2 * Math.PI * r;
  let off = 0;
  const arcs = parts.map(([k, v, c]) => {
    const len = C * v / s.minutes;
    const a = `<circle class="hit" data-tip="${esc(k)}: ${formatHours(v)}" r="${r}" cx="${S / 2}" cy="${S / 2}" fill="none" stroke="${c}" stroke-width="18"
      stroke-dasharray="${parts.length > 1 ? Math.max(len - 2, .5) : len} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${S / 2} ${S / 2})"/>`;
    off += len; return a;
  });
  el.innerHTML = `<svg width="${S}" height="${S}" role="img" aria-label="Top students">${arcs.join('')}
      <text class="c1" x="${S / 2}" y="${S / 2 + 2}" text-anchor="middle">${formatHours(s.minutes)}</text>
      <text class="c2" x="${S / 2}" y="${S / 2 + 18}" text-anchor="middle">${centerLabel}</text></svg>
    <div class="leg">${parts.map(([k, v, c]) => `<div><i style="background:${c}"></i><span>${esc(k)}</span><span>${formatHours(v)} · ${Math.round(v / s.minutes * 100)}%</span></div>`).join('')}</div>`;
}

export function columns(el, vals) {
  const W = el.clientWidth, H = el.clientHeight, B = H - 18, T = 18, mx = Math.max(1, ...vals), slot = W / 7, w = Math.min(36, slot * .6);
  const best = vals.indexOf(Math.max(...vals));
  el.innerHTML = `<svg><line x1="0" x2="${W}" y1="${B}" y2="${B}" stroke="var(--line)"/>
    ${vals.map((v, i) => {
      const h = (B - T) * v / mx, x0 = slot * i + (slot - w) / 2, r = Math.min(4, h, w / 2), yt = B - h;
      return `<g class="hit" data-tip="${WD[i]}: ${formatHours(v)}"><rect x="${slot * i}" y="0" width="${slot}" height="${H}" fill="transparent"/>
        ${h ? `<path class="col" d="M${x0},${B}V${yt + r}Q${x0},${yt} ${x0 + r},${yt}H${x0 + w - r}Q${x0 + w},${yt} ${x0 + w},${yt + r}V${B}Z" fill="var(--primary)" opacity="${i === best ? 1 : .55}"/>` : ''}
        <text x="${slot * i + slot / 2}" y="${H - 2}" text-anchor="middle">${WD[i]}</text>
        ${i === best && v ? `<text class="val" x="${slot * i + slot / 2}" y="${yt - 6}" text-anchor="middle">${formatHours(v)}</text>` : ''}</g>`;
    }).join('')}</svg>`;
}
