import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLesson } from '../domain/validate.js';

test('blank student and zero duration', () => assert.deepEqual(validateLesson(' ', 0, 0), ['DurationZero', 'StudentBlank']));
test('over 24 hours', () => assert.deepEqual(validateLesson('A', 24, 1), ['DurationTooLong']));
test('minutes over 59', () => assert.deepEqual(validateLesson('A', 0, 60), ['MinutesOver59']));
test('exactly 24 hours is valid', () => assert.deepEqual(validateLesson('A', 24, 0), []));

import { parseDurationField } from '../domain/validate.js';
test('duration fields accept whole numbers only', () => {
  assert.equal(parseDurationField('2'), 2);
  assert.equal(parseDurationField(''), 0);
  for (const s of ['0.01', '7.5', '-30', 'abc']) assert.ok(Number.isNaN(parseDurationField(s)), s);
});
