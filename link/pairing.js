// Pairing payload shown as a QR on the PC and scanned by the phone (spec "Pairing").
import { randomBytes, b64url, fromB64url } from './crypto.js';

export function newPairing(name) {
  const roomId = randomBytes(16), secret = randomBytes(32);
  return { roomId, secret, qrText: `karvo:link?v=1&r=${b64url(roomId)}&k=${b64url(secret)}&n=${encodeURIComponent(name)}` };
}

export function parseQr(text) {
  if (!text.startsWith('karvo:link?')) throw new Error('Not a Karvo link code');
  const p = new URLSearchParams(text.slice('karvo:link?'.length));
  if (p.get('v') !== '1') throw new Error('Unsupported link code version');
  const roomId = fromB64url(p.get('r') ?? ''), secret = fromB64url(p.get('k') ?? '');
  if (roomId.length !== 16 || secret.length !== 32) throw new Error('Damaged link code');
  return { roomId, secret, name: p.get('n') ?? '' };
}

export function pcName(ua) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : null;
  return browser && os ? `${browser} on ${os}` : browser ?? 'Browser';
}
