# Phone Link (Relay + PC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the encrypted relay at `link.rxsas.it` and make the PC web app pair with, connect to and remote-control a phone, testable end to end with a Node fake phone before any Android work.

**Architecture:** A Cloudflare Worker routes each room to a Durable Object that forwards opaque binary frames between one `pc` and one `phone` socket after checking a hashed auth token. The PC encrypts with Web Crypto (`link/crypto.js`), frames/validates messages (`link/protocol.js`), keeps a reconnecting socket (`link/connection.js`), and exposes the phone through the existing source interface (`source/linked.js`). `app.js` switches between the backup source and the linked source as the connection comes and goes.

**Tech Stack:** Plain ES modules (no build), Web Crypto, WebSocket, IndexedDB, Node 22 (`node --test`, global `WebSocket`/`crypto.subtle`), Cloudflare Workers + Durable Objects (SQLite-backed, free plan) via `npx wrangler`, vendored `qrcode-generator@1.4.4`.

**Spec:** `docs/superpowers/specs/2026-11-07-phone-link-design.md`

## Global Constraints

- Protocol version `1`; QR text `karvo:link?v=1&r=<roomId b64url>&k=<secret b64url>&n=<name URL-encoded>`; QR expires after 2 minutes.
- `roomId` 16 random bytes, `secret` 32 random bytes; base64url without padding everywhere.
- HKDF-SHA256(ikm=secret, salt=roomId), 32-byte outputs, info strings exactly: `karvo-link v1 pc->phone`, `karvo-link v1 phone->pc`, `karvo-link v1 auth pc`, `karvo-link v1 auth phone`.
- Frame = 12-byte random nonce ‖ AES-256-GCM ciphertext+16-byte tag; AAD = roomId bytes ‖ direction byte (`0x01` pc→phone, `0x02` phone→pc).
- Plaintext JSON `{ s, q, t, ... }`: `s` = receiver's current session id (b64url of 16 random bytes), `q` strictly increasing from 1 per connection; `hello` carries `session` and uses `s: null`, `q: 0`.
- Relay: `wss://link.rxsas.it/room/<roomId>?role=pc|phone&auth=<b64url>[&register=<hexSha256Pc>.<hexSha256Phone>]`; `DELETE https://link.rxsas.it/room/<roomId>?role=..&auth=..`; frame ≤ 1 MiB; ≤ 20 frames/s per socket; 401 bad auth; 404 unknown room; close code 4000 on replacement, 4001 on rate/size abuse.
- Ping every 30 s; 2 missed pings → offline. Reconnect backoff 2 s doubling to 60 s; reset on success; immediate retry on `visibilitychange` to visible.
- Copy: `Link your phone`, `Connected to <name>`, `Open Karvo on your phone to connect · last synced <time>`, `Phone disconnected`, `Link broken · re-link this PC`, `Restore N lessons to the phone?`, `Update Karvo on your phone`, `Reload this page`.
- No npm dependencies in the web app; `relay/` may use `wrangler` via `npx` only.

## Review Focus

1. A second browser tab on the same PC opens while the first is connected → the relay replaces the older `pc` socket (close 4000); the old tab must go read-only quietly, not loop reconnecting against the new one (test in Task 5).
2. The phone answers a command after the PC has already timed out / reconnected → late `ack` for an unknown id is ignored, no crash, no double-apply (test in Task 6).
3. A snapshot arrives while a command is pending → UI shows the snapshot; the pending promise still resolves on its `ack` (test in Task 6).
4. QR expires while the phone is mid-scan → PC deleted the room; phone gets 404 and must show a clear error; PC dialog offers a new code (relay 404 test in Task 4; PC copy in Task 8).
5. Tampered or replayed frame (old `q`, wrong `s`) → dropped and connection closed, never applied (test in Task 2).

---

### Task 1: Crypto and shared vectors

**Files:**
- Create: `link/crypto.js`, `tools/make-vectors.mjs`, `test/vectors/link-v1.json`
- Test: `test/linkCrypto.test.js`

