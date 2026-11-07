// The PC's live link to the phone through the relay: socket, hello handshake, keep-alive pings and
// reconnecting with backoff. States: offline | connecting | connected | replaced | broken | outdated | unlinked.
import { deriveKeys, fromB64url, b64url, sha256Hex } from './crypto.js';
import { createChannel, ProtocolError, PROTOCOL_VERSION } from './protocol.js';

export const RELAY_URL = 'wss://link.rxsas.it';
const PING_MS = 30000, MAX_MISSED = 2, FIRST_BACKOFF = 2000, MAX_BACKOFF = 60000, MAX_BAD = 3;

export function createConnection({ record, role = 'pc', relayUrl = RELAY_URL, WebSocketImpl = globalThis.WebSocket,
  appVersion, myName, timers = globalThis }) {
  const listeners = { state: [], message: [], peer: [] };
  const emit = (ev, v) => listeners[ev].forEach(fn => fn(v));
  const roomId = fromB64url(record.roomId), mine = role === 'pc' ? [1, 2] : [2, 1];
  let phoneNewer = false, keys, ws, channel, state = 'offline', stopped = true, backoff = FIRST_BACKOFF, bad = 0, missed = 0, retryTimer, pingTimer;

  const setState = s => { if (s !== state) { state = s; emit('state', s); } };
  const end = s => { stopped = true; clearAll(); setState(s); try { ws?.close(1000); } catch {} };
  function clearAll() { timers.clearTimeout(retryTimer); timers.clearInterval(pingTimer); retryTimer = pingTimer = null; }

  async function connect() {
    if (stopped) return;
    setState('connecting');
    const auth = role === 'pc' ? keys.authPc : keys.authPhone;
    let url = `${relayUrl}/room/${record.roomId}?role=${role}&auth=${b64url(auth)}`;
    if (record.unregistered) url += `&register=${await sha256Hex(keys.authPc)}.${await sha256Hex(keys.authPhone)}`;
    const sock = ws = new WebSocketImpl(url);
    sock.binaryType = 'arraybuffer';
    channel = createChannel({ sendKey: role === 'pc' ? keys.pcToPhone : keys.phoneToPc, recvKey: role === 'pc' ? keys.phoneToPc : keys.pcToPhone,
      roomId, sendDir: mine[0], recvDir: mine[1] });
    const ch = channel;
    const hello = () => ch.hello({ app: appVersion, name: myName }).then(f => sock.readyState === 1 && sock.send(f));
    sock.onopen = () => { setState('offline'); hello(); }; // offline until the peer says hello
    sock.onmessage = async e => {
      let msg;
      try { msg = await ch.decode(new Uint8Array(e.data)); }
      catch (err) {
        if (err instanceof ProtocolError && err.code === 'version') {
          phoneNewer = err.peerVersion > PROTOCOL_VERSION; // true: reload this page; false: update Karvo on the phone
          return end('outdated');
        }
        if (++bad >= MAX_BAD) return end('broken');
        try { sock.close(4003); } catch {}
        return;
      }
      if (sock !== ws) return;
      missed = 0;
      if (msg.t === 'hello') {
        if (!msg.isNew) return;
        hello(); // the peer may have missed ours (the relay drops frames while it is away)
        bad = 0; backoff = FIRST_BACKOFF;
        emit('peer', { name: msg.name, app: msg.app });
        setState('connected');
        timers.clearInterval(pingTimer);
        pingTimer = timers.setInterval(ping, PING_MS);
        return;
      }
      if (msg.t === 'bye') { setState('offline'); return; }
      if (msg.t === 'ping') return;
      emit('message', msg);
    };
    sock.onclose = e => {
      if (sock !== ws || stopped) return;
      timers.clearInterval(pingTimer);
      if (e.code === 4000) return end('replaced');
      if (e.code === 4002) return end('unlinked');
      setState('offline');
      retryTimer = timers.setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
    };
  }

  function ping() {
    if (++missed > MAX_MISSED) { try { ws.close(4004); } catch {} return; } // the close event schedules the reconnect
    send('ping').catch(() => {});
  }

  async function send(type, fields) {
    if (state !== 'connected' || ws?.readyState !== 1) throw new Error('Phone disconnected');
    ws.send(await channel.encode(type, fields));
  }

  return {
    get state() { return state; },
    get phoneNewer() { return phoneNewer; },
    on(ev, fn) { listeners[ev].push(fn); return () => { listeners[ev] = listeners[ev].filter(f => f !== fn); }; },
    async start() {
      if (!stopped) return;
      stopped = false; bad = 0; backoff = FIRST_BACKOFF;
      keys ??= await deriveKeys(fromB64url(record.secret), roomId);
      await connect();
    },
    /** Retry now instead of waiting for the backoff (e.g. the tab became visible). */
    retryNow() { if (!stopped && state === 'offline' && retryTimer) { timers.clearTimeout(retryTimer); retryTimer = null; connect(); } },
    send,
    stop() {
      if (state === 'connected') send('bye').catch(() => {});
      end('offline');
    },
  };
}
