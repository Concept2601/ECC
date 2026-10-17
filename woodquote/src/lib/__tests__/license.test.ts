import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { base32, checkCode, secretFor, setupFor, stepAt, totp } from '../../app/license';

describe('licence codes', () => {
  it('matches the RFC 6238 test vector (what authenticator apps compute)', async () => {
    const secret = new TextEncoder().encode('12345678901234567890');
    expect(await totp(secret, 1)).toBe('287082');
    expect(await totp(secret, Math.floor(1111111109 / 30))).toBe('081804');
  });
  it('gives each email its own secret, same as the developer tool', async () => {
    const a = base32(await secretFor('Client@Example.com '));
    const b = base32(await secretFor('other@example.com'));
    expect(a).not.toBe(b);
    expect(a).toHaveLength(32);
    const out = execFileSync('node', ['tools/license.mjs', 'setup', 'client@example.com']).toString();
    expect(out).toContain(a);
    expect((await setupFor('client@example.com')).uri).toContain(`secret=${a}`);
  });
  it('accepts the current code for that email only, and rejects old codes', async () => {
    const code = await totp(await secretFor('a@b.co'), stepAt());
    expect(await checkCode('a@b.co', code)).not.toBeNull();
    expect(await checkCode('x@b.co', code)).toBeNull();
    expect(await checkCode('a@b.co', code, Date.now() + 10 * 60_000)).toBeNull();
    const tool = execFileSync('node', ['tools/license.mjs', 'code', 'a@b.co']).toString().slice(0, 6);
    expect(await checkCode('a@b.co', tool)).not.toBeNull();
  });
});
