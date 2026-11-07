// Link encryption (spec "Crypto"): HKDF-SHA256 keys from the QR secret, AES-256-GCM frames.
// test/vectors/link-v1.json pins the exact bytes; the Android app checks the same file.
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const randomBytes = n => globalThis.crypto.getRandomValues(new Uint8Array(n));

export const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function hkdf(secret, roomId, info) {
  const base = await subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: roomId, info: enc.encode(info) }, base, 256));
}
const aesKey = raw => subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function deriveKeys(secret, roomId) {
  const [pc, phone, authPc, authPhone] = await Promise.all(
    ['pc->phone', 'phone->pc', 'auth pc', 'auth phone'].map(s => hkdf(secret, roomId, `karvo-link v1 ${s}`)));
  return { pcToPhone: await aesKey(pc), phoneToPc: await aesKey(phone), authPc, authPhone };
}

export const sha256Hex = async bytes =>
  [...new Uint8Array(await subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');

const aad = (roomId, direction) => { const a = new Uint8Array(roomId.length + 1); a.set(roomId); a[roomId.length] = direction; return a; };

// Random nonces, not counters: the same keys are reused across sessions, so a counter would repeat.
export async function seal(key, roomId, direction, plaintext, nonce = randomBytes(12)) {
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(roomId, direction), tagLength: 128 }, key, plaintext));
  const frame = new Uint8Array(12 + ct.length); frame.set(nonce); frame.set(ct, 12);
  return frame;
}

export async function open(key, roomId, direction, frame) {
  if (frame.length < 28) throw new Error('frame too short');
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: frame.slice(0, 12), additionalData: aad(roomId, direction), tagLength: 128 }, key, frame.slice(12)));
}
