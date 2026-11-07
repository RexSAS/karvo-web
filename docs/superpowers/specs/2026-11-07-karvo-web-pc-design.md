# Karvo Web (PC) — design

Date: 2026-11-07 · Status: draft for review · Repo: `RexSAS/karvo-web` · Live: https://karvo.rxsas.it

## Purpose

Karvo is a private app for ski instructors to log lesson hours and see what the school owes them. The
Android app is the master copy of the data. This web app is the **PC companion**: a big-screen view of the
same lessons, used as a **remote control** for the phone while linked, and as a **read-only backup** when not.

The work is split in two projects:

1. **This spec:** the web app itself, with its data behind one interface, running on demo data and on a
   local backup copy (CSV import).
2. **Next spec:** the phone link (WebRTC + Android side) that plugs into the same interface. Summarised at
   the end so this design leaves room for it; not built here.

## Decisions (agreed in chat)

- PC only for now; iPhone layout later. No moments. No biometric lock.
- **Phone is master, PC is remote.** While linked, every change made on the PC is sent to the phone, the
  phone saves it, and the PC redraws from the data the phone sends back. The UI never changes data itself.
- **PC keeps a backup copy** of the last data received, in the browser. When no phone is linked the app
  opens that copy **read-only** (view, statistics, CSV export).
- **No server holds lesson data.** Static site on GitHub Pages.
- Look and layout follow the approved mockup (commit `32fecad`, currently live as the homepage).

## Technology

- Plain HTML, CSS and JavaScript ES modules, no build step, no dependencies. Push to `main` deploys.
- Tests: `node --test` on the `domain/` modules (Node built-in runner, nothing to install).
- Browser storage: IndexedDB for the backup copy (one record holding the whole snapshot), with
  `navigator.storage.persist()` requested on first save.
- Money is integer cents everywhere. Dates are `YYYY-MM-DD` strings (local calendar dates, no time zone).

## File layout

```
index.html            app shell (the mockup is replaced)
styles.css            Alpine Night tokens + layout
app.js                starts splash, picks the source, wires UI to source
domain/               pure logic, no DOM, no storage — mirrors the Android rules
  earnings.js  seasons.js  stats.js  paid.js  csv.js  importPlan.js  validate.js
source/
  demo.js             in-memory fake data (the mockup generator)
  backup.js           read-only snapshot in IndexedDB; filled by CSV import
ui/
  splash.js  lessons.js  calendar.js  overview.js  stats.js  lessonDialog.js  settings.js  money.js  banner.js
test/                 *.test.js for domain/
```

## Data

```js
// Lesson, same fields as the Android Room entity
{ id: number, date: 'YYYY-MM-DD', durationMinutes: number, student: string, notes: string|null, paidOn: 'YYYY-MM-DD'|null }

// Snapshot: what a source delivers to the UI
{ lessons: Lesson[], rateCents: number|null, seasonStartMonth: 1..12, syncedAt: ISO string|null }
```

## Domain rules (must match Android exactly)

| Rule | Android source | Behaviour |
|---|---|---|
| Earnings | `Earnings.kt` | `earningsCents = floor((minutes * rateCents + 30) / 60)`; no rate → money shows "Set a rate" |
| Validation | `LessonValidation.kt` | student not blank; total minutes 1–1440; minutes field ≤ 59 |
| Season | `Seasons.kt` | 12 months from the 1st of `seasonStartMonth` (default 11); label "2025/26", or "2026" when it starts in January |
| Paid status | `Paid.kt` | per month: UNPAID (none paid), PARTLY_PAID, PAID (all paid) |
| Mark paid | `LessonDao.markPaid` | gives unpaid lessons of the month the chosen paid date; already paid keep theirs |
| Mark unpaid | `LessonDao.markUnpaid` | clears paid date on every lesson of the month |
| Unpaid total | `Paid.kt unpaidTotals` | unpaid lessons dated up to today (future lessons not owed); months count, minutes, cents |
| Students | `Stats.kt` | matched ignoring case and surrounding spaces |
| CSV export | `CsvExporter.kt` | UTF-8 BOM, CRLF, header `date,student,duration_minutes,duration_hours,notes,paid_on`, sorted by date then id, RFC 4180 quoting, `duration_hours` = minutes/60 to 2 decimals half-up without trailing zeros, file `karvo-lessons-YYYY-MM-DD.csv` |
| CSV import | `CsvImporter.kt` | accepts the 6-column header and the pre-2.1 5-column one (lessons come back unpaid); optional BOM; all-or-nothing, error names the line |
| Import duplicates | `ImportPlan.kt` | duplicate = same date, duration and student (case/space-insensitive), counted per copy; notes and paid dates not compared; result "added N, skipped M" |