**Interfaces:**
- Produces (all async, `Uint8Array` in/out):
  - `b64url(bytes) → string`, `fromB64url(string) → Uint8Array`, `randomBytes(n)`
  - `deriveKeys(secret, roomId) → { pcToPhone: CryptoKey, phoneToPc: CryptoKey, authPc: Uint8Array, authPhone: Uint8Array }`
  - `sha256Hex(bytes) → string`
  - `seal(key, roomId, direction /* 1|2 */, plaintextBytes, nonce = randomBytes(12)) → Uint8Array frame`
  - `open(key, roomId, direction, frame) → Uint8Array` (throws on any failure)

- [ ] **Step 1:** `tools/make-vectors.mjs` computes vectors with `node:crypto` (`hkdfSync`, `createCipheriv('aes-256-gcm')`) — an implementation independent of Web Crypto — for secret = bytes 0..31, roomId = bytes 100..115, nonce = bytes 200..211, plaintext `{"s":null,"q":0,"t":"hello"}`, both directions; writes hex of the four HKDF outputs, both frames, and `sha256Hex` of both auth tokens to `test/vectors/link-v1.json`. Run `node tools/make-vectors.mjs`.
- [ ] **Step 2: Failing tests:** each vector field equals `link/crypto.js` output; `open(seal(x)) == x`; flipping one byte of the frame, using the other direction, or another roomId makes `open` throw.
- [ ] **Step 3:** `npm test` → FAIL (module missing).
- [ ] **Step 4:** Implement with `crypto.subtle` (`HKDF` deriveBits, `AES-GCM` with `additionalData`, `tagLength: 128`).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat(link): crypto and shared test vectors`.

### Task 2: Protocol (framing, session and sequence rules)

**Files:**
- Create: `link/protocol.js`
- Test: `test/linkProtocol.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces: `createChannel({ sendKey, recvKey, roomId, sendDir, recvDir }) → { mySession, hello(fields) → Promise<frame>, encode(type, fields) → Promise<frame>, decode(frame) → Promise<msg> }`. `decode` throws `ProtocolError` for: decrypt failure, bad JSON, a non-`hello` before `hello`, wrong `s`, `q` not greater than last seen, `hello` with `v !== 1` (`code: 'version'`, carrying `app` so the UI can pick the copy). After a received `hello`, `encode` stamps `s` = peer session and `q` = 1, 2, 3…

- [ ] **Step 1: Failing tests** with two channels wired back to back (pc/phone keys from Task 1): hello exchange then 3 messages decode in order; replaying message 2 → `ProtocolError`; message with `s` from a previous session → error; tampered byte → error; `{v:2}` hello → error code `version`; `encode` before peer hello throws.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(link): message protocol with replay protection`.

### Task 3: Pairing payload and storage

**Files:**
- Create: `link/pairing.js`
- Modify: `source/idbStore.js` (add `loadPairing()`, `savePairing(record)`, `removePairing()` on key `'pairing'` in the same object store; same transaction-complete semantics)
- Test: `test/linkPairing.test.js`

**Interfaces:**
- Produces: `newPairing(pcName) → { roomId, secret, qrText }`; `parseQr(text) → { roomId, secret, name }` (throws on wrong scheme/version/lengths); `pcName(userAgent) → 'Chrome on Windows' | 'Firefox on Linux' | 'Edge on Windows' | 'Safari on macOS' | 'Browser'`; record shape `{ roomId: b64url, secret: b64url, peerName, linkedAt: ISO }`.

- [ ] **Step 1: Failing tests:** `parseQr(newPairing('X').qrText)` round-trips bytes and name (with spaces/accents); `karvo:link?v=2…` and a 15-byte room throw; `pcName` for 4 real UA strings.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(link): pairing payload and stored pairing record`.

### Task 4: Relay Worker

**Files:**
- Create: `relay/wrangler.toml`, `relay/src/index.js`, `relay/test/relay.test.mjs`, `relay/package.json` (`{ "type": "module", "private": true }`)

**Interfaces:**
- Produces: the HTTP/WebSocket API in Global Constraints. `wrangler.toml`: `name = "karvo-link"`, `main = "src/index.js"`, `compatibility_date = "2026-10-01"`, Durable Object binding `ROOM` → class `Room` with a `new_sqlite_classes = ["Room"]` migration, `routes = [{ pattern = "link.rxsas.it", custom_domain = true }]`.
- `Room` stores `{ pcHash, phoneHash }` in DO storage; uses `ctx.acceptWebSocket(ws, [role])` (hibernation) and `ctx.getWebSockets(role)`; per-socket rate counter kept in `ws.serializeAttachment`.

