// Rates on the PC and the iPhone (same rules as Android Settings → Hourly rates): the list with a ⋯ menu per rate,
// the add/edit form, and the rate flags of the lesson form. t is the i18n function; open(html) shows a dialog or sheet.
import { ratesOf, rateCss, titleTaken, RATE_COLORS, MAX_RATE_TITLE } from '../domain/rates.js';
import { parseRateCents, formatRateText } from '../domain/rate.js';
import { esc } from './html.js';

const dot = color => `<span class="rate-dot" style="background:${rateCss(color)}"></span>`;

/** A lesson's mark in lists: a coloured dot when it isn't on the default rate. */
export function rateMarkHtml(pay, lesson) {
  const r = pay.rateOf(lesson);
  return r && r !== pay.default ? `<span class="rate-dot" style="background:${rateCss(r.color)}" title="${esc(r.title)}" role="img" aria-label="${esc(r.title)}"></span>` : '';
}

/** The lesson list's rate filter chips (2+ rates): count(rateId) says how many lessons each would show. */
export function rateChipsHtml(pay, selected, count) {
  if (pay.rates.length < 2) return '';
  return pay.rates.map(r => `<button type="button" class="chip rate" data-rate-filter="${r.id}" aria-pressed="${r.id === selected}">${dot(r.color)}${esc(r.title)}<span class="n">${count(r.id)}</span></button>`).join('');
}

/** The lesson form's rate flags; only when there's a choice (2+ rates). selectedId null = the default. */
export function rateFlagsHtml(pay, lesson, t) {
  if (pay.rates.length < 2) return '';
  const chosen = lesson ? pay.rateOf(lesson) : pay.default;
  return `<fieldset class="rate-flags"><legend>${esc(t('lessonRate'))}</legend>${pay.rates.map(r =>
    `<label class="rate-flag"><input type="radio" name="rate" value="${r.id}" ${r === chosen ? 'checked' : ''}>${dot(r.color)}${esc(r.title)}</label>`).join('')}</fieldset>`;
}

/** The picked rate's id, or the lesson's own (null) when the form has no flags. */
export const readRateFlag = (form, fallback = null) => {
  const v = form.querySelector('input[name="rate"]:checked')?.value;
  return v == null ? fallback : Number(v);
};

/** printable: the ⋯ menu also offers Print (the PC: a statement of every lesson on that rate). */
export function ratesListHtml(snapshot, t, canEdit = true, printable = false) {
  const rates = ratesOf(snapshot), dis = canEdit ? '' : 'disabled';
  return `<div class="rates"><div class="rates-h">${esc(t('hourlyRates'))}</div>
    ${rates.length ? '' : `<div class="rates-empty">${esc(t('ratesEmpty'))}</div>`}
    ${rates.map(r => `<div class="rate-row">${dot(r.color)}<button type="button" class="rate-main" data-rate-edit="${r.id}" ${dis}><b>${esc(r.title)}</b>
        <span>${esc(t('perHour', formatRateText(r.cents)))}${r.isDefault ? ' · ' + esc(t('rateDefault')) : ''}</span></button>
      <details class="rate-menu"><summary aria-label="${esc(t('rateOptions', r.title))}" title="${esc(t('rateOptions', r.title))}">⋯</summary><div>
        ${r.isDefault ? '' : `<button type="button" data-rate-default="${r.id}" ${dis}>${esc(t('rateSetDefault'))}</button>`}
        <button type="button" data-rate-edit="${r.id}" ${dis}>${esc(t('edit'))}</button>
        ${printable ? `<button type="button" data-rate-print="${r.id}">${esc(t('print'))}</button>` : ''}
        <button type="button" data-rate-del="${r.id}" ${r.isDefault && rates.length > 1 || !canEdit ? 'disabled' : ''}>${esc(t('delete'))}</button>
      </div></details></div>`).join('')}
    <button type="button" class="btn small" data-rate-add ${dis}>+ ${esc(t('rateAdd'))}</button></div>`;
}

/** Wires a list made by ratesListHtml inside el. Failures go to onError(message). */
export function wireRates(el, { getSnapshot, source, t, open, onError = msg => alert(msg), onPrint = null }) {
  const find = id => ratesOf(getSnapshot()).find(r => r.id === Number(id));
  const fail = e => onError(e.message);
  const closeMenus = () => el.querySelectorAll('.rate-menu[open]').forEach(m => m.removeAttribute('open'));
  el.querySelectorAll('[data-rate-default]').forEach(b => b.onclick = () => { closeMenus(); source.setDefaultRate(Number(b.dataset.rateDefault)).catch(fail); });
  el.querySelectorAll('[data-rate-edit]').forEach(b => b.onclick = () => { closeMenus(); openRateForm(find(b.dataset.rateEdit)); });
  el.querySelectorAll('[data-rate-print]').forEach(b => b.onclick = () => { closeMenus(); onPrint?.(find(b.dataset.ratePrint)); });
  el.querySelectorAll('[data-rate-del]').forEach(b => b.onclick = () => {
    closeMenus();
    const rate = find(b.dataset.rateDel), def = ratesOf(getSnapshot()).find(r => r.isDefault && r.id !== rate.id);
    if (confirm(t('rateDeleteQ', rate.title) + '\n' + (def ? t('rateDeleteMoves', def.title) : t('rateDeleteLast')))) source.deleteRate(rate.id).catch(fail);
  });
  el.querySelector('[data-rate-add]').onclick = () => {
    const used = ratesOf(getSnapshot()).map(r => r.color);
    openRateForm({ id: 0, title: '', cents: null, color: RATE_COLORS.find(c => !used.includes(c)) ?? RATE_COLORS[0] });
  };

  function openRateForm(rate) {
    const { el: f, close } = open(`<form method="dialog" novalidate class="rate-form"><h3>${esc(t(rate.id ? 'rateEdit' : 'rateAdd'))}</h3>
      <label for="r-title">${esc(t('rateName'))}</label><input id="r-title" maxlength="${MAX_RATE_TITLE}" value="${esc(rate.title)}">
      <label for="r-cents">${esc(t('hourlyRate'))}</label><input id="r-cents" inputmode="decimal" placeholder="${esc(t('rateHint'))}" value="${formatRateText(rate.cents)}">
      <fieldset class="rate-colors"><legend>${esc(t('rateColor'))}</legend>${RATE_COLORS.map((c, i) =>
        `<label><input type="radio" name="color" value="${c}" ${c === rate.color ? 'checked' : ''} aria-label="${esc(t('rateColor'))} ${i + 1}">${dot(c)}</label>`).join('')}</fieldset>
      <div class="err m-err" role="alert"></div>
      <div class="btns row"><button type="button" class="btn" data-cancel>${esc(t('cancel'))}</button><button class="btn primary">${esc(t('save'))}</button></div></form>`);
    const $ = q => f.querySelector(q), err = $('[role="alert"]');
    $('[data-cancel]').onclick = close;
    $('form').onsubmit = async e => {
      e.preventDefault();
      const title = $('#r-title').value.trim(), p = parseRateCents($('#r-cents').value);
      if (!title) { err.textContent = t('rateNameMissing'); return; }
      if (titleTaken(ratesOf(getSnapshot()), title, rate.id)) { err.textContent = t('rateNameTaken'); return; }
      if (p.invalid || p.cents == null) { err.textContent = t('invalidRate'); return; }
      try {
        await source.saveRate({ id: rate.id, title, cents: p.cents, color: Number($('input[name="color"]:checked').value) });
        close();
      } catch (x) { err.textContent = x.message; }
    };
    $('#r-title').focus();
  }
}
