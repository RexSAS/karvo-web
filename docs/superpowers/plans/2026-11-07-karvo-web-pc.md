# Karvo Web (PC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mockup at karvo.rxsas.it with the real PC web app: Android-exact lesson logic, a demo source and a read-only IndexedDB backup source filled by CSV import, and the approved UI.

**Architecture:** Pure `domain/` modules (tested with `node --test`) mirror the Android rules. A `source/` object delivers snapshots to the UI through one interface (`subscribe`, edit commands, `canEdit`). `ui/` modules render from snapshots and send commands; they never mutate data themselves.

**Tech Stack:** Plain HTML/CSS/JS ES modules, no build, no dependencies. Node 22 built-in test runner. IndexedDB. GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-07-karvo-web-pc-design.md`

## Global Constraints

- No dependencies, no build step; every file is served as-is by GitHub Pages from `main`.
- Money is integer cents; dates are `'YYYY-MM-DD'` strings; months are `'YYYY-MM'` strings. Never use `Date` for date math across time zones: build local dates with `new Date(y, m - 1, d)` only inside helpers.
- `earningsCents = Math.floor((minutes * rateCents + 30) / 60)`; `rateCents === null` → UI shows "Set a rate", never `NaN`/`€0`.
- Lesson rules: student not blank (trimmed); total minutes 1–1440; minutes field ≤ 59.
- Season = 12 months from the 1st of `seasonStartMonth` (default `11`); label `"2025/26"`, or `"2026"` when start month is 1.
- CSV header `date,student,duration_minutes,duration_hours,notes,paid_on`; old header `date,student,duration_minutes,duration_hours,notes`; UTF-8 BOM; CRLF; file `karvo-lessons-YYYY-MM-DD.csv`.
- Colours (Alpine Night): bg `#0B1220`, primary `#7CC4FA`, on-primary `#04223A`, primary-container `#1B3A5C`, gold `#F2C879`, ink `#E6ECF5`, muted `#9AA8BD`, outline `#3A4A66`, line `#2A3852`. Donut palette `#3D9BE9 #BE8128 #9B6FE0 #1E9E7C`, Other `#3A4A66`.
- Hidden money text is exactly `€ ••••`; hidden on every page load.
- Read-only tooltip copy: `Link your phone to edit`.
- English UI copy only.

## Review Focus

1. A CSV saved by Excel with `;` separators or a changed header → "Line 1: Not a Karvo file", nothing imported (test in Task 4).
2. Notes containing commas, quotes or line breaks survive export → import unchanged (test in Task 4).
3. Lessons dated after today are not counted in the unpaid total but still show in the month (test in Task 3).
4. Same student typed as `"marco "` and `"Marco"` is one student in stats and autocomplete, shown with the most recent spelling (test in Task 3).
5. Importing the same CSV twice adds 0 and skips all; two identical lessons on one day in the file are both kept on first import (test in Task 4).

---

### Task 1: Scaffold, earnings and validation

**Files:**
- Create: `package.json`, `domain/earnings.js`, `domain/validate.js`, `domain/dates.js`
- Test: `test/earnings.test.js`, `test/validate.test.js`, `test/dates.test.js`

**Interfaces:**
- Produces:
  - `earningsCents(minutes: number, rateCents: number|null): number|null`
  - `formatEuro(cents: number): string` → `"€1,275"` (whole euros, `en` grouping) and `"€12.50"` when cents ≠ 0
  - `formatHours(minutes: number): string` → `"2 h"`, `"1.5 h"`, `"0 h"`, `"1 h 20"` for non-half minutes
  - `validateLesson(student: string, hours: number, minutes: number): string[]` → subset of `['StudentBlank','DurationZero','DurationTooLong','MinutesOver59']`
  - `dates.js`: `monthOf(date) → 'YYYY-MM'`, `today() → 'YYYY-MM-DD'` (local), `addMonths(month, n) → 'YYYY-MM'`, `weekdayIndex(date) → 0..6` (Mon = 0), `daysInMonth(month)`, `calendarDays(month) → 42 dates starting Monday`

