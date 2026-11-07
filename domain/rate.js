// Same as Android RateParser.kt: euros with up to 2 decimals, ',' or '.', optional '€' or '.-'; blank clears; 0 is invalid.
const PATTERN = /^\d{1,5}(\.\d{1,2})?$/;

export function parseRateCents(input) {
  if (!input.trim()) return { cents: null };
  let text = input.trim().replace(/€$/, '').trim().replaceAll(',', '.');
  if (text.endsWith('.-')) text = text.slice(0, -2);
  if (!PATTERN.test(text)) return { invalid: true };
  const [whole, frac = ''] = text.split('.'), cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return cents === 0 ? { invalid: true } : { cents };
}

export const formatRateText = cents => cents == null ? '' : (cents / 100).toFixed(2);
