// Karvo link relay (spec "Relay"): one Durable Object per room forwards opaque, end-to-end encrypted frames
// between one `pc` and one `phone` socket. It stores only two SHA-256 hashes of the sides' auth tokens.
import { DurableObject } from 'cloudflare:workers';

const MAX_FRAME = 1024 * 1024;
const MAX_PER_SECOND = 20;
const ROLES = ['pc', 'phone'];
const HASH = /^[0-9a-f]{64}$/;

// The web app calls GET (is my room still there?) and DELETE (unlink) from the browser. Any origin is fine:
// nothing works without a room's secret-derived token.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const withCors = r => {
  if (r.status === 101) return r; // WebSocket upgrades pass through untouched
  const out = new Response(r.body, r);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
};

// "Report a problem" from the apps: becomes a GitHub issue. GITHUB_TOKEN is a secret (fine-grained, Issues: write on
// this one repo only), so it never ships in an app.
const REPORT_REPO = 'RexSAS/Karvo';
const PER_IP_HOUR = 5, PER_DAY = 50;
const LIMITS = { title: [3, 120], text: [1, 4000], app: [0, 100], device: [0, 200] };
// Reports are public: a "@name" would notify that GitHub user, so break mentions with a zero-width space.
const noMention = s => s.replace(/@/g, '@​');

export function parseReport(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const [k, [min, max]] of Object.entries(LIMITS)) {
    const v = typeof body[k] === 'string' ? body[k].trim() : '';
    if (v.length < min || v.length > max) return null;
    out[k] = v;
  }
  return out;
}

async function report(request, env) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let r;
  try { r = parseReport(await request.json()); } catch { r = null; }
  if (!r) return new Response('Bad report', { status: 400 });
  if (!env.GITHUB_TOKEN) return new Response('Reports not configured', { status: 503 });
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  if (!(await env.REPORTS.get(env.REPORTS.idFromName('all')).allow(ip))) return new Response('Too many reports', { status: 429 });
  const gh = await fetch(`https://api.github.com/repos/${REPORT_REPO}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'karvo-link', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: noMention(r.title),
      body: `${noMention(r.text)}\n\n---\nApp: ${noMention(r.app) || '?'}\nDevice: ${noMention(r.device) || '?'}\n\n_Sent from “Report a problem” in Karvo._`,
      labels: ['from-app'],
    }),
  });
  if (!gh.ok) return new Response('GitHub error', { status: 502 });
  const { number } = await gh.json();
  return Response.json({ number });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const path = new URL(request.url).pathname;
    if (path === '/report') return withCors(await report(request, env));
    const m = path.match(/^\/room\/([A-Za-z0-9_-]{22})$/);
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

/** One instance ("all") counts reports: 5 per hour per sender, 50 a day in total. Keeps only IP hashes, for 24 hours. */
export class Reports extends DurableObject {
  async allow(ip) {
    const now = Date.now(), hour = 3600_000;
    const who = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))].map(b => b.toString(16).padStart(2, '0')).join('');
    const log = ((await this.ctx.storage.get('log')) ?? []).filter(e => now - e.t < 24 * hour);
    if (log.length >= PER_DAY || log.filter(e => e.who === who && now - e.t < hour).length >= PER_IP_HOUR) return false;
    log.push({ who, t: now });
    await this.ctx.storage.put('log', log);
    return true;
  }
}
