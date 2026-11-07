// The PC's live link to the phone through the relay: socket, hello handshake, keep-alive pings and
// reconnecting with backoff. States: offline | connecting | connected | replaced | broken | outdated | unlinked.
import { deriveKeys, fromB64url, b64url, sha256Hex } from './crypto.js';
import { createChannel, ProtocolError, PROTOCOL_VERSION } from './protocol.js';

export const RELAY_URL = 'wss://link.rxsas.it';
const PING_MS = 30000, MAX_MISSED = 2, FIRST_BACKOFF = 2000, MAX_BACKOFF = 60000, MAX_BAD = 3, PROBE_AFTER_FAILED_OPENS = 2;

export function createConnection({ record, role = 'pc', relayUrl = RELAY_URL, WebSocketImpl = globalThis.WebSocket,
  appVersion, myName, timers = globalThis, fetchImpl = (...a) => globalThis.fetch(...a) }) {
  const listeners = { state: [], message: [], peer: [] };
  const emit = (ev, v) => listeners[ev].forEach(fn => fn(v));
  const roomId = fromB64url(record.roomId), mine = role === 'pc' ? [1, 2] : [2, 1];
  let phoneNewer = false, peerOutdated = false, keys, ws, channel, state = 'offline', stopped = true;
  let backoff = FIRST_BACKOFF, bad = 0, missed = 0, failedOpens = 0, retryTimer = null, pingTimer = null;
  let tx = Promise.resolve();

  const setState = s => { if (s !== state) { state = s; emit('state', s); } };
  const end = s => { stopped = true; clearAll(); setState(s); try { ws?.close(1000); } catch {} };
  function clearAll() { timers.clearTimeout(retryTimer); timers.clearInterval(pingTimer); retryTimer = pingTimer = null; }
  const authUrl = () => `${relayUrl}/room/${record.roomId}?role=${role}&auth=${b64url(role === 'pc' ? keys.authPc : keys.authPhone)}`;

  function scheduleRetry(delay = backoff) {
    retryTimer = timers.setTimeout(() => { retryTimer = null; connect(); }, delay);
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  }

  async function connect() {
    if (stopped) return;
    if (!peerOutdated) setState('connecting');
    let url = authUrl();
    if (record.unregistered) url += `&register=${await sha256Hex(keys.authPc)}.${await sha256Hex(keys.authPhone)}`;
    if (stopped) return; // stopped while hashing (e.g. the link dialog was cancelled)
    const sock = ws = new WebSocketImpl(url);
    sock.binaryType = 'arraybuffer';
    const ch = channel = createChannel({ sendKey: role === 'pc' ? keys.pcToPhone : keys.phoneToPc,
      recvKey: role === 'pc' ? keys.phoneToPc : keys.pcToPhone, roomId, sendDir: mine[0], recvDir: mine[1] });
    let opened = false, rx = Promise.resolve();
    const hello = () => ch.hello({ app: appVersion, name: myName }).then(f => sock.readyState === 1 && sock.send(f));

    sock.onopen = () => {
      opened = true; failedOpens = 0;
      delete record.unregistered; // the room exists now; reconnects must never re-create it
      if (!peerOutdated) setState('offline'); // offline until the peer says hello
      hello();
    };
    // One queue per socket: frames are decrypted in arrival order, or a big one would let a small one jump ahead.
    sock.onmessage = e => { rx = rx.then(() => handle(new Uint8Array(e.data))); };

    async function handle(bytes) {
      if (sock !== ws || stopped) return;
      let msg;
      try { msg = await ch.decode(bytes); }
      catch (err) {
        if (err instanceof ProtocolError && err.code === 'version') {
          phoneNewer = err.peerVersion > PROTOCOL_VERSION;
          if (phoneNewer) return end('outdated'); // this page is old: only a reload helps
          peerOutdated = true; // the phone is old: keep trying slowly so the updated app connects
          setState('outdated');
          try { sock.close(4005); } catch {}
          return;
        }
        if (++bad >= MAX_BAD) return end('broken');
        try { sock.close(4003); } catch {}
        return;
      }
      missed = 0;
      if (msg.t === 'hello') {
        if (!msg.isNew) return;
        hello(); // the peer may have missed ours (the relay drops frames while it is away)
        bad = 0; backoff = FIRST_BACKOFF; peerOutdated = false;
        emit('peer', { name: msg.name, app: msg.app });
        setState('connected');
        timers.clearInterval(pingTimer);
        pingTimer = timers.setInterval(ping, PING_MS);
        return;
      }
      if (msg.t === 'bye') { setState('offline'); return; }
      if (msg.t === 'ping') return;
      emit('message', msg);
    }

    sock.onclose = async e => {
      if (sock !== ws || stopped) return;
      timers.clearInterval(pingTimer);
      if (e.code === 4000) return end('replaced');
      if (e.code === 4002) return end('unlinked');
      if (!opened && ++failedOpens >= PROBE_AFTER_FAILED_OPENS) {
        // Browsers hide the HTTP status of a refused WebSocket; ask the relay directly once in a while.
        try {
          const { status } = await fetchImpl(authUrl().replace(/^ws/, 'http'));
          if (status === 404) return end('unlinked');
          if (status === 401) return end('broken');
        } catch {}
      }
      if (peerOutdated) return scheduleRetry(MAX_BACKOFF);
      setState('offline');
      scheduleRetry();
    };
  }

  function ping() {
    if (++missed > MAX_MISSED) { try { ws.close(4004); } catch {} return; } // the close event schedules the reconnect
    send('ping').catch(() => {});
  }

  function send(type, fields) {
    if (state !== 'connected' || ws?.readyState !== 1) return Promise.reject(new Error('Phone disconnected'));
    const sock = ws, ch = channel;
    // One queue: frames leave in the order their sequence numbers were given.
    const p = tx.then(async () => {
      const frame = await ch.encode(type, fields);
      if (sock.readyState !== 1) throw new Error('Phone disconnected');
      sock.send(frame);
    });
    tx = p.catch(() => {});
    return p;
  }

  return {
    get state() { return state; },
    get phoneNewer() { return phoneNewer; },
    on(ev, fn) { listeners[ev].push(fn); return () => { listeners[ev] = listeners[ev].filter(f => f !== fn); }; },
    async start() {
      if (!stopped) return;
      stopped = false; bad = 0; backoff = FIRST_BACKOFF; failedOpens = 0;
      keys ??= await deriveKeys(fromB64url(record.secret), roomId);
      await connect();
    },
    /** Retry now instead of waiting for the backoff (e.g. the tab became visible). */
    retryNow() {
      if (stopped || !retryTimer) return; // a socket that is open and waiting for the phone is left alone
      timers.clearTimeout(retryTimer); retryTimer = null;
      connect();
    },
    send,
    async stop() {
      if (state === 'connected') await send('bye').catch(() => {}); // encrypt first, then close
      end('offline');
    },
  };
}

/** Deletes the room on the relay (unlink, or an expired QR). Best effort: the relay may be unreachable. */
export async function deleteRoom(record, relayUrl = RELAY_URL) {
  const keys = await deriveKeys(fromB64url(record.secret), fromB64url(record.roomId));
  const url = `${relayUrl.replace(/^ws/, 'http')}/room/${record.roomId}?role=pc&auth=${b64url(keys.authPc)}`;
  try { await fetch(url, { method: 'DELETE' }); } catch {}
}
