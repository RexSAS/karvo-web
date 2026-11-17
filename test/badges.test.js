import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGES, badgeProgress, badgeMark, badgeToAnnounce } from '../domain/badges.js';
import { lastSeasonToDate, studentDetail, seasonWelcome } from '../domain/stats.js';
import { STRINGS } from '../ui/m/i18n.js';

const L = (id, date, student, durationMinutes = 60, paidOn = null) => ({ id, date, durationMinutes, student, notes: null, paidOn });
const S = { startYear: 2026, startMonth: 12 };

test('14 badges, same hours, tiers and steps as Android', () => {
  assert.deepEqual(BADGES.map(b => b.hours), [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600]);
  assert.deepEqual(BADGES.map(b => b.tier), [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4]);
  assert.deepEqual(BADGES.map(b => b.step), [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1]);
  for (const b of BADGES) assert.ok(STRINGS.en['badge_' + b.id] && STRINGS.it['badge_' + b.id], b.id);
});

test('progress between badges, none yet, all earned', () => {
  assert.equal(badgeProgress(0).earned, null);
  assert.equal(badgeProgress(30).fraction, .5);
  const p = badgeProgress(7 * 60);
  assert.equal(p.earned.id, 'firstSnow'); assert.equal(p.next.id, 'bunnyHill'); assert.equal(p.minutesToNext, 180); assert.equal(p.fraction, .4);
  const all = badgeProgress(700 * 60);
  assert.equal(all.earned.id, 'legend'); assert.equal(all.next, null); assert.equal(all.fraction, 1);
});

test('announce: higher badge or new season only, never on a loss or a repeat', () => {
  const karver = BADGES[0], snow = BADGES[1];
  assert.equal(badgeToAnnounce(S, null, null), null);
  assert.equal(badgeToAnnounce(S, karver, null), karver);
  assert.equal(badgeToAnnounce(S, snow, badgeMark(S, karver)), snow);
  assert.equal(badgeToAnnounce(S, karver, badgeMark(S, snow)), null);
  assert.equal(badgeToAnnounce(S, snow, badgeMark(S, snow)), null);
  assert.equal(badgeToAnnounce(S, karver, badgeMark({ startYear: 2025, startMonth: 12 }, snow)), karver);
});

test('last season to the same date a year ago; null with no lessons last season', () => {
  const ls = [L(1, '2025-12-10', 'A', 120), L(2, '2026-01-05', 'A', 60), L(3, '2026-01-20', 'A', 60)];
  assert.equal(lastSeasonToDate(ls, '2027-01-10', 12), 180);
  assert.equal(lastSeasonToDate(ls, '2026-01-10', 12), null);
  assert.equal(lastSeasonToDate([L(1, '2027-02-28', 'A')], '2028-02-29', 12), 60);
});

test('student detail: matched case-insensitively, latest spelling, half-up average, six months, seasons', () => {
  const ls = [L(1, '2025-12-20', 'marco', 60), L(2, '2026-12-05', 'Marco ', 45), L(3, '2027-01-02', 'Marco', 50), L(4, '2027-01-02', 'Bea')];
  const d = studentDetail(ls, 'marco', '2027-01-10', 12);
  assert.equal(d.name, 'Marco'); assert.equal(d.totalMinutes, 155); assert.equal(d.lessonCount, 3);
  assert.equal(d.averageMinutes, 52); // 51.67 → 52
  assert.equal(d.firstLesson, '2025-12-20'); assert.equal(d.lastLesson, '2027-01-02');
  assert.deepEqual(d.lastSixMonths.map(m => m.month), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
  assert.equal(d.thisSeasonMinutes, 95); assert.equal(d.lastSeasonMinutes, 60);
  assert.deepEqual(d.months.map(m => [m.month, m.minutes]), [['2027-01', 50], ['2026-12', 45], ['2025-12', 60]]);
  assert.equal(studentDetail(ls, 'nobody', '2027-01-10', 12), null);
});

test('season welcome only when a new season really begins', () => {
  const ls = [L(1, '2025-12-20', 'A', 60, '2026-01-01'), L(2, '2026-01-05', 'b', 30), L(3, '2026-01-06', 'B', 30)];
  assert.equal(seasonWelcome(ls, '2026-12-01', 12, null), null);
  assert.equal(seasonWelcome(ls, '2026-12-01', 12, 2026), null);
  assert.equal(seasonWelcome([], '2026-12-01', 12, 2025), null);
  const w = seasonWelcome(ls, '2026-12-01', 12, 2025);
  assert.deepEqual([w.minutes, w.lessonCount, w.students, w.unpaidMonths], [120, 3, 2, 1]);
});
