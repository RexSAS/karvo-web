// Writes test/vectors/link-v1.json with node:crypto, independently of the Web Crypto code in link/crypto.js.
// The Android tests use the same file, so both sides prove they encrypt identically.
import { hkdfSync, createCipheriv, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const range = (a, n) => Buffer.from(Array.from({ length: n }, (_, i) => a + i));
const secret = range(0, 32), roomId = range(100, 16), nonce = range(200, 12);
const plaintext = Buffer.from('{"s":null,"q":0,"t":"hello"}');
const hkdf = info => Buffer.from(hkdfSync('sha256', secret, roomId, info, 32));
const keys = {
  pcToPhone: hkdf('karvo-link v1 pc->phone'), phoneToPc: hkdf('karvo-link v1 phone->pc'),
  authPc: hkdf('karvo-link v1 auth pc'), authPhone: hkdf('karvo-link v1 auth phone'),
};
const seal = (key, dir) => {
  const c = createCipheriv('aes-256-gcm', key, nonce);
  c.setAAD(Buffer.concat([roomId, Buffer.from([dir])]));
  return Buffer.concat([nonce, c.update(plaintext), c.final(), c.getAuthTag()]);
};
const hex = b => b.toString('hex');
writeFileSync(new URL('../test/vectors/link-v1.json', import.meta.url), JSON.stringify({
  secret: hex(secret), roomId: hex(roomId), nonce: hex(nonce), plaintext: plaintext.toString(),
  pcToPhone: hex(keys.pcToPhone), phoneToPc: hex(keys.phoneToPc), authPc: hex(keys.authPc), authPhone: hex(keys.authPhone),
  authPcSha256: hex(createHash('sha256').update(keys.authPc).digest()),
  authPhoneSha256: hex(createHash('sha256').update(keys.authPhone).digest()),
  framePcToPhone: hex(seal(keys.pcToPhone, 1)), framePhoneToPc: hex(seal(keys.phoneToPc, 2)),
}, null, 2) + '\n');
