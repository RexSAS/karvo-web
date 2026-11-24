import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateTest, ratesOf, pay, payOf, saveRate, setDefaultRate, deleteRate, normalizeRates, rateCss } from '../domain/rates.js';
import { lessonsToCsv, parseLessonsCsv } from '../domain/csv.js';

const l = (id, minutes, rateId = null) => ({ id, date: '2026-12-0' + id, student: 'A', durationMinutes: minutes, notes: null, paidOn: null, rateId });
const two = { lessons: [l(1, 60), l(2, 30, 2), l(3, 60, 99)], rates: [
  { id: 1, title: 'Standard', cents: 2000, color: 0, isDefault: true }, { id: 2, title: 'Private', cents: 4000, color: 0, isDefault: false }] };

test('a snapshot from before rates has its one rate as the default "Standard"', () => {
  assert.deepEqual(ratesOf({ rateCents: 3000 }).map(r => [r.title, r.cents, r.isDefault]), [['Standard', 3000, true]]);
  assert.deepEqual(ratesOf({ rateCents: null }), []);
  assert.equal(normalizeRates({ lessons: [], rateCents: 3000 }).rates.length, 1);
});

test('each lesson is paid at its own rate; gone rates and no rate use the default; no rates hides earnings', () => {
  assert.equal(payOf(two).earnings(two.lessons), 2000 + 2000 + 2000);
  assert.equal(pay([]).earnings(two.lessons), null);
  assert.equal(pay([{ id: 1, title: 'S', cents: 2550, isDefault: true }]).earnings([l(1, 50)]), Math.floor((50 * 2550 + 30) / 60));
});

test('the first rate is the default; editing keeps the flag; invalid rates are refused', () => {
  let s = saveRate({ lessons: [], rates: [] }, { title: ' Standard ', cents: 3000, color: 1 });
  s = saveRate(s, { title: 'Private', cents: 4500, color: 2 });
  assert.deepEqual(s.rates.map(r => [r.id, r.title, r.isDefault]), [[1, 'Standard', true], [2, 'Private', false]]);
  assert.equal(s.rateCents, 3000);
  s = saveRate(s, { id: 1, title: 'Standard', cents: 3200, color: 1, isDefault: false });
  assert.deepEqual([s.rates[0].cents, s.rates[0].isDefault, s.rateCents], [3200, true, 3200]);
  assert.equal(saveRate(s, { title: '', cents: 100, color: 1 }), null);
  assert.equal(saveRate(s, { title: 'X', cents: 0, color: 1 }), null);
  assert.equal(saveRate(s, { id: 9, title: 'X', cents: 100, color: 1 }), null);
  assert.equal(saveRate(s, { title: 'private', cents: 100, color: 1 }), null); // the name is taken
  assert.ok(saveRate(s, { id: 2, title: 'PRIVATE', cents: 100, color: 1 })); // its own name
});

test('a new default keeps what old lessons earn; deleting moves lessons to the default; the default goes last', () => {
  let s = setDefaultRate(two, 2);
  assert.deepEqual(s.rates.map(r => r.id), [2, 1]);
  assert.equal(s.lessons[0].rateId, 1); // was "the default": pinned to the old one
  assert.equal(payOf(s).earnings(s.lessons), payOf(two).earnings(two.lessons) - 2000 + 4000); // the gone rate (99) now follows the new default
  assert.equal(deleteRate(s, 2), null);
  s = deleteRate(s, 1);
  assert.deepEqual(s.lessons.map(x => x.rateId), [2, 2, 99]);
  s = deleteRate(s, 2);
  assert.deepEqual([s.rates, s.rateCents, payOf(s).isSet], [[], null, false]);
});

test('CSV keeps each lesson\'s rate by title, ignoring case; unknown titles are the default', () => {
  const p = payOf(two), csv = lessonsToCsv(two.lessons, p.titleOf);
  assert.deepEqual(parseLessonsCsv(csv, p.idOfTitle).map(x => x.rateId), [1, 2, 1]);
  assert.deepEqual(parseLessonsCsv(csv.replace('Private', 'PRIVATE'), p.idOfTitle).map(x => x.rateId), [1, 2, 1]);
  assert.deepEqual(parseLessonsCsv(csv.replace('Private', 'Gone'), p.idOfTitle).map(x => x.rateId), [1, null, 1]);
});

test('colours: the phone\'s ARGB ints become CSS hex', () => assert.equal(rateCss(0xFF4FA3E0 | 0), '#4fa3e0'));

test('the rate filter keeps one rate\'s lessons (gone rates count as the default)', async () => {
  const { filterLessons } = await import('../domain/stats.js');
  const p = payOf(two);
  assert.deepEqual(filterLessons(two.lessons, '', null, rateTest(p, 1)).map(l => l.id), [1, 3]);
  assert.deepEqual(filterLessons(two.lessons, '', null, rateTest(p, 2)).map(l => l.id), [2]);
  assert.equal(rateTest(p, 99), null);
  assert.equal(rateTest(p, null), null);
});
