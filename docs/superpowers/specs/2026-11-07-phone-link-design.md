# Karvo phone link — design

Date: 2026-11-07 · Status: draft for review · Repos: `RexSAS/karvo-web` (relay + PC), `RexSAS/Karvo` (Android)
Builds on: `2026-11-07-karvo-web-pc-design.md` (project 1, live at https://karvo.rxsas.it)

## Purpose

Let the PC web app act as a live remote control for the phone. The phone stays the master copy; every change
made on the PC is applied by the phone, which sends the new data back. The PC keeps its last snapshot as a
read-only backup when the phone is not connected.

## Decisions (agreed in chat)

- **Pair once, reconnect automatically.** One QR scan; afterwards the PC and phone find each other on their own.
- **Phone reachable while Karvo is open**; once a PC connects, a foreground notification keeps the link alive
  until Disconnect, the PC leaves, or 30 minutes without commands.
- **Approve once at pairing** (Allow / Deny + biometric if Karvo's biometric option is on). A linked PC can be
  removed later; the notification also offers Disconnect for the current session.
- **Encrypted relay on the user's Cloudflare** (`link.rxsas.it`), not WebRTC: works on every network. The relay
  forwards end-to-end encrypted bytes, stores no lesson data, and cannot read anything.
- Several PCs may be linked; each has its own room. No iPhone app. No offline editing on the PC.

## Components

```
karvo-web/
  relay/                Cloudflare Worker + Durable Object "Room" (wrangler, custom domain link.rxsas.it)
  link/crypto.js        HKDF + AES-256-GCM (Web Crypto), auth tokens
  link/protocol.js      message types, framing, sequence/session checks
  link/pairing.js       pairing payload (QR text), stored pairing record
  link/connection.js    WebSocket to the relay, reconnect with backoff, ping
  source/linked.js      source implementation over a connection (UI unchanged)
  vendor/qrcode.js      vendored QR encoder (kazuhikoarase qrcode-generator 1.4.4, MIT)
  ui/link.js            "Link your phone" dialog with QR, Unlink in Settings, restore prompt
  tools/fake-phone.mjs  Node script that pairs and behaves as a phone with in-memory data (for testing)
  test/vectors/link-v1.json   shared crypto test vectors (copied into the Android tests)

Karvo (Android), package com.karvo.link:
  LinkCrypto            same algorithms as link/crypto.js, verified by the shared vectors
  LinkProtocol          JSON messages (org.json), same rules as protocol.js
  PairingStore          linked PCs in DataStore; secrets wrapped by an Android Keystore AES key "karvo_link"
  LinkClient            OkHttp WebSocket per linked PC room
  LinkCommandHandler    applies commands through LessonRepository / SettingsRepository with app validation
  LinkManager           starts clients when the app comes to the foreground; owns LinkService
  LinkService           foreground service, type dataSync, notification "Linked to <PC> · Disconnect"
  ui: LinkedPcsScreen (Settings), ScanQrScreen (CameraX + ZXing), confirm dialog
New Android dependencies: OkHttp, ZXing core. New permissions: FOREGROUND_SERVICE, FOREGROUND_SERVICE_DATA_SYNC,
POST_NOTIFICATIONS (asked at first pairing).
```

## Pairing

1. PC → "Link your phone": generates `roomId` (16 random bytes) and `secret` (32 random bytes), registers the
   room with the relay (see Relay), and shows a QR with text
   `karvo:link?v=1&r=<roomId b64url>&k=<secret b64url>&n=<PC name, URL-encoded>`. PC name from the user agent,
   e.g. "Chrome on Windows". The QR expires after 2 minutes (PC discards it and the room).
2. Phone → Settings → Linked PCs → "Link a PC" → camera scan → dialog "Link Chrome on Windows?" with Allow / Deny;
   biometric prompt first when Karvo's biometric reveal setting is on. Deny discards everything.
3. On Allow the phone connects as `phone`, both sides exchange `hello`, the PC shows "Linked to <phone model>",
   and both store `{ roomId, secret, peerName, linkedAt }`.
4. Unlink from either side sends `unpaired`, deletes the record on both sides, and the relay deletes the room.
   The PC falls back to the read-only backup.

## Crypto

- `kPcToPhone = HKDF-SHA256(ikm=secret, salt=roomId, info="karvo-link v1 pc->phone", 32 bytes)`, likewise
  `kPhoneToPc` with `"phone->pc"`.
- `authPc = HKDF(..., info="karvo-link v1 auth pc")`, `authPhone = ... "auth phone"` (32 bytes each).
- Frame (binary WebSocket message): `nonce (12 random bytes) || AES-256-GCM ciphertext+tag`, AAD = `roomId || direction byte`
  (`0x01` pc→phone, `0x02` phone→pc). Random nonces: keys are reused across sessions, so counters would repeat.
- Plaintext is UTF-8 JSON `{ "s": <peer session id>, "q": <seq>, "t": <type>, ... }`. Each side picks a random
  16-byte session id per connection and announces it in `hello`; every later message must carry the receiver's
  current session id and a strictly increasing `q` starting at 1. Anything else is dropped (replay protection).
- A frame that fails to decrypt or validate closes the connection. Three such closes in a row → PC shows
  "Link broken · re-link this PC" and the phone marks the PC as broken in Linked PCs.

## Relay (`relay/`, Cloudflare Worker + Durable Object)

- `GET wss://link.rxsas.it/room/<roomId>?role=pc|phone&auth=<token b64url>`; one Durable Object per room
  (`idFromName(roomId)`), WebSocket Hibernation API.
- Register: the first `pc` connection to an unknown room must also send `&register=<sha256(authPc)>.<sha256(authPhone)>`;
  the room stores only those two hashes. Later connections must present a token whose SHA-256 matches their role.
- At most one socket per role: a new valid socket for a role replaces the old one (reconnects). Frames are
  forwarded as-is to the other role; if it is absent they are dropped (no queue, no storage of frames).
- Limits: frame ≤ 1 MiB, ≤ 20 frames/s per socket (excess closes the socket), 401 on bad auth, 404 unknown room.
- `DELETE /room/<roomId>` with a valid token deletes the room (unlink, expired QR).
- Deployed with `npx wrangler deploy`; `custom_domain = true` for `link.rxsas.it` (as rexwoods).

## Messages

| Type | From | Fields | Meaning |
|---|---|---|---|
| `hello` | both | `v` (protocol, 1), `app` (version), `name`, `session` | first message after connect; version mismatch → "Update Karvo on your phone" / "Reload this page", PC stays read-only |
| `snapshot` | phone | `lessons`, `rateCents`, `seasonStartMonth`, `timeZoneId` | full data; on connect and after every change from either side |
| `command` | pc | `id`, `op`, `args` | `addLesson(lesson)`, `updateLesson(lesson)`, `deleteLesson(id)`, `markPaid(month, paidOn)`, `markUnpaid(month)`, `setRate(cents\|null)`, `setSeasonStart(month)`, `importLessons(lessons)`, `restoreAll(lessons)` |
| `ack` | phone | `id`, `ok`, `error?` | result of one command; the PC resolves the source call on it |
| `unpaired` | both | — | unlink |
| `bye` | both | — | clean close (Disconnect, tab closed) |
| `ping` | both | — | every 30 s; 2 missed → treat as offline |

Lessons use the project-1 shape (`id, date, durationMinutes, student, notes, paidOn`); ids are the phone's Room ids.

## Phone behaviour

- `LinkManager` starts a `LinkClient` per linked PC when the app process comes to the foreground and stops them
  when it goes to the background, unless a PC is connected.
- When a PC sends `hello`, start `LinkService` (notification "Linked to <PC> · Disconnect"). Stop it on
  Disconnect (sends `bye`), when the PC leaves, or after 30 minutes without a command.
- `LinkCommandHandler` validates every command with the app's own rules (`validateLesson`, `normalizeForSave`,
  rate/season ranges), applies it, replies `ack`, and the lessons Flow triggers a new `snapshot`.
  `importLessons` runs the app's `planImport` duplicate check. `restoreAll` is rejected unless the phone has
  0 lessons. Unknown `op` → `ack ok:false`.
- Phone-side changes (made in the app) also produce a `snapshot` to every connected PC.

## PC behaviour

- With a stored pairing, the app opens the backup source and starts `link/connection.js` in the background.
- States and banner:
  - not linked: as project 1; empty state's "Link your phone" now opens the link dialog.
  - linked, phone offline: read-only backup, "Open Karvo on your phone to connect · last synced <time>"; retries with
    backoff 2 s → 60 s, and immediately when the tab becomes visible.
  - connected: `linked` source, `canEdit = true`, banner "Connected to <phone>"; each snapshot is saved as the backup.
- Commands resolve on `ack`; `ok:false` rejects with the phone's error text, shown where the action was taken.
  A drop while waiting rejects with "Phone disconnected".
- Restore: when connected and the phone's snapshot has 0 lessons while the backup has some, ask
  "Restore N lessons to the phone?"; Yes sends `restoreAll`.
- CSV import while connected sends `importLessons` with the parsed lessons (result text from the `ack`).
- "Today" for the unpaid total uses the phone's `timeZoneId`.
- Settings gains "Linked phone: <name> · Unlink".

## Errors

- Command rejected or interrupted: nothing changes on screen (UI only shows phone-confirmed data); message shown.
- Relay down or network gone: same as phone offline; CSV export keeps working.
- Tampered/undecryptable frames: connection closed; repeated → "Link broken" state on both sides.
- Storage of the pairing fails on the PC: show the storage banner; pairing still works for this tab.

## Testing

- Shared vectors `test/vectors/link-v1.json` (fixed secret, roomId, nonce, plaintext → keys, tokens, frame bytes):
  `node --test` on the PC and JUnit on Android must both pass them.
- PC: `node --test` for protocol (session/seq rules), linked source over a fake connection (ack, rejection,
  drop while waiting, restore guard). `tools/fake-phone.mjs` against the real relay for manual end-to-end tests.
- Relay: `wrangler dev` + a Node test: two clients relay a frame; bad token → 401; a third socket replaces the old
  one of its role; oversize frame closes the socket.
- Android: JUnit for crypto vectors, protocol, and `LinkCommandHandler` against fake repositories (each `op`,
  validation errors, `restoreAll` guard). Manual on the real phone: pair, edit both ways, restore, unlink from
  each side, Disconnect from the notification, mobile data instead of Wi-Fi.

## Delivery

Two implementation plans:
1. **Relay + PC** (`karvo-web`): relay, `link/*`, linked source, UI, fake phone. Testable end to end without Android.
2. **Android** (`Karvo`): `com.karvo.link`, screens, service, permissions; released as a new app version. Play
   Console needs the foreground-service (dataSync) declaration.

## Out of scope

iPhone app, offline editing on the PC with later sync, moments over the link, linking two phones.