- [ ] **Step 1:** `package.json` = `{ "type": "module", "private": true, "scripts": { "test": "node --test" } }`.
- [ ] **Step 2: Write failing tests**
  - `earningsCents(60, 3000) === 3000`; `earningsCents(1, 3000) === 50`; `earningsCents(1, 1) === 0` (0.0166 → 0); `earningsCents(1, 30) === 1` (0.5 → rounds up); `earningsCents(90, 3333) === 5000` (4999.5 → 5000); `earningsCents(100, null) === null`.
  - `validateLesson(' ', 0, 0)` deep-equals `['DurationZero','StudentBlank']` (order as Android: MinutesOver59, DurationZero, DurationTooLong, StudentBlank); `validateLesson('A', 24, 1)` → `['DurationTooLong']`; `validateLesson('A', 0, 60)` → `['MinutesOver59']`; `validateLesson('A', 24, 0)` → `[]`.
  - `formatHours(120) === '2 h'`, `formatHours(90) === '1.5 h'`, `formatHours(80) === '1 h 20'`.
  - `calendarDays('2026-11')[0] === '2026-10-26'` and length 42; `weekdayIndex('2026-11-07') === 5`; `addMonths('2026-01', -1) === '2025-12'`.
- [ ] **Step 3:** Run `npm test` → FAIL (modules missing).
- [ ] **Step 4:** Implement the three modules.
- [ ] **Step 5:** Run `npm test` → all PASS.
- [ ] **Step 6:** Commit `feat: domain earnings, validation and date helpers`.

### Task 2: Seasons

**Files:**
- Create: `domain/seasons.js`
- Test: `test/seasons.test.js`

**Interfaces:**
- Consumes: `dates.js`
- Produces: `seasonOf(date, startMonth) → { startYear, startMonth }`; `seasonMonths(season) → 12 'YYYY-MM'`; `seasonLabel(season) → string`; `inSeason(date, season) → boolean`

- [ ] **Step 1: Write failing tests**
  - `seasonOf('2026-11-01', 11)` → `{startYear: 2026, startMonth: 11}`; `seasonOf('2026-10-31', 11)` → startYear 2025.
  - `seasonLabel({startYear: 2025, startMonth: 11}) === '2025/26'`; `seasonLabel({startYear: 2026, startMonth: 1}) === '2026'`; `seasonLabel({startYear: 2099, startMonth: 11}) === '2099/00'`.
  - `seasonMonths({2025, 11})[0] === '2025-11'`, `[11] === '2026-10'`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: domain seasons`.

### Task 3: Paid status, unpaid totals, statistics

**Files:**
- Create: `domain/paid.js`, `domain/stats.js`
- Test: `test/paid.test.js`, `test/stats.test.js`

**Interfaces:**
- Consumes: `earningsCents`, `monthOf`, `weekdayIndex`, `seasonMonths`, `inSeason`
- Produces:
  - `paidStatus(lessons) → 'UNPAID'|'PARTLY_PAID'|'PAID'` (empty → `'UNPAID'`)
  - `monthPaidOn(lessons) → 'YYYY-MM-DD'|null` (latest `paidOn`)
  - `markPaid(lessons, month, paidOn) → Lesson[]` (new array; only unpaid lessons in `month` get `paidOn`)
  - `markUnpaid(lessons, month) → Lesson[]` (all lessons in `month` → `paidOn: null`)
  - `unpaidTotals(lessons, today, rateCents) → { months: number, minutes: number, earningsCents: number|null, byMonth: [{ month, minutes, earningsCents }] }` (oldest first)
  - `studentKey(name) → name.trim().toLowerCase()`
  - `students(lessons) → [{ name, minutes }]` (one per key, `name` = trimmed spelling of the latest lesson by date then id; sorted minutes desc, then name)
  - `seasonStats(lessons, season, rateCents) → { minutes, lessonCount, perMonth: [{ month, minutes }] (12), top: [{ name, minutes }] (≤ 4) , otherMinutes, weekdayMinutes: number[7] }`

- [ ] **Step 1: Write failing tests**
  - `paidStatus([])==='UNPAID'`; one of two paid → `'PARTLY_PAID'`.
  - `markPaid` keeps an existing `paidOn` (`'2026-01-10'` stays) and sets `'2026-02-01'` on the other lesson of `'2026-01'`; lessons of `'2026-02'` untouched; input array not mutated.
  - Review Focus 3: `unpaidTotals` with an unpaid lesson on `'2026-11-20'` and today `'2026-11-07'` → `minutes` excludes it, `months === 0` when it is the only one.
  - Review Focus 4: `students` of `[{student:'marco ', date:'2026-01-01'}, {student:'Marco', date:'2026-02-01'}]` → length 1, `name === 'Marco'`, minutes summed.
  - `seasonStats` with 6 students → `top.length === 4`, `otherMinutes` = sum of the other 2; `weekdayMinutes[5]` holds a Saturday lesson's minutes; a lesson outside the season is ignored.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: domain paid status, unpaid totals and statistics`.