Each rule gets unit tests, using the same cases as the Android tests where they exist.

## Source interface

Every source implements:

```js
subscribe(onSnapshot)        // called now and on every change; returns unsubscribe
status                       // 'demo' | 'backup' | (project 2) 'linked'
canEdit                      // true for demo and linked, false for backup
addLesson(lesson) updateLesson(lesson) deleteLesson(id)
markPaid(month 'YYYY-MM', paidOn) markUnpaid(month)
setRate(cents|null) setSeasonStart(month)
importCsv(text) → { added, skipped }   // backup: fills the copy; linked: sent to the phone
```

- **demo:** in-memory, editable, resets on reload. Opened with `?demo`. Shows a "Demo data" banner.
- **backup:** reads/writes one snapshot in IndexedDB. Read-only for lesson edits, but **CSV import is
  allowed** so the copy can be filled without a phone in this project. Rate and season start are editable
  locally while no phone link exists (project 2 makes the phone's values win).
- With no backup and no `?demo`, the app shows an empty state: "Link your phone (coming soon) · Import CSV ·
  Try demo".

## Screens (from the mockup)

- **Splash:** logo animation 0.8 s then fade; skipped with reduced motion. Once per page load.
- **Header:** logo, name, status banner area, Settings gear.
- **Banner:** demo → "Demo data · nothing is saved"; backup → "Phone not connected · last synced <relative
  time> · Read only"; storage warning when IndexedDB fails.
- **Lessons (left):** selected month, newest first, grouped by day; selected day highlighted. Click a lesson
  → edit dialog. "+ Add lesson" (disabled when read-only, tooltip "Link your phone to edit").
- **Lesson dialog:** date, student (autocomplete from existing students), hours + minutes, notes. Edit mode
  adds Delete with confirm. Validation messages as Android.
- **Calendar (centre):** month grid, hours per day, intensity tint, today ring, click day selects it,
  prev/next/Today, month paid badge (Paid / Partly paid / Unpaid).
- **Overview (right):** Hours, Earned (with eye), This month status + Mark paid (asks the paid date, default
  today) / Mark unpaid, Lessons + students, Unpaid total and list of unpaid months (click → open month).
- **Statistics (bottom):** for the selected month's season — hours-per-month line (stops at today), top
  students donut (top 4 + Other, palette `#3D9BE9 #BE8128 #9B6FE0 #1E9E7C`, Other `#3A4A66`), weekday columns.
  Hover tooltips; click a month point to open it.
- **Hidden money:** every amount shows `€ ••••` (fixed length) until the eye is pressed; fades in on reveal.
  Hidden again on each page load, like Android.
- **Settings dialog:** hourly rate, season start month, Import CSV, Export CSV, "Delete backup from this PC"
  (confirm).
- Layout fills the window; only section contents scroll. Target ≥ 1280 px wide.

## Errors

- CSV import: all-or-nothing; message "Line N: <reason>"; nothing changes on error.
- IndexedDB unavailable or quota hit: banner warning, app keeps working in memory, suggests Export CSV.
- Read-only mode: edit controls disabled, not hidden, with the tooltip above.

## Testing

- `node --test` for every domain rule in the table, including rounding edges, season boundaries, CSV
  quoting/BOM/old header, duplicate counting.
- Manual check in Chrome and Firefox: demo flows, CSV round trip with a real export from the Android app,
  reload keeps the backup, read-only disables editing.

## Out of scope here

Phone link, iPhone/phone layout, PWA install/offline, moments, biometric lock, multiple languages (English
only for now; Android has Italian — revisit later).

## Project 2 preview (separate spec)

WebRTC data channel via PeerJS signalling. PC shows a QR; Karvo on the phone scans it. The phone sends full
snapshots; the PC sends commands matching the source interface; the phone applies them to Room and replies
with a new snapshot, which the PC also saves as its backup. If the phone has no lessons and the PC has a
backup, the PC offers "Restore N lessons to the phone" with confirm. A foreground notification keeps the link
alive while the phone screen is off. Adds `source/linked.js`; UI unchanged.
