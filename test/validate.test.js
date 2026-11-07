import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLesson } from '../domain/validate.js';

test('blank student and zero duration', () => assert.deepEqual(validateLesson(' ', 0, 0), ['DurationZero', 'StudentBlank']));
test('over 24 hours', () => assert.deepEqual(validateLesson('A', 24, 1), ['DurationTooLong']));
test('minutes over 59', () => assert.deepEqual(validateLesson('A', 0, 60), ['MinutesOver59']));
test('exactly 24 hours is valid', () => assert.deepEqual(validateLesson('A', 24, 0), []));
