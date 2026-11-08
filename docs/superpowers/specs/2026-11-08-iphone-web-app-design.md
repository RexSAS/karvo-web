# Karvo for iPhone (web app) — design

Date: 2026-11-08 · Status: approved in chat, written for review · Repo: `RexSAS/karvo-web` · Live: https://karvo.rxsas.it
Builds on: `2026-11-07-karvo-web-pc-design.md` (PC app), `2026-11-07-phone-link-design.md` (link; Android phone side shipped in Karvo 3.1).

## Purpose

iPhone users get Karvo as an installable web app (Home Screen), working like the Android app's core: their lessons live on
the iPhone, which is the master copy and can link to the PC web app exactly like Android does.

## Decisions (agreed in chat)

- Scope **A, the core**: Lessons, Overview (months, paid/unpaid, statistics), Settings (rate, season start, language
  EN/IT, CSV backup/import, Linked PCs, privacy policy), and the PC link with the iPhone as master.
  Not included: Moments, Face ID, Kevin. iPads keep the PC site.
- Runs **only from the Home Screen** (`navigator.standalone`); in a Safari tab the existing "Add Karvo to your Home
  Screen" instructions show instead (the "coming soon" text is removed).
- **Works offline** (service worker caches the app shell).
- **Backup reminders**: a backup = a CSV shared through the Share sheet (share completed) or a sync with a linked PC.
  After **2 days** without one: banner "Last backup N days ago · Back up now". After **5 days**: Karvo opens on a
  "Back up now" screen; "Remind me tomorrow" is allowed once in a row (then the screen can't be skipped).
- **Link only while open**: when the app is hidden (lock, app switch) the iPhone sends `bye` and closes; it reconnects
  when shown again.

## Architecture

```
manifest.webmanifest, icons/          Home Screen name, icon (Karvo logo), display standalone, theme #0B1220
sw.js                                 service worker: cache-first app shell (all static files), versioned cache name
ui/phone.js                           routing: android → Play screen; iphone in Safari → install instructions;
                                      iphone standalone → the iPhone app (ui/m/app.js)
ui/m/                                 iPhone UI (plain ES modules like the PC UI)
  app.js        tabs, state, source wiring, link lifecycle, reminders
  lessons.js    month-grouped list with totals, search, add/edit/delete sheet
  overview.js   totals + eye, months with paid/unpaid actions, unpaid total, season charts (reuse ui/stats.js drawers)
  settings.js   rate, season start, language, Back up now, Import CSV, Linked PCs, privacy link
  scan.js       camera (getUserMedia, rear) + vendor/jsQR.js decoding, returns the first karvo:link text
  i18n.js       EN/IT strings, copied from the Android app's strings.xml where the same texts exist
  backup.js     reminder state: lastBackupAt, lastPcSyncAt, snoozedOnce → 'none' | 'banner' | 'blocking'
source/local.js                      editable source on IndexedDB (createSource canEdit:true, status 'phone'),
                                      own DB key 'phone' so it never mixes with the PC backup snapshot
link/phoneSide.js                    phone role of the link: applies PC commands with the Android rules and answers
                                      ack + snapshot; used by the iPhone app and by tools/fake-phone.mjs
vendor/jsQR.js                       jsQR 1.4.0 (Apache-2.0), vendored unchanged + ES export
```

## Data

- Snapshot shape as the PC: `{ lessons, rateCents, seasonStartMonth, timeZoneId }`; `timeZoneId` = the iPhone's
  `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- IndexedDB `karvo`, store `snapshot`, keys `phone` (the iPhone's data), `pairings` (array of linked PCs:
  `{ roomId, secret, pcName, linkedAt }`), `meta` (`{ lastBackupAt, lastPcSyncAt, snoozedOnce, lang }`).
- `navigator.storage.persist()` requested on first save.

## Phone side of the link (link/phoneSide.js)

Same behaviour as Android `LinkCommandHandler` + `LinkClient` and the existing fake phone:
- ops `addLesson`, `updateLesson`, `deleteLesson`, `markPaid`, `markUnpaid`, `setRate`, `setSeasonStart`,
  `importLessons` (→ `{added, skipped}` via `planImport`), `restoreAll` (refused unless 0 lessons); unknown → refused.
- validation = `validateLesson` + date/paidOn shape + integer durations; refusal texts from i18n (EN/IT).
- after each change a `snapshot` to every connected PC; a received hello counts as a PC sync (`lastPcSyncAt`).
- one connection per linked PC while visible (`createConnection` with role `phone`); `visibilitychange` hidden → `stop()`
  (bye), visible → `start()`. Unlink (`Remove`) sends `unpaired` and deletes the room. Room gone (404) or `unpaired`
  from the PC → remove the pairing.
- Pairing: scan → "Link <PC>?" Allow / Deny → connect, wait 15 s for the PC hello → save the pairing; expired code →
  "This code expired. Make a new one on the PC."

## Errors

- IndexedDB unavailable: full-screen error "Karvo can't save on this iPhone" (no silent in-memory use on the phone).
- Command refused: `ack ok:false` with the reason (PC shows it).
- Camera denied: message + how to allow it in iOS Settings.
- Share sheet cancelled: not a backup; reminder stays.

## Testing

- `node --test`: `phoneSide` ops and refusals (port of the Android handler cases), backup reminder states (2/5 days,
  snooze once, PC sync counts), language strings complete in both languages, phone routing.
- Browser (CDP, Chrome emulating an iPhone with `navigator.standalone` forced true): add/edit/delete, paid months,
  settings, reminders, offline reload with the service worker; link an emulated iPhone to an emulated PC through the
  production relay (pair via injected QR text, edits both ways, restore into an empty iPhone, hide → PC read-only).
- Real-iPhone checks left to the user: Home Screen install, camera QR scan, Share sheet save to Files.
