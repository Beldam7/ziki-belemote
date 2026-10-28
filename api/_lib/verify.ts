import { createHmac, timingSafeEqual } from 'node:crypto';

export const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export interface VerifyInput {
  secret: string;
  /** Value of the X-Ziki-Timestamp header (Unix epoch milliseconds). */
  timestamp: string | null;
  /** Value of the X-Ziki-Signature header (lowercase hex HMAC-SHA256). */
  signature: string | null;
  /** The exact bytes received, as text. Never re-serialise parsed JSON. */
  rawBody: string;
  nowMs?: number;
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'missing_header' | 'stale' | 'bad_signature' };

/** Ziki signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the subscription secret. */
export function verifySignature({ secret, timestamp, signature, rawBody, nowMs = Date.now() }: VerifyInput): VerifyResult {
  if (!timestamp || !signature) return { ok: false, reason: 'missing_header' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs - ts) > REPLAY_WINDOW_MS) return { ok: false, reason: 'stale' };

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };
  return { ok: true };
}