### Task 4: CSV export/import and import plan

**Files:**
- Create: `domain/csv.js`, `domain/importPlan.js`
- Test: `test/csv.test.js`, `test/importPlan.test.js`

**Interfaces:**
- Produces:
  - `lessonsToCsv(lessons) → string` (header + rows, CRLF, sorted by date then id)
  - `csvFileBytes(csv) → Uint8Array` (BOM `EF BB BF` + UTF-8)
  - `csvFileName(today) → 'karvo-lessons-YYYY-MM-DD.csv'`
  - `durationHoursText(minutes) → string` (`Math.round(minutes * 100 / 60) / 100`, no trailing zeros — exact .5 can't occur, so plain rounding matches HALF_UP)
  - `parseLessonsCsv(text) → Lesson[]` without ids; throws `BackupFormatError { line, message }` with messages `Not a Karvo file`, `Expected N fields, found M`, `Invalid date "x"`, `Missing student`, `Invalid duration "x"`, `Invalid paid date "x"`
  - `planImport(existing, incoming) → { toAdd: Lesson[], skipped: number }`

- [ ] **Step 1: Write failing tests**
  - Export of one lesson `{date:'2026-01-05', student:'Anna', durationMinutes:50, notes:null, paidOn:null}` equals `'date,student,duration_minutes,duration_hours,notes,paid_on\r\n2026-01-05,Anna,50,0.83,,\r\n'`.
  - `durationHoursText(90) === '1.5'`, `(60) === '1'`, `(1) === '0.02'`.
  - Review Focus 2: notes `'a, "b"\nc'` round-trips through `parseLessonsCsv(lessonsToCsv(x))` unchanged.
  - BOM prefix accepted; old 5-column header → lessons with `paidOn: null`.
  - Review Focus 1: text `'date;student;duration_minutes\r\n...'` throws with `line === 1`, message `Not a Karvo file`.
  - Row with duration `0` on line 3 → throws `line === 3`, `Invalid duration "0"`; nothing returned.
  - Review Focus 5: `planImport(existing=[A], incoming=[A', A'])` where A' matches A ignoring case/spaces → `toAdd.length === 1`, `skipped === 1`; `planImport([], [A, A])` → 2 added; importing the result again → 0 added.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement; the tokenizer is RFC 4180 (quoted fields hold commas, `""`, line breaks; CRLF, CR or LF end a record; a record's line = line it starts on; blank trailing line ignored).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: domain CSV export/import and import plan`.

### Task 5: Sources (demo + backup)

**Files:**
- Create: `source/core.js`, `source/demo.js`, `source/backup.js`, `source/idbStore.js`
- Test: `test/sources.test.js`

**Interfaces:**
- Consumes: `markPaid`, `markUnpaid`, `parseLessonsCsv`, `planImport`
- Produces:
  - `createSource({ status, canEdit, initial: Snapshot, save?: (Snapshot) => Promise<void> })` in `core.js` → object with `status`, `canEdit`, `subscribe(fn) → unsubscribe`, `addLesson(l)`, `updateLesson(l)`, `deleteLesson(id)`, `markPaid(month, paidOn)`, `markUnpaid(month)`, `setRate(cents|null)`, `setSeasonStart(month)`, `importCsv(text) → Promise<{added, skipped}>`, `clear() → Promise<void>`. Edit commands reject with `Error('read-only')` when `!canEdit`. Each change builds a new snapshot, calls `save` (if any), then notifies subscribers. New ids = max id + 1.
  - `createDemoSource()` → `createSource({status:'demo', canEdit:true, initial: demo data})`; demo generator moved from the mockup (seed 7, same distribution, today = real today).
  - `createBackupSource(store)` → `createSource({status:'backup', canEdit:false, ...})`; `importCsv`, `setRate`, `setSeasonStart`, `clear` allowed even when read-only; `syncedAt` set on import.
  - `idbStore`: `openStore() → Promise<{ load(): Promise<Snapshot|null>, save(Snapshot), remove() }>`; DB `karvo`, object store `snapshot`, key `'current'`; calls `navigator.storage?.persist?.()` on first save; rejects if IndexedDB is unavailable.

- [ ] **Step 1: Write failing tests** (with an in-memory fake store `{ data, load, save, remove }`)
  - Demo: `addLesson` notifies subscriber with the new lesson and a fresh id.
  - Backup: `addLesson` rejects `'read-only'`; `importCsv` of a 2-row CSV → `{added: 2, skipped: 0}`, fake store's saved snapshot has 2 lessons and `syncedAt` set; second identical import → `{added: 0, skipped: 2}`.
  - Invalid CSV → rejects with `BackupFormatError`, store unchanged.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: demo and backup sources`.

