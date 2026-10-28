import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature } from './verify';

const secret = 'whsec_test';
const now = 1_800_000_000_000;
const body = '{"id":"evt_1","type":"claim.offered"}';
const sign = (ts: string, b = body) => createHmac('sha256', secret).update(`${ts}.${b}`).digest('hex');

describe('verifySignature', () => {
  it('accepts a correctly signed, recent delivery', () => {
    const ts = String(now - 1000);
    expect(verifySignature({ secret, timestamp: ts, signature: sign(ts), rawBody: body, nowMs: now })).toEqual({ ok: true });
  });

  it('rejects a changed body', () => {
    const ts = String(now);
    const r = verifySignature({ secret, timestamp: ts, signature: sign(ts), rawBody: body + ' ', nowMs: now });
    expect(r).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects the wrong secret', () => {
    const ts = String(now);
    const bad = createHmac('sha256', 'other').update(`${ts}.${body}`).digest('hex');
    expect(verifySignature({ secret, timestamp: ts, signature: bad, rawBody: body, nowMs: now }).ok).toBe(false);
  });

  it('rejects deliveries older than five minutes, and future-dated ones', () => {
    const old = String(now - 5 * 60 * 1000 - 1);
    expect(verifySignature({ secret, timestamp: old, signature: sign(old), rawBody: body, nowMs: now })).toEqual({ ok: false, reason: 'stale' });
    const future = String(now + 6 * 60 * 1000);
    expect(verifySignature({ secret, timestamp: future, signature: sign(future), rawBody: body, nowMs: now }).ok).toBe(false);
  });

  it('rejects missing headers and a signature of the wrong length', () => {
    expect(verifySignature({ secret, timestamp: null, signature: 'x', rawBody: body, nowMs: now })).toEqual({ ok: false, reason: 'missing_header' });
    const ts = String(now);
    expect(verifySignature({ secret, timestamp: ts, signature: 'abc', rawBody: body, nowMs: now })).toEqual({ ok: false, reason: 'bad_signature' });
  });
});