- [ ] **Step 1: Failing test** (`node --test relay/test`) against `npx wrangler dev --local --port 8799` started by the test (spawn, wait for "Ready"): register room as pc; phone with right token connects; binary frame pc→phone arrives byte-identical and phone→pc too; wrong token → 401; unknown room without `register` → 404; second pc socket → first closed with 4000; 1 MiB + 1 frame → closed 4001; `DELETE` with valid token → later connect 404.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(relay): encrypted-frame relay on Cloudflare Durable Objects`.

### Task 5: Connection (socket, reconnect, ping)

**Files:**
- Create: `link/connection.js`
- Test: `test/linkConnection.test.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `createConnection({ record, role: 'pc', relayUrl = 'wss://link.rxsas.it', WebSocketImpl = WebSocket, appVersion, myName, timers = globalThis }) → { start(), stop(), send(type, fields) → Promise, on(event, fn) }` with events `'state'` (`'offline' | 'connecting' | 'connected' | 'replaced' | 'broken' | 'outdated'`), `'message'` (decoded msg after hello), `'peer'` (`{ name, app }` from hello). Three consecutive protocol-error closes → `'broken'` and stop. Close code 4000 → `'replaced'` and stop (no reconnect). Peer hello with other `v` → `'outdated'` (with `{ phoneNewer: boolean }`) and stop.
- `register` param sent only when `record.unregistered` is true (fresh pairing).

- [ ] **Step 1: Failing tests** with a fake WebSocket class and fake timers: connects with right URL/auth; after peer hello state `connected` and `peer` fires; socket close → `offline` then reconnect after 2 s, 4 s, …, capped at 60 s, reset after success; Review Focus 1: close code 4000 → `replaced`, no further connect attempts; 2 missed pings → socket closed + `offline`; 3 bad frames in a row → `broken`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement (ping = `send('ping')` every 30 s; any received message counts as alive).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(link): reconnecting relay connection`.

### Task 6: Linked source

**Files:**
- Create: `source/linked.js`
- Modify: `domain/dates.js` (add `todayIn(timeZoneId) → 'YYYY-MM-DD'` via `Intl.DateTimeFormat('en-CA', { timeZone })`, falling back to `today()` on an invalid zone)
- Test: `test/linkedSource.test.js`

**Interfaces:**
- Consumes: Task 5 connection (`send`, `on('message')`), `parseLessonsCsv`, `planImport` (for the `{added, skipped}` preview only; the phone decides), backup `store`.
- Produces: `createLinkedSource(connection, store, { timeoutMs = 15000 }) → source` with `status: 'linked'`, `canEdit: true`, `peerName`, the full project-1 interface, plus `restoreAll(lessons) → Promise`. Snapshot → `{ lessons, rateCents, seasonStartMonth, timeZoneId, syncedAt: now }`, saved to `store` then sent to subscribers. Each command → `send('command', { id, op, args })` resolved by matching `ack` (`ok:false` rejects with `error`; no ack within `timeoutMs` or connection lost rejects `Phone disconnected`). `importCsv(text)` parses locally (format errors reject before sending) and sends `importLessons`; the ack carries `{ added, skipped }`.
- `needsRestore(snapshot, backup) → number` helper exported: backup lesson count when the phone snapshot has 0 lessons and the backup has > 0, else 0.
- `domain` today: the UI uses `todayIn(snapshot.timeZoneId)` when present.

- [ ] **Step 1: Failing tests** with a fake connection: snapshot reaches subscriber and is saved; `addLesson` resolves on `ack ok:true`, rejects with the phone's text on `ok:false`; Review Focus 2: an `ack` with an unknown id is ignored; Review Focus 3: a snapshot arriving before the ack is delivered and the promise still resolves; connection `'offline'` while pending → rejects `Phone disconnected`; bad CSV rejects without sending; `needsRestore` cases; `todayIn('Pacific/Auckland')` differs from `todayIn('Pacific/Honolulu')` at a fixed instant (inject date).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(link): linked source over the relay connection`.

### Task 7: Fake phone

**Files:**
- Create: `tools/fake-phone.mjs`

