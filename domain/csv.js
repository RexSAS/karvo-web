// Same format as Android CsvExporter.kt / CsvImporter.kt, so files move between phone and PC.
export const CSV_HEADER = 'date,student,duration_minutes,duration_hours,notes,paid_on';
const HEADER_V1 = 'date,student,duration_minutes,duration_hours,notes';
import { MAX_DURATION_MINUTES } from './validate.js';

export class BackupFormatError extends Error {
  constructor(line, reason) { super(`Line ${line}: ${reason}`); this.line = line; this.reason = reason; }
}

// minutes*100/60 never lands on exactly .5, so Math.round equals Android's HALF_UP here.
export const durationHoursText = minutes => String(Math.round(minutes * 100 / 60) / 100);
export const csvFileName = today => `karvo-lessons-${today}.csv`;
export const csvFileBytes = csv => new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(csv)]);

const field = v => /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;

export function lessonsToCsv(lessons) {
  const rows = [...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(l =>
    [l.date, l.student, String(l.durationMinutes), durationHoursText(l.durationMinutes), l.notes ?? '', l.paidOn ?? '']
      .map(field).join(','));
  return [CSV_HEADER, ...rows].map(r => r + '\r\n').join('');
}

const isDate = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number), u = new Date(Date.UTC(y, m - 1, d));
  return u.getUTCFullYear() === y && u.getUTCMonth() === m - 1 && u.getUTCDate() === d;
};

/** All-or-nothing: any invalid record throws BackupFormatError. Returned lessons have no id. */
export function parseLessonsCsv(text) {
  const records = tokenize(text.replace(/^﻿/, ''));
  const header = records[0]?.fields.join(',');
  const count = header === CSV_HEADER ? 6 : header === HEADER_V1 ? 5 : 0;
  if (!count) throw new BackupFormatError(1, 'Not a Karvo file');
  return records.slice(1).map(({ line, fields: f }) => {
    if (f.length !== count) throw new BackupFormatError(line, `Expected ${count} fields, found ${f.length}`);
    const [date, studentText, minutesText, , notesText] = f, paidOn = f[5] ?? '';
    if (!isDate(date)) throw new BackupFormatError(line, `Invalid date "${date}"`);
    const student = studentText.trim();
    if (!student) throw new BackupFormatError(line, 'Missing student');
    const minutes = /^\d+$/.test(minutesText) ? Number(minutesText) : NaN;
    if (!(minutes >= 1 && minutes <= MAX_DURATION_MINUTES)) throw new BackupFormatError(line, `Invalid duration "${minutesText}"`);
    if (paidOn && !isDate(paidOn)) throw new BackupFormatError(line, `Invalid paid date "${paidOn}"`);
    return { date, student, durationMinutes: minutes, notes: notesText.trim() || null, paidOn: paidOn || null };
  });
}

/** RFC 4180: quoted fields may hold commas, doubled quotes and line breaks; CRLF, CR or LF end a record. */
function tokenize(text) {
  const records = [];
  let fields = [], cur = '', line = 1, recordLine = 1, quoted = false;
  const end = () => { fields.push(cur); cur = ''; records.push({ line: recordLine, fields }); fields = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else { if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++; cur += c; }
    } else if (c === '"') quoted = true;
    else if (c === ',') { fields.push(cur); cur = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      end(); line++; recordLine = line;
    } else cur += c;
  }
  if (quoted) throw new BackupFormatError(recordLine, 'Unterminated quoted field');
  if (cur || fields.length) end();
  return records;
}
