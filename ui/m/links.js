// Linked PCs on the iPhone: pair by QR (Allow/Deny), one link per PC while Karvo is on screen, Remove.
import { parseQr } from '../../link/pairing.js';
import { b64url } from '../../link/crypto.js';
import { createPhoneLink } from '../../link/phoneSide.js';
import { esc } from '../html.js';
import { openSheet } from './sheet.js';
import { openScanner } from './scan.js';
import { t } from './i18n.js';

const PAIR_TIMEOUT_MS = 15000;
let ctx = null; // { state, actions, links: Map(roomId → link), pairings }

const visible = () => document.visibilityState === 'visible';

function makeLink(pairing) {
  const { state, actions } = ctx;
  const link = createPhoneLink({ pairing: { ...pairing, peerName: pairing.pcName }, source: state.source, text: k => t(k),
    onPcSync: () => actions.pcSynced(), appVersion: 'web-3', myName: 'iPhone' });
  link.on('state', () => actions.render());
  link.on('gone', () => forget(pairing.roomId));
  return link;
}

async function savePairings() { await ctx.state.store.saveKey('pairings', ctx.pairings).catch(() => {}); }

async function forget(roomId) {
  ctx.links.get(roomId)?.dispose();
  ctx.links.delete(roomId);
  ctx.pairings = ctx.pairings.filter(p => p.roomId !== roomId);
  await savePairings();
  ctx.actions.render();
}

export async function startLinks(state, actions) {
  ctx = { state, actions, links: new Map(), pairings: (await state.store.loadKey('pairings').catch(() => null)) ?? [] };
  for (const p of ctx.pairings) ctx.links.set(p.roomId, makeLink(p));
  const sync = () => ctx.links.forEach(l => (visible() ? l.start() : l.stop())); // iOS stops web apps in the background
  document.addEventListener('visibilitychange', sync);
  sync();
  return ctx;
}

async function pair(text) {
  let qr;
  try { qr = parseQr(text); } catch { return ctx.actions.flash(t('notKarvo'), true); }
  const ok = await new Promise(resolve => {
    const s = openSheet(`<div><h3>${esc(t('linkConfirm', qr.name))}</h3><p class="m-note">${esc(t('linkConfirmBody'))}</p>
      <div class="btns"><button class="btn" data-no>${esc(t('deny'))}</button><button class="btn primary" data-yes>${esc(t('allow'))}</button></div></div>`,
      { onClose: () => resolve(false) });
    s.el.querySelector('[data-no]').onclick = () => s.close();
    s.el.querySelector('[data-yes]').onclick = () => { resolve(true); s.close(); };
  });
  if (!ok) return;
  const pairing = { roomId: b64url(qr.roomId), secret: b64url(qr.secret), pcName: qr.name, linkedAt: new Date().toISOString() };
  ctx.actions.flash(t('linking'));
  ctx.links.get(pairing.roomId)?.dispose(); // the same code scanned twice: never leave the old link running untracked
  const link = makeLink(pairing);
  ctx.links.set(pairing.roomId, link);
  const result = await new Promise(resolve => {
    const timer = setTimeout(() => resolve('timeout'), PAIR_TIMEOUT_MS);
    link.on('state', s => { if (['connected', 'unlinked', 'outdated', 'broken'].includes(s)) { clearTimeout(timer); resolve(s); } });
    link.start();
  });
  if (result === 'connected') {
    ctx.pairings = [...ctx.pairings.filter(p => p.roomId !== pairing.roomId), pairing];
    await savePairings();
    ctx.actions.pcSynced();
    return ctx.actions.flash(t('linked', qr.name));
  }
  link.dispose(); ctx.links.delete(pairing.roomId);
  ctx.actions.flash(t(result === 'unlinked' ? 'expired' : result === 'outdated' ? 'outdated' : 'linkFailed'), true);
}

export function renderLinks(el, state, actions) {
  if (!ctx) { el.hidden = true; return; }
  el.innerHTML = `<h2>${esc(t('linkedPcs'))}</h2><p class="m-note">${esc(t('linkedPcsHint'))}</p>
    ${ctx.pairings.map(p => {
      const on = ctx.links.get(p.roomId)?.state === 'connected';
      return `<div class="m-pc"><span class="name">${esc(p.pcName)}<br><span class="st ${on ? 'on' : ''}">${esc(t(on ? 'connected' : 'notConnected'))}</span></span>
        <button class="btn small" data-remove="${esc(p.roomId)}">${esc(t('remove'))}</button></div>`;
    }).join('')}
    <div class="row"><button class="btn primary" data-pair>${esc(t('linkAPc'))}</button></div>`;
  el.querySelector('[data-pair]').onclick = () => openScanner({ onCode: pair });
  el.querySelectorAll('[data-remove]').forEach(b => b.onclick = async () => {
    const p = ctx.pairings.find(x => x.roomId === b.dataset.remove);
    if (!p || !confirm(t('removeConfirm', p.pcName))) return;
    await ctx.links.get(p.roomId)?.unpair();
    await forget(p.roomId);
  });
}
