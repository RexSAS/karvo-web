// Same as Android Seasons.kt: a season is twelve months from the 1st of startMonth.
import { addMonths, monthOf } from './dates.js';

const pad = n => String(n).padStart(2, '0');

export function seasonOf(date, startMonth) {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  return { startYear: m >= startMonth ? y : y - 1, startMonth };
}

export const seasonLabel = ({ startYear, startMonth }) =>
  startMonth === 1 ? `${startYear}` : `${startYear}/${pad((startYear + 1) % 100)}`;

export const seasonMonths = ({ startYear, startMonth }) =>
  Array.from({ length: 12 }, (_, i) => addMonths(`${startYear}-${pad(startMonth)}`, i));

export const inSeason = (date, season) => seasonMonths(season).includes(monthOf(date));
