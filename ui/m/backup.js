// Backup reminders (spec "Backup reminders"): a backup = a CSV shared from the iPhone or a sync with a linked PC.
const DAY = 864e5;
const BANNER_DAYS = 2, BLOCKING_DAYS = 5;

/** { level: 'none' | 'banner' | 'blocking', days, canSnooze } */
export function reminderState(meta, now = new Date(), hasLessons = true) {
  const times = [meta.lastBackupAt, meta.lastPcSyncAt, meta.startedAt].filter(Boolean).map(Date.parse);
  const last = times.length ? Math.max(...times) : now.getTime();
  const days = Math.max(0, Math.floor((now - last) / DAY)); // a clock moved back counts as "just now"
  const canSnooze = !meta.snoozedOnce;
  if (!hasLessons || days < BANNER_DAYS) return { level: 'none', days, canSnooze: true };
  if (days < BLOCKING_DAYS) return { level: 'banner', days, canSnooze: false };
  const snoozed = meta.snoozedAt && now - Date.parse(meta.snoozedAt) >= 0 && now - Date.parse(meta.snoozedAt) < DAY;
  return snoozed ? { level: 'banner', days, canSnooze: false } : { level: 'blocking', days, canSnooze };
}

export const snooze = (meta, now = new Date()) => ({ ...meta, snoozedAt: now.toISOString(), snoozedOnce: true });
export const recordBackup = (meta, now = new Date()) => ({ ...meta, lastBackupAt: now.toISOString(), snoozedOnce: false, snoozedAt: null });
export const recordSync = (meta, now = new Date()) => ({ ...meta, lastPcSyncAt: now.toISOString(), snoozedOnce: false, snoozedAt: null });