**Interfaces:**
- Consumes: Tasks 1–3 (same modules, role `phone`), `demoLessons`, `markPaid`, `markUnpaid`, `planImport`, `validateLesson`.
- Produces: `node tools/fake-phone.mjs "<qr text>" [--relay ws://localhost:8799] [--empty] [--state file.json]` — pairs (prints "Linked to <pc name>"), keeps a pairing in `--state` to reconnect later, holds demo lessons (or none with `--empty`), applies every op with the same rules the spec gives the phone (including `restoreAll` refused when not empty), sends `ack` + `snapshot`, logs each command. `Ctrl+C` sends `bye`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** against local relay + `node --test`-free manual run: start relay (`npx wrangler dev` in `relay/`), serve the site with `?relay=ws://localhost:8799` override (Task 8), pair with the printed QR text, add a lesson on the PC → fake phone logs `addLesson` and PC shows it; kill the fake phone → PC banner offline + read-only.
- [ ] **Step 3:** Commit `feat(tools): fake phone for end-to-end link tests`.

### Task 8: PC UI — link dialog, banners, unlink, restore

**Files:**
- Create: `vendor/qrcode.js` (download `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js`, add the MIT header comment, export via `export default qrcode` appended), `ui/link.js`
- Modify: `app.js`, `ui/banner.js`, `ui/empty.js`, `ui/settings.js`, `ui/overview.js` (use `todayIn` for unpaid), `styles.css`

**Interfaces:**
- Consumes: Tasks 3, 5, 6.
- Produces:
  - `openLinkDialog({ onLinked })`: creates pairing, registers by opening the connection with `record.unregistered = true`, shows the QR (SVG from `qrcode(0,'M')`) and a 2:00 countdown; expiry deletes the room and offers "New code"; on peer hello saves the record (`unregistered` dropped), closes, calls `onLinked(connection)`.
  - `app.js`: on start, if a pairing is stored, start the connection; `connected` → swap `state.source` to `createLinkedSource`; any other state → back to the backup source (`createBackupSource` on the same store, which now holds the last snapshot). `?relay=` query param overrides the relay URL (testing only).
  - Banner copy per state from Global Constraints (`replaced` → "Open in another tab · this tab is read only"; `broken` → `Link broken · re-link this PC`; `outdated` → `Update Karvo on your phone` or `Reload this page`).
  - Settings: "Linked phone: <name> · Unlink" (sends `unpaired`, `DELETE`s the room, removes the record) or "Link your phone" when unlinked.
  - Restore prompt: on the first snapshot after connecting, if `needsRestore(...) > 0`, confirm `Restore N lessons to the phone?` → `source.restoreAll(backup.lessons)`.
  - Empty state: "Link your phone" enabled.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** with local relay + fake phone (CDP screenshot script): pair; edit lesson, mark paid, set rate, import CSV → all applied by the fake phone and redrawn; second tab → first tab shows the replaced banner; stop fake phone → offline banner, read-only; restart it → reconnects without a QR; `--empty` fake phone with a backup present → restore prompt → restored; Unlink → backup mode, fake phone logs `unpaired`; Review Focus 4: let the QR expire, then pair → fake phone gets 404 and the dialog offers a new code.
- [ ] **Step 3:** `npm test` → PASS.
- [ ] **Step 4:** Commit `feat: link your phone from the PC`.

### Task 9: Deploy and release

**Files:**
- Modify: `docs/superpowers/specs/2026-11-07-phone-link-design.md` only if deploy facts differ (note them).

- [ ] **Step 1:** `cd relay && npx wrangler deploy` (needs the user's wrangler login; asks in the browser if expired). Expected: `link.rxsas.it` custom domain created.
- [ ] **Step 2:** Run `node --test relay/test` against production with `RELAY=wss://link.rxsas.it` → PASS (uses random rooms, deletes them).
- [ ] **Step 3:** End-to-end against production: site from `localhost` without `?relay`, fake phone without `--relay` → pair, edit, unlink.
- [ ] **Step 4:** With the user's go-ahead, merge to `main`, push, confirm https://karvo.rxsas.it serves the new `app.js`. Until the Android release, "Link your phone" works only with the fake phone; the dialog says "Needs the next Karvo update on your phone".
