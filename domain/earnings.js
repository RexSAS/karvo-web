// Same formula as Android Earnings.kt: integer cents, rounded to the nearest cent.
export const earningsCents = (minutes, rateCents) =>
  rateCents == null ? null : Math.floor((minutes * rateCents + 30) / 60);

export const formatEuro = cents => '€' + (cents / 100).toLocaleString('en',
  cents % 100 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
