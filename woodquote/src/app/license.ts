// Licensing: WoodQuote opens only with a licence tied to an email address.
// The developer gives each customer a 6-digit code from an authenticator app
// (Google / Microsoft Authenticator…); each customer email has its own secret
// derived from the developer's master key, so a code only works for that
// email. A code unlocks the app for 30 days; renewing adds another 30 days.
//
// The master key is built into the app (set VITE_WQ_LICENSE_KEY when building
// to use your own). Anyone who extracts it from the app could make codes, so
// for strong protection move the check to a server later.

const MASTER = (import.meta.env.VITE_WQ_LICENSE_KEY as string | undefined) || 'WoodQuote-2601-licence-master-key';
/** SHA-256 of the developer PIN that opens the licence manager (default PIN 260126). */
const DEV_PIN_HASH = (import.meta.env.VITE_WQ_DEV_PIN_HASH as string | undefined) || '';
export const LICENSE_DAYS = 30;
/** Codes are accepted for this many 30-second steps either side (allows for reading the code out). */
const WINDOW = 4;
const STORE = 'woodquote-licence';
const DAY = 86_400_000;

const enc = new TextEncoder();
export const normEmail = (e: string) => e.trim().toLowerCase();

/* ------------------------------------------------------------ crypto */

async function hmac(alg: 'SHA-1' | 'SHA-256', key: Uint8Array | string, data: Uint8Array | string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', (typeof key === 'string' ? enc.encode(key) : key) as BufferSource, { name: 'HMAC', hash: alg }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, (typeof data === 'string' ? enc.encode(data) : data) as BufferSource));
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
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

/** The authenticator secret for one customer email (20 bytes, shown as base32). */
export async function secretFor(email: string): Promise<Uint8Array> {
  return (await hmac('SHA-256', MASTER, `woodquote-licence:${normEmail(email)}`)).slice(0, 20);
}

/** Standard TOTP (RFC 6238: 30 s, 6 digits, SHA-1) — what authenticator apps show. */
export async function totp(secret: Uint8Array, step: number): Promise<string> {
  const msg = new Uint8Array(8);
  let s = step;
  for (let i = 7; i >= 0; i--) {
    msg[i] = s & 0xff;
    s = Math.floor(s / 256);
  }
  const h = await hmac('SHA-1', secret, msg);
  const o = h[19] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

export const stepAt = (t = Date.now()) => Math.floor(t / 30_000);

/** The step a code belongs to, or null when it is not valid for this email right now. */
export async function checkCode(email: string, code: string, now = Date.now()): Promise<number | null> {
  const c = code.replace(/\D/g, '');
  if (c.length !== 6 || !normEmail(email).includes('@')) return null;
  const sec = await secretFor(email);
  const s0 = stepAt(now);
  for (let d = -WINDOW; d <= WINDOW; d++) if ((await totp(sec, s0 + d)) === c) return s0 + d;
  return null;
}

/** otpauth:// link for adding a customer to an authenticator app (QR code). */
export async function setupFor(email: string) {
  const secret = base32(await secretFor(email));
  const label = encodeURIComponent(`WoodQuote:${normEmail(email)}`);
  return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=WoodQuote&algorithm=SHA1&digits=6&period=30` };
}

/* ------------------------------------------------------------ licence */

export interface Licence {
  email: string;
  activatedAt: number;
  expiresAt: number;
  lastSeen: number;
  lastStep: number;
  device: string;
  sig: string;
}

export type LicenceState =
  | { ok: true; licence: Licence; daysLeft: number }
  | { ok: false; reason: 'none' | 'expired' | 'invalid' | 'clock'; licence: Licence | null };

const sign = async (l: Omit<Licence, 'sig' | 'lastSeen'>) => hex(await hmac('SHA-256', MASTER, `${normEmail(l.email)}|${l.activatedAt}|${l.expiresAt}|${l.lastStep}|${l.device}`));

function load(): Licence | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Licence) : null;
  } catch {
    return null;
  }
}
function save(l: Licence) {
  try {
    localStorage.setItem(STORE, JSON.stringify(l));
  } catch {
    /* storage blocked */
  }
}
function deviceId(): string {
  try {
    let id = localStorage.getItem('woodquote-device');
    if (!id) {
      id = hex(crypto.getRandomValues(new Uint8Array(12)));
      localStorage.setItem('woodquote-device', id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

export async function licenceState(now = Date.now()): Promise<LicenceState> {
  const l = load();
  if (!l) return { ok: false, reason: 'none', licence: null };
  const { sig, lastSeen, ...rest } = l;
  if (sig !== (await sign(rest)) || l.device !== deviceId()) return { ok: false, reason: 'invalid', licence: l };
  // the clock was put back to stretch the licence
  if (now < lastSeen - DAY) return { ok: false, reason: 'clock', licence: l };
  if (now >= l.expiresAt) return { ok: false, reason: 'expired', licence: l };
  if (now > lastSeen) save({ ...l, lastSeen: now });
  return { ok: true, licence: l, daysLeft: Math.ceil((l.expiresAt - now) / DAY) };
}

/** Activate or renew with a code from the developer. Renewing early keeps the days left. */
export async function activate(email: string, code: string, now = Date.now()): Promise<Licence> {
  const step = await checkCode(email, code, now);
  if (step == null) throw new Error('That code is not valid for this email. Codes change every 30 seconds — ask for a fresh one and enter it straight away.');
  const prev = load();
  const same = prev && normEmail(prev.email) === normEmail(email);
  if (same && step <= prev.lastStep) throw new Error('That code has already been used. Ask for a new one.');
  const base = same && prev.expiresAt > now ? prev.expiresAt : now;
  const rest = { email: normEmail(email), activatedAt: now, expiresAt: base + LICENSE_DAYS * DAY, lastStep: step, device: deviceId() };
  const l: Licence = { ...rest, lastSeen: now, sig: await sign(rest) };
  save(l);
  return l;
}

export async function checkDevPin(pin: string): Promise<boolean> {
  const h = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`woodquote-dev:${pin}`))));
  return DEV_PIN_HASH ? h === DEV_PIN_HASH : pin === '260126';
}