### Task 6: App shell, splash, banner, hidden money

**Files:**
- Create: `styles.css`, `app.js`, `ui/splash.js`, `ui/banner.js`, `ui/money.js`, `ui/empty.js`
- Modify: `index.html` (replace the mockup with the shell: header, four section containers, banner slot, dialog roots)

**Interfaces:**
- Consumes: sources from Task 5
- Produces:
  - `app.js` state: `{ snapshot, view: 'YYYY-MM', selDay: 'YYYY-MM-DD'|null, showMoney: false, source }`; `setState(patch)` re-renders all panels via `render(state)` exports of each `ui/*` module.
  - `ui/money.js`: `moneyHtml(cents|null)` → `<span class="money" data-v="…">`; `paintMoney(show)`; `null` cents → `Set a rate`.
  - `ui/banner.js`: `renderBanner(el, { status, syncedAt, storageError })` with the spec's three texts; relative time via `Intl.RelativeTimeFormat('en')`.
  - `ui/empty.js`: empty state with buttons `Link your phone (coming soon)` (disabled), `Import CSV`, `Try demo` (→ `?demo`).
- Source choice: `?demo` → demo; else `openStore()` → backup (snapshot or empty state); `openStore` failure → in-memory backup source + `storageError` banner.

- [ ] **Step 1:** Move CSS tokens/layout and splash from the mockup into `styles.css`/`ui/splash.js`; panels render placeholders.
- [ ] **Step 2:** Verify: `python3 -m http.server 8000` then open `http://localhost:8000/?demo` → splash plays, header + banner "Demo data · nothing is saved", four empty sections, no page scroll at 1440×900; `http://localhost:8000/` with no data → empty state.
- [ ] **Step 3:** Commit `feat: app shell, splash, banner and money display`.

### Task 7: Calendar, lesson list, lesson dialog

**Files:**
- Create: `ui/calendar.js`, `ui/lessons.js`, `ui/lessonDialog.js`

**Interfaces:**
- Consumes: `calendarDays`, `formatHours`, `paidStatus`, `validateLesson`, `students`, state from Task 6
- Produces: `renderCalendar(el, state, actions)`, `renderLessons(el, state, actions)`, `openLessonDialog({ lesson?, defaultDate, studentNames, onSave, onDelete })`; `actions` = `{ setView(month), selectDay(date), edit(lesson), add() }`

