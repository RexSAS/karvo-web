// Karvo link relay (spec "Relay"): one Durable Object per room forwards opaque, end-to-end encrypted frames
// between one `pc` and one `phone` socket. It stores only two SHA-256 hashes of the sides' auth tokens.
import { DurableObject } from 'cloudflare:workers';

const MAX_FRAME = 1024 * 1024;
const MAX_PER_SECOND = 20;
const ROLES = ['pc', 'phone'];
const HASH = /^[0-9a-f]{64}$/;

// The web app calls GET (is my room still there?) and DELETE (unlink) from the browser. Any origin is fine:
// nothing works without a room's secret-derived token.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400' };
const withCors = r => {
  if (r.status === 101) return r; // WebSocket upgrades pass through untouched
  const out = new Response(r.body, r);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const m = new URL(request.url).pathname.match(/^\/room\/([A-Za-z0-9_-]{22})$/);
    if (!m) return withCors(new Response('Not found', { status: 404 }));
    return withCors(await env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(request));
  },
};

async function sha256Hex(b64url) {
  const bytes = Uint8Array.from(atob(b64url.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class Room extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url), role = url.searchParams.get('role');
    if (!ROLES.includes(role)) return new Response('Bad role', { status: 400 });

    let hashes = await this.ctx.storage.get('hashes'), fresh = false;
    if (!hashes) {
      const reg = (url.searchParams.get('register') ?? '').split('.');
      // Only the PC creates a room, at pairing time; anything else on an unknown room is a 404.
      if (role !== 'pc' || reg.length !== 2 || !reg.every(h => HASH.test(h))) return new Response('Unknown room', { status: 404 });
      hashes = { pc: reg[0], phone: reg[1] };
      fresh = true;
    }
    let given;
    try { given = await sha256Hex(url.searchParams.get('auth') ?? ''); } catch { given = ''; }
    if (given !== hashes[role]) return new Response('Unauthorized', { status: 401 });
    if (fresh) await this.ctx.storage.put('hashes', hashes);

    if (request.method === 'DELETE') {
      for (const ws of this.ctx.getWebSockets()) try { ws.close(4002, 'unlinked'); } catch {}
      await this.ctx.storage.deleteAll();
      return new Response(null, { status: 204 });
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Upgrade required', { status: 426 });

    for (const old of this.ctx.getWebSockets(role)) try { old.close(4000, 'replaced'); } catch {}
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, second: 0, count: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    const a = ws.deserializeAttachment(), now = Math.floor(Date.now() / 1000);
    if (a.second !== now) { a.second = now; a.count = 0; }
    a.count++;
    ws.serializeAttachment(a);
    if (typeof message === 'string' || message.byteLength > MAX_FRAME || a.count > MAX_PER_SECOND) {
      ws.close(4001, 'frame too large, not binary, or too many frames');
      return;
    }
    for (const peer of this.ctx.getWebSockets(a.role === 'pc' ? 'phone' : 'pc')) try { peer.send(message); } catch {}
  }

  webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code); } catch {}
  }
}
