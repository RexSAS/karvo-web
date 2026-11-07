// Picking a CSV from disk and downloading one.
import { lessonsToCsv, csvFileBytes, csvFileName } from '../domain/csv.js';
import { today } from '../domain/dates.js';

export function pickTextFile(accept = '.csv,text/csv') {
  return new Promise(resolve => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () => input.files[0] ? input.files[0].text().then(resolve) : resolve(null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function downloadCsv(lessons) {
  const url = URL.createObjectURL(new Blob([csvFileBytes(lessonsToCsv(lessons))], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: csvFileName(today()) }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