- [ ] **Step 1:** Calendar as in mockup (hours per day, intensity tint, today ring, selection, prev/next/Today) plus badge `Paid` / `Partly paid` / `€ unpaid` from `paidStatus` of the month.
- [ ] **Step 2:** Lesson list as in mockup; rows are buttons opening the dialog; notes shown as a muted second line when present. "+ Add lesson" and rows disabled with `title="Link your phone to edit"` when `!source.canEdit` (rows still open the dialog in view-only mode with inputs disabled).
- [ ] **Step 3:** Dialog: date, student (datalist from `students()`), hours + minutes, notes; shows `validateLesson` errors inline (`Enter a student`, `Duration can't be 0`, `Max 24 hours`, `Minutes must be 0–59`); Delete asks `Delete this lesson?`.
- [ ] **Step 4:** Verify in `?demo`: add a lesson with notes → appears in list and calendar; edit duration → calendar hours update; delete → gone; invalid input blocks Save. In backup mode, Add is disabled with the tooltip.
- [ ] **Step 5:** Commit `feat: calendar, lesson list and lesson dialog`.

### Task 8: Overview and month payment

**Files:**
- Create: `ui/overview.js`

**Interfaces:**
- Consumes: `earningsCents`, `paidStatus`, `monthPaidOn`, `unpaidTotals`, `moneyHtml`
- Produces: `renderOverview(el, state, actions)`; `actions.markPaid(month)` opens a small date dialog (default today) then calls `source.markPaid`; `actions.markUnpaid(month)` confirms `Mark <Month> as unpaid?`.

- [ ] **Step 1:** Implement: Hours, Earned + eye, This month (`Unpaid · €X` + `Mark paid` / `Partly paid · €X` + `Mark paid` / `✓ Paid 28 Mar` + `Mark unpaid`), Lessons + student count, Unpaid total + list (click → open month). Buttons disabled in read-only.
- [ ] **Step 2:** Verify in `?demo`: Mark paid on a month → badge Paid, month leaves the unpaid list; add a lesson to that month → `Partly paid`; eye toggles all amounts; with rate cleared in Settings (Task 10) amounts show `Set a rate`.
- [ ] **Step 3:** Commit `feat: overview and month payment`.

### Task 9: Statistics charts

**Files:**
- Create: `ui/stats.js`

**Interfaces:**
- Consumes: `seasonOf`, `seasonLabel`, `seasonStats`
- Produces: `renderStats(el, state, actions)`; redraws on `resize`.

- [ ] **Step 1:** Port the three mockup charts (area line stopping at the current month, donut top 4 + Other, weekday columns) using `seasonStats`; title `Statistics · season <label> · <hours>`.
- [ ] **Step 2:** Verify in `?demo` on Feb 2026 and Nov 2026: charts match the mockup, tooltips show, clicking a month point opens that month, empty season shows `No lessons this season.`
- [ ] **Step 3:** Commit `feat: statistics charts`.

### Task 10: Settings, CSV import/export, release

**Files:**
- Create: `ui/settings.js`
- Delete: nothing else (the mockup is gone since Task 6)

**Interfaces:**
- Consumes: `lessonsToCsv`, `csvFileBytes`, `csvFileName`, source `setRate`, `setSeasonStart`, `importCsv`, `clear`
- Produces: `openSettings(state, source)`

- [ ] **Step 1:** Settings dialog: hourly rate (€, empty = no rate), season start month (select Jan–Dec), `Import CSV` (file input `.csv`; result `Added N lessons, skipped M duplicates` or `Line N: reason`), `Export CSV` (download via Blob of `csvFileBytes`), `Delete backup from this PC` (confirm `Delete all lessons stored on this PC? Your phone is not affected.`; backup mode only).
- [ ] **Step 2:** Verify: export from demo → re-import into backup mode (`/` after clearing) gives the same lessons; import a real CSV exported from the Android app (Settings → Export on the phone) and spot-check totals for one month against the phone; reload keeps the backup; Delete backup → empty state. Repeat the main flows in Firefox.
- [ ] **Step 3:** `npm test` → all PASS.
- [ ] **Step 4:** Commit `feat: settings with rate, season start and CSV import/export`, push, and confirm https://karvo.rxsas.it shows the empty state and `/?demo` the demo.
