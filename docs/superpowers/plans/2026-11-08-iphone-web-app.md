# Karvo for iPhone (web app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable iPhone web app at karvo.rxsas.it with the Android app's core (Lessons, Overview, Settings), its own data, backup reminders, and the PC link with the iPhone as master.

**Architecture:** Same repo and stack as the PC app. `ui/phone.js` routes standalone iPhones to `ui/m/app.js`; data in IndexedDB through an editable `source/local.js`; the link's phone role moves from `tools/fake-phone.mjs` into `link/phoneSide.js` (shared by the fake phone and the iPhone app); a service worker makes it work offline.

**Tech Stack:** Plain ES modules, no build; IndexedDB; Web Share API (files); getUserMedia + vendored jsQR 1.4.0; service worker; `node --test`; CDP Chrome emulation for checks.

**Spec:** `docs/superpowers/specs/2026-11-08-iphone-web-app-design.md`

## Global Constraints

- iPhone app only when `navigator.standalone === true`; Safari tab → install instructions. iPads/Android tablets → PC site. Android phones → Play screen (unchanged).
- Reminder thresholds: banner after 2 days, blocking screen after 5 days; "Remind me tomorrow" once in a row; a backup = completed CSV share or a PC hello (sync).
- Phone-side link rules exactly as Android 3.1 (`com.karvo.link.LinkCommandHandler`): ops, arg shapes, `{added, skipped}`, restore only into 0 lessons, integer durations 1–1440, valid ISO dates.
- Strings EN + IT; Italian copied from `~/git/project/Karvo/app/src/main/res/values-it/strings.xml` where the text exists.
- Alpine Night colours (same tokens as `styles.css`); touch targets ≥ 44 px; safe-area insets (`env(safe-area-inset-*)`).
- IndexedDB keys: `phone`, `pairings`, `meta` (the PC's `current` and `pairing` keys untouched).
- No npm dependencies in the site; vendored files keep their licence header.

## Review Focus

1. The iPhone hides Karvo mid-command → the change is either applied and acked or not applied; no half state (test in Task 1).
2. Two linked PCs editing at once → both get every snapshot; changes applied in arrival order (test in Task 1).
3. Clock or timezone change makes "days since backup" negative or huge → reminder state stays sane (test in Task 2).
4. A CSV import with duplicates on the iPhone → same counts as Android (test in Task 1/2 via planImport).
5. Service worker serves an old app after a release → new version activates on next launch, data untouched (check in Task 7).

---

### Task 1: Phone side of the link

**Files:** Create `link/phoneSide.js`; Modify `tools/fake-phone.mjs` (use it); Test `test/phoneSide.test.js`

**Interfaces:**
- Produces `applyCommand(data, op, args, text) → { data, result }` (pure; throws `Refused(message)`), `createPhoneLink({ pairing, getData, setData, onPcSync, text, relayUrl, appVersion, myName }) → { start(), stop(), unpair(), state, on('state'|'gone', fn) }` — one connection (role `phone`); hello → send snapshot + `onPcSync()`; commands applied in order through a promise queue, `ack` then `snapshot`; `unpaired`/`unlinked` → `gone`.
- `text(key)` keys: `lessonGone`, `phoneNotEmpty`, `invalidRate`, `invalidMonth`, `invalidData`, `unknownCommand`, plus lesson errors `StudentBlank`, `DurationZero`, `DurationTooLong`, `MinutesOver59`.

- [ ] Failing tests: each op (port of Android `LinkCommandHandlerTest` cases incl. error order "DurationZero · StudentBlank", restore guard, import counts twice, missing id); Review Focus 1: a command whose `setData` rejects → ack `ok:false`, data unchanged; Review Focus 2: two PCs → both receive snapshots after a change.
- [ ] `npm test` → FAIL; implement; → PASS; fake phone still pairs against local relay (`tools/fake-phone.mjs` smoke run).
- [ ] Commit `feat(link): phone side of the link as a shared module`.

### Task 2: Local data, pairings, meta and backup reminders

**Files:** Create `source/local.js`, `ui/m/backup.js`; Modify `source/idbStore.js` (`loadKey(k)`, `saveKey(k, v)`, `removeKey(k)`); Test `test/local.test.js`, `test/backup.test.js`

**Interfaces:** `createLocalSource(store) → source` (status `phone`, canEdit true, snapshot saved under `phone`); `reminderState({ lastBackupAt, lastPcSyncAt, snoozedOnce, snoozedAt }, now) → 'none'|'banner'|'blocking'`; `snooze(meta, now)`, `recordBackup(meta, now)`, `recordSync(meta, now)`.

- [ ] Failing tests: local source edits persist via fake store; reminder: 1 day none, 3 days banner, 6 days blocking, snooze once → banner for 24 h, second snooze refused; future timestamps (clock moved back) treated as "now"; first launch with no lessons → none.
- [ ] Implement; PASS; commit `feat(iphone): local data and backup reminders`.

### Task 3: Routing, Home Screen install, offline, language

**Files:** Create `manifest.webmanifest`, `icons/icon-180.png`, `icons/icon-512.png`, `sw.js`, `ui/m/i18n.js`; Modify `index.html` (manifest, apple-touch-icon, apple-mobile-web-app-capable, theme-color, viewport-fit=cover), `ui/phone.js` (standalone iPhone → `ui/m/app.js`; Safari → instructions only, no "coming soon"), `app.js` (register sw); Test `test/phone.test.js`, `test/i18n.test.js`

- [ ] Icons rendered from the logo SVG (headless Chrome screenshot) on the navy background.
- [ ] `sw.js`: cache name `karvo-v<N>`, precache every shipped file, cache-first, delete old caches on activate, `skipWaiting` + `clients.claim`.
- [ ] Tests: routing for iPhone standalone / Safari / iPad / Android; every i18n key present in both languages.
- [ ] Commit `feat(iphone): Home Screen install, offline cache, EN/IT strings`.

### Task 4: iPhone shell and Lessons

**Files:** Create `ui/m/app.js`, `ui/m/lessons.js`, `ui/m/sheet.js`, `m.css` (or a section in `styles.css`)

- [ ] Tabs Lessons · Overview · Settings (bottom bar, safe area); Lessons: months newest first with hours, rows (student, date, duration, note), search field, + button → sheet (date, student with suggestions from `students()`, hours/minutes, notes, Delete on edit) with Android validation messages; reminder banner / blocking screen from Task 2.
- [ ] Verify in Chrome emulating iPhone 14 with `navigator.standalone` forced: add/edit/delete persist across reload; screenshot.
- [ ] Commit `feat(iphone): lessons`.

### Task 5: Overview and Settings

**Files:** Create `ui/m/overview.js`, `ui/m/settings.js`

- [ ] Overview: this season's hours and money (eye), month cards with hours/money and Paid / Mark paid (date) / Mark unpaid, unpaid total, the three charts (reuse `ui/stats.js` drawing functions) stacked.
- [ ] Settings: rate (`parseRateCents`), season start, language, Back up now (`navigator.share({ files: [File(csv)] })` → `recordBackup` when it resolves; fallback download link if `canShare` is false), Import CSV (file input, `planImport` counts), Linked PCs entry, privacy policy link, version.
- [ ] Verify by emulation: mark paid, rate change, language switch, import, share stub resolves → reminder cleared.
- [ ] Commit `feat(iphone): overview and settings`.

### Task 6: Linking from the iPhone

**Files:** Create `ui/m/scan.js`, `ui/m/links.js`, `vendor/jsQR.js`; Modify `ui/m/app.js`

- [ ] Vendor jsQR 1.4.0 (download into its own folder, inspect, add licence header + `export default`).
- [ ] Linked PCs screen: list with Connected/Not connected, Remove (confirm), Link a PC → scanner (rear camera, frame grabs every 200 ms → jsQR → first `karvo:link?`) → "Link <PC>?" Allow/Deny → pair (15 s) → saved; camera denied → instructions.
- [ ] Lifecycle: start every pairing's link when visible, stop (bye) when hidden; `gone` → remove pairing; PC hello → `recordSync`.
- [ ] Verify by emulation + production relay: emulated PC shows QR, iPhone gets the QR text injected into the scanner path, pairs; PC edits land on the iPhone; iPhone edits show on the PC; hide → PC read-only; empty iPhone + PC backup → restore.
- [ ] Commit `feat(iphone): link to a PC from the iPhone`.

### Task 7: Release

- [ ] `npm test` green; final whole-branch review; fix; merge to `main`; push; confirm live; check the service worker updates an already-installed emulated app to the new version on next launch (Review Focus 5).
- [ ] Update `PRIVACY.md` in the Karvo repo only if the iPhone app changes what it says (it does not send anything new).
