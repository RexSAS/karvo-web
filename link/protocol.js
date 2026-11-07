// One connection's message channel (spec "Crypto" + "Messages"): JSON inside AES-GCM frames.
// Every message names the receiver's session (`s`), the sender's session (`f`) and a sequence number (`q`),
// so recorded frames can't be replayed into a later session.
import { seal, open, randomBytes, b64url } from './crypto.js';

export const PROTOCOL_VERSION = 1;

export class ProtocolError extends Error {
  constructor(message, code = 'invalid', extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

const enc = new TextEncoder(), dec = new TextDecoder();

export function createChannel({ sendKey, recvKey, roomId, sendDir, recvDir }) {
  const mySession = b64url(randomBytes(16));
  let peerSession = null, sendQ = 0, lastQ = 0;
  const seen = new Set(); // every peer session this socket has seen: switching back to an old one would reset q
  const frame = obj => seal(sendKey, roomId, sendDir, enc.encode(JSON.stringify(obj)));

  return {
    mySession,
    get peerSession() { return peerSession; },
    hello: fields => frame({ ...fields, s: null, f: mySession, q: 0, t: 'hello', v: PROTOCOL_VERSION, session: mySession }),
    async encode(type, fields = {}) {
      if (!peerSession) throw new ProtocolError('peer hello not received yet', 'state');
      return frame({ ...fields, s: peerSession, f: mySession, q: ++sendQ, t: type });
    },
    /** Returns the message; a hello also gets `isNew` (false when it repeats the current peer session). */
    async decode(bytes) {
      let msg;
      try { msg = JSON.parse(dec.decode(await open(recvKey, roomId, recvDir, bytes))); }
      catch { throw new ProtocolError('undecryptable frame'); }
      if (msg?.t === 'hello') {
        if (msg.v !== PROTOCOL_VERSION) throw new ProtocolError('protocol version mismatch', 'version', { peerVersion: msg.v, peerApp: msg.app });
        if (typeof msg.session !== 'string' || !msg.session) throw new ProtocolError('hello without session');
        if (msg.session === peerSession) return { ...msg, isNew: false }; // re-announcement: no reset
        if (seen.has(msg.session)) throw new ProtocolError('hello from an earlier session');
        seen.add(msg.session);
        peerSession = msg.session; lastQ = 0; // a (re)connected peer starts a new session
        return { ...msg, isNew: true };
      }
      if (!peerSession) throw new ProtocolError('message before hello');
      if (msg.s !== mySession || msg.f !== peerSession) throw new ProtocolError('wrong session');
      if (!Number.isInteger(msg.q) || msg.q <= lastQ) throw new ProtocolError('replayed or out-of-order message');
      lastQ = msg.q;
      return msg;
    },
  };
}
