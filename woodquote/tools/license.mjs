#!/usr/bin/env node
// WoodQuote licence tool for the developer.
//
//   node tools/license.mjs setup customer@example.com   → secret + otpauth link (add to your authenticator app)
//   node tools/license.mjs code  customer@example.com   → the current 6-digit code
//   node tools/license.mjs pin   123456                 → hash to use as VITE_WQ_DEV_PIN_HASH
//
// Uses the same master key as the app: set WQ_LICENSE_KEY to the value of
// VITE_WQ_LICENSE_KEY you build the app with (or leave both unset).
import { createHash, createHmac } from 'node:crypto';

const MASTER = process.env.WQ_LICENSE_KEY || 'WoodQuote-2601-licence-master-key';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const norm = (e) => e.trim().toLowerCase();
const secretFor = (email) => createHmac('sha256', MASTER).update(`woodquote-licence:${norm(email)}`).digest().subarray(0, 20);
function base32(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function totp(secret, step) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', secret).update(msg).digest();
  const o = h[19] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'setup' && arg) {
  const s = base32(secretFor(arg));
  console.log(`Customer:   ${norm(arg)}\nSetup key:  ${s}\nLink:       otpauth://totp/${encodeURIComponent(`WoodQuote:${norm(arg)}`)}?secret=${s}&issuer=WoodQuote&algorithm=SHA1&digits=6&period=30`);
  console.log('\nIn Google / Microsoft Authenticator: Add → Enter a setup key → account name = the email, key = the setup key, time based.');
} else if (cmd === 'code' && arg) {
  const step = Math.floor(Date.now() / 30000);
  console.log(totp(secretFor(arg), step), `(valid about 2 minutes, for ${norm(arg)})`);
} else if (cmd === 'pin' && arg) {
  console.log(createHash('sha256').update(`woodquote-dev:${arg}`).digest('hex'));
} else {
  console.log('Usage:\n  node tools/license.mjs setup <email>\n  node tools/license.mjs code <email>\n  node tools/license.mjs pin <new PIN>');
}
