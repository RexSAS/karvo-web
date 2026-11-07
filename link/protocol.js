// One connection's message channel (spec "Crypto" + "Messages"): JSON inside AES-GCM frames, with the
// receiver's session id and a strictly increasing sequence number so recorded frames can't be replayed.
import { seal, open, randomBytes, b64url } from './crypto.js';

export const PROTOCOL_VERSION = 1;

export class ProtocolError extends Error {
  constructor(message, code = 'invalid', extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

const enc = new TextEncoder(), dec = new TextDecoder();

export function createChannel({ sendKey, recvKey, roomId, sendDir, recvDir }) {
  const mySession = b64url(randomBytes(16));
  let peerSession = null, sendQ = 0, lastQ = 0;
  const frame = obj => seal(sendKey, roomId, sendDir, enc.encode(JSON.stringify(obj)));

  return {
    mySession,
    hello: fields => frame({ ...fields, s: null, q: 0, t: 'hello', v: PROTOCOL_VERSION, session: mySession }),
    async encode(type, fields = {}) {
      if (!peerSession) throw new ProtocolError('peer hello not received yet', 'state');
      return frame({ ...fields, s: peerSession, q: ++sendQ, t: type });
    },
    async decode(bytes) {
      let msg;
      try { msg = JSON.parse(dec.decode(await open(recvKey, roomId, recvDir, bytes))); }
      catch { throw new ProtocolError('undecryptable frame'); }
      if (msg?.t === 'hello') {
        if (peerSession) throw new ProtocolError('second hello on one connection'); // a replayed hello must not reset the sequence
        if (msg.v !== PROTOCOL_VERSION) throw new ProtocolError('protocol version mismatch', 'version', { peerVersion: msg.v, peerApp: msg.app });
        if (typeof msg.session !== 'string' || !msg.session) throw new ProtocolError('hello without session');
        peerSession = msg.session;
        return msg;
      }
      if (!peerSession) throw new ProtocolError('message before hello');
      if (msg.s !== mySession) throw new ProtocolError('wrong session');
      if (!Number.isInteger(msg.q) || msg.q <= lastQ) throw new ProtocolError('replayed or out-of-order message');
      lastQ = msg.q;
      return msg;
    },
  };
}
