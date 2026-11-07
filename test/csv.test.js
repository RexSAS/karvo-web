import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessonsToCsv, parseLessonsCsv, durationHoursText, csvFileBytes, csvFileName, BackupFormatError } from '../domain/csv.js';

const anna = { id: 1, date: '2026-01-05', student: 'Anna', durationMinutes: 50, notes: null, paidOn: null };
const H = 'date,student,duration_minutes,duration_hours,notes,paid_on';

test('export matches the Android format', () =>
  assert.equal(lessonsToCsv([anna]), `${H}\r\n2026-01-05,Anna,50,0.83,,\r\n`));

test('export sorts by date then id', () => {
  const csv = lessonsToCsv([{ ...anna, id: 3, date: '2026-02-01' }, { ...anna, id: 2 }, anna]);
  assert.deepEqual(parseLessonsCsv(csv).map(l => l.date), ['2026-01-05', '2026-01-05', '2026-02-01']);
});

test('duration hours text', () => {
  assert.equal(durationHoursText(90), '1.5');
  assert.equal(durationHoursText(60), '1');
  assert.equal(durationHoursText(1), '0.02');
});

test('file name and BOM', () => {
  assert.equal(csvFileName('2026-11-07'), 'karvo-lessons-2026-11-07.csv');
  assert.deepEqual([...csvFileBytes('a').slice(0, 4)], [0xef, 0xbb, 0xbf, 0x61]);
});

test('notes with commas, quotes and line breaks round-trip', () => {
  const l = { ...anna, notes: 'a, "b"\nc', paidOn: '2026-02-01' };
  const [back] = parseLessonsCsv(lessonsToCsv([l]));
  assert.deepEqual(back, { date: l.date, student: 'Anna', durationMinutes: 50, notes: 'a, "b"\nc', paidOn: '2026-02-01' });
});

test('BOM and old 5-column header are accepted', () => {
  const [l] = parseLessonsCsv('﻿date,student,duration_minutes,duration_hours,notes\n2026-01-05,Anna,60,1,\n');
  assert.equal(l.paidOn, null);
  assert.equal(l.notes, null);
});

test('not a Karvo file', () => {
  assert.throws(() => parseLessonsCsv('date;student;duration_minutes\r\n2026-01-05;Anna;60\r\n'),
    e => e instanceof BackupFormatError && e.line === 1 && e.message === 'Line 1: Not a Karvo file');
});

test('bad row names its line and nothing is returned', () => {
  assert.throws(() => parseLessonsCsv(`${H}\r\n2026-01-05,Anna,60,1,,\r\n2026-01-06,Anna,0,0,,\r\n`),
    e => e.line === 3 && e.message === 'Line 3: Invalid duration "0"');
  assert.throws(() => parseLessonsCsv(`${H}\r\n2026-13-05,Anna,60,1,,\r\n`), e => e.message === 'Line 2: Invalid date "2026-13-05"');
  assert.throws(() => parseLessonsCsv(`${H}\r\n2026-01-05, ,60,1,,\r\n`), e => e.message === 'Line 2: Missing student');
  assert.throws(() => parseLessonsCsv(`${H}\r\n2026-01-05,A,60,1,\r\n`), e => e.message === 'Line 2: Expected 6 fields, found 5');
  assert.throws(() => parseLessonsCsv(`${H}\r\n2026-01-05,A,60,1,,x\r\n`), e => e.message === 'Line 2: Invalid paid date "x"');
});

test('a quoted line break moves the next record line number', () =>
  assert.throws(() => parseLessonsCsv(`${H}\r\n2026-01-05,A,60,1,"x\ny",\r\n2026-01-05,A,abc,1,,\r\n`), e => e.line === 4));
