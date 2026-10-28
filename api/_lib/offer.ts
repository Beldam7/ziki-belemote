import { evaluate } from '../../src/engine';
import type { Attempt, Brief, Decision, IssueType, Platform, Severity } from '../../src/types';
import { ISSUE_TYPES, PLATFORMS, SEVERITIES } from '../../src/types';

/** The few fields we read from a Ziki issue. Everything is optional because the API may omit it. */
export interface IssueInfo {
  id?: string;
  number?: number;
  title?: string;
  severity?: string;
  type?: { name?: string } | string | null;
  typeName?: string | null;
}

export interface OfferEvent {
  eventId: string | null;
  type: string | null;
  claimId: string | null;
  issueId: string | null;
}

/** Pull the ids we need out of a webhook body without assuming its exact shape. */
export function parseOfferEvent(body: unknown): OfferEvent {
  const b = (body ?? {}) as Record<string, unknown>;
  const payload = ((b.payload ?? b.data ?? {}) as Record<string, unknown>) || {};
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    eventId: str(b.id),
    type: str(b.type),
    claimId: str(payload.claimId) ?? str(payload.offerId) ?? str(payload.id),
    issueId: str(payload.issueId) ?? str(payload.bugId),
  };
}

/** Platform from a title such as "[Bug] Desktop: ..." or "Web: ...". Null when it is not stated. */
export function inferPlatform(title: string | undefined): Platform | null {
  if (!title) return null;
  const head = title.slice(0, 40).toLowerCase();
  return PLATFORMS.find((p) => new RegExp(`\\b${p.toLowerCase()}\\b`).test(head)) ?? null;
}

export function inferIssueType(issue: IssueInfo): IssueType | null {
  const raw = typeof issue.type === 'string' ? issue.type : issue.type?.name ?? issue.typeName ?? null;
  return ISSUE_TYPES.find((t) => t.toLowerCase() === raw?.toLowerCase()) ?? null;
}

export function inferSeverity(issue: IssueInfo): Severity | null {
  return SEVERITIES.find((s) => s === issue.severity?.toLowerCase()) ?? null;
}

/**
 * Decide what to do with an offer. Anything we cannot read becomes "ask the owner":
 * the receiver never accepts on a guess.
 */
export function decideOffer(brief: Brief, issue: IssueInfo, nowIso: string): { decision: Decision; attempt: Attempt | null } {
  const platform = inferPlatform(issue.title);
  const issueType = inferIssueType(issue);
  const severity = inferSeverity(issue);

  if (!platform || !issueType || !severity) {
    const missing = [!platform && 'platform', !issueType && 'issue type', !severity && 'severity'].filter(Boolean).join(', ');
    return { decision: { outcome: 'needs_approval', reason: `Could not read the ${missing} for this offer, so it needs your yes.` }, attempt: null };
  }

  const attempt: Attempt = {
    id: `offer-${issue.id ?? issue.number ?? nowIso}`,
    agentId: 'webhook',
    action: 'accept_offer',
    platform,
    issueType,
    severity,
    title: issue.title ?? 'Untitled issue',
    at: nowIso,
  };
  // Daily limits need a store; this receiver is stateless, so usage is treated as zero.
  return { decision: evaluate(brief, 0, attempt), attempt };
}
