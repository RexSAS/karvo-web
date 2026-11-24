// Same rules as Android Rate.kt / Earnings.kt (Pay): several hourly rates, one default; a lesson with no rate, or a
// rate that's gone, is paid at the default. Edits are pure: they take a snapshot and return the next one.
export const RATE_COLORS = [0xFF4FA3E0, 0xFFE0B04F, 0xFF5CC08A, 0xFFE0675C, 0xFFA57BE0, 0xFFE07FB8, 0xFF5CC6C6, 0xFF9AA5B1].map(c => c | 0);
export const MAX_RATE_TITLE = 30;

/** ARGB int (as the phone stores it) to a CSS colour. */
export const rateCss = argb => '#' + ((argb >>> 0) & 0xFFFFFF).toString(16).padStart(6, '0');

const sortRates = rates => [...rates].sort((a, b) => (b.isDefault - a.isDefault) || a.id - b.id);

/** A snapshot's rates, default first. Snapshots from before rates (one rateCents) have one default "Standard" rate. */
export const ratesOf = s => sortRates(s.rates?.length || s.rateCents == null ? s.rates ?? []
  : [{ id: 1, title: 'Standard', cents: s.rateCents, color: RATE_COLORS[0], isDefault: true }]);

/** [rates] and the lessons' rates as one object; earnings are null with no rates (hidden, as before). */
export function pay(rates) {
  const def = rates.find(r => r.isDefault) ?? rates[0] ?? null, byId = new Map(rates.map(r => [r.id, r]));
  const rateOf = l => byId.get(l.rateId) ?? def;
  return {
    rates, default: def, isSet: !!def, rateOf,
    // Rounded once over the sum, so one rate gives exactly the old minutes × rate.
    earnings: lessons => def ? Math.floor((lessons.reduce((s, l) => s + l.durationMinutes * rateOf(l).cents, 0) + 30) / 60) : null,
    titleOf: l => rateOf(l)?.title ?? '',
    idOfTitle: t => rates.find(r => r.title.toLowerCase() === t.trim().toLowerCase())?.id ?? null,
  };
}

export const payOf = snapshot => pay(ratesOf(snapshot));

/** The lesson test for a rate filter, or null when there is nothing to filter: no rate picked, or a rate that's gone. */
export const rateTest = (p, id) => id == null || !p.rates.some(r => r.id === id) ? null : l => p.rateOf(l)?.id === id;

/** The snapshot with [rates] (and rateCents = the default's, for PCs and phones from before rates). */
const withRates = (s, rates, lessons = s.lessons) =>
  ({ ...s, lessons, rates: sortRates(rates), rateCents: rates.find(r => r.isDefault)?.cents ?? null });

/** Null when the title or amount is invalid (a positive whole number of cents, a 1–30 character title). */
export function checkRate(r) {
  const title = typeof r?.title === 'string' ? r.title.trim() : '';
  if (!title || title.length > MAX_RATE_TITLE || !(Number.isInteger(r.cents) && r.cents > 0) || !Number.isInteger(r.color)) return null;
  return { id: Number.isInteger(r.id) ? r.id : 0, title, cents: r.cents, color: r.color };
}

/** True when another rate already has this title (ignoring case): CSV files name rates by title. */
export const titleTaken = (rates, title, id = 0) => rates.some(x => x.id !== id && x.title.toLowerCase() === title.trim().toLowerCase());

/** Adds (id 0) or edits a rate; the first rate is the default. Null when invalid, the title is taken, or the rate is gone. */
export function saveRate(s, rate) {
  const r = checkRate(rate), rates = ratesOf(s);
  if (!r || titleTaken(rates, r.title, r.id)) return null;
  if (!r.id) return withRates(s, [...rates, { ...r, id: Math.max(0, ...rates.map(x => x.id)) + 1, isDefault: !rates.length }]);
  const old = rates.find(x => x.id === r.id);
  return old ? withRates(s, rates.map(x => x.id === r.id ? { ...r, isDefault: old.isDefault } : x)) : null;
}

/** Lessons still on "the default" (no rate) keep the old default's rate, so what they earn doesn't change. */
export function setDefaultRate(s, id) {
  const rates = ratesOf(s), old = rates.find(r => r.isDefault);
  if (!rates.some(r => r.id === id) || old?.id === id) return withRates(s, rates);
  const lessons = old ? s.lessons.map(l => l.rateId == null ? { ...l, rateId: old.id } : l) : s.lessons;
  return withRates(s, rates.map(r => ({ ...r, isDefault: r.id === id })), lessons);
}

/** Its lessons move to the default. The default goes only as the last rate (its lessons then have none). Null if not allowed. */
export function deleteRate(s, id) {
  const rates = ratesOf(s), rate = rates.find(r => r.id === id);
  if (!rate || (rate.isDefault && rates.length > 1)) return null;
  const to = rates.find(r => r.isDefault && r.id !== id)?.id ?? null;
  return withRates(s, rates.filter(r => r.id !== id), s.lessons.map(l => l.rateId === id ? { ...l, rateId: to } : l));
}

/** A snapshot from before rates, given its rates array (the default made from rateCents); others unchanged. */
export const normalizeRates = s => s && (s.rates ? s : withRates(s, ratesOf(s)));
