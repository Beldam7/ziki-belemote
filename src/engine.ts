import {
  ACTIONS,
  ACTION_LABELS,
  ACTION_NOUNS,
  SEVERITIES,
  type ActionKind,
  type Agent,
  type ApprovalRequest,
  type Attempt,
  type Brief,
  type Decision,
  type LogEntry,
  type Severity,
} from './types';

export const WARN_AT = 0.8;

/**
 * What each Ziki level can do (Settings → Agents → Levels). A Brief can narrow
 * these, never widen them.
 */
export const LEVEL_ACTIONS: Record<Agent['level'], readonly ActionKind[]> = {
  contributor: ['bid', 'accept_offer', 'report', 'comment'],
  triager: ['flag_duplicate', 'comment'],
  reviewer: ['review', 'comment'],
};

export function levelAllows(level: Agent['level'], action: ActionKind): boolean {
  return LEVEL_ACTIONS[level].includes(action);
}

export function severityRank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

export function defaultBrief(now: Date = new Date()): Brief {
  return {
    version: 1,
    platforms: ['Desktop', 'Web'],
    issueTypes: ['Fix'],
    maxSeverity: 'medium',
    rules: {
      bid: { mode: 'allow', dailyLimit: 2 },
      accept_offer: { mode: 'allow', dailyLimit: 2 },
      review: { mode: 'allow', dailyLimit: 10 },
      flag_duplicate: { mode: 'never', dailyLimit: null },
      report: { mode: 'ask', dailyLimit: 3 },
      comment: { mode: 'allow', dailyLimit: null },
    },
    askTimeoutMinutes: 30,
    onTimeout: 'skip',
    handoffTo: '',
    updatedAt: now.toISOString(),
  };
}

/** A starting Brief that fits what each Ziki level is for. */
export function briefForLevel(level: Agent['level'], now: Date = new Date()): Brief {
  const base = defaultBrief(now);
  const never = { mode: 'never' as const, dailyLimit: null };
  const rules = Object.fromEntries(
    ACTIONS.map((a) => [a, levelAllows(level, a) ? base.rules[a] : never]),
  ) as Brief['rules'];

  if (level === 'triager') {
    return {
      ...base,
      platforms: ['Desktop', 'Web', 'Mobile'],
      issueTypes: ['Fix', 'Feat', 'Design', 'Marketing'],
      maxSeverity: 'critical',
      // Stop below the point where Ziki has demoted triagers before (about 10 flags).
      rules: { ...rules, flag_duplicate: { mode: 'allow', dailyLimit: 8 } },
      onTimeout: 'wait',
    };
  }
  if (level === 'reviewer') {
    return {
      ...base,
      platforms: ['Desktop', 'Web', 'Mobile'],
      issueTypes: ['Fix', 'Feat', 'Design', 'Marketing'],
      maxSeverity: 'high',
      rules,
      onTimeout: 'handoff',
      handoffTo: 'Team lead',
    };
  }
  return { ...base, rules };
}

/** Day key used for daily limits (UTC date). */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** How many times this agent executed the action on the same day as `nowIso`. */
export function usedToday(log: LogEntry[], agentId: string, action: ActionKind, nowIso: string): number {
  const day = dayKey(nowIso);
  return log.filter(
    (e) =>
      e.agentId === agentId &&
      (e.kind === 'auto_allowed' || e.kind === 'approved') &&
      e.attempt?.action === action &&
      dayKey(e.at) === day,
  ).length;
}

export function usageSummary(brief: Brief, log: LogEntry[], agentId: string, nowIso: string) {
  return ACTIONS.map((action) => {
    const used = usedToday(log, agentId, action, nowIso);
    const limit = brief.rules[action].dailyLimit;
    const ratio = limit ? used / limit : 0;
    return { action, used, limit, ratio, warn: limit !== null && limit > 0 && ratio >= WARN_AT };
  });
}

export function evaluate(
  brief: Brief,
  used: number,
  attempt: Attempt,
  paused = false,
  level?: Agent['level'],
): Decision {
  const rule = brief.rules[attempt.action];
  const label = ACTION_LABELS[attempt.action].toLowerCase();

  if (paused) {
    return { outcome: 'blocked', reason: 'The owner paused this agent.' };
  }
  if (level && !levelAllows(level, attempt.action)) {
    return { outcome: 'blocked', reason: `Ziki does not let a ${level} ${label}.` };
  }
  if (rule.mode === 'never') {
    return { outcome: 'blocked', reason: `The Brief says never to ${label}.` };
  }
  if (rule.dailyLimit !== null && used >= rule.dailyLimit) {
    return {
      outcome: 'blocked',
      reason: `Daily limit reached (${used} of ${rule.dailyLimit} ${ACTION_NOUNS[attempt.action]}). Stopped before it was sent to Ziki.`,
    };
  }
  if (!brief.platforms.includes(attempt.platform)) {
    return { outcome: 'needs_approval', reason: `${attempt.platform} is outside this agent's scope.` };
  }
  if (!brief.issueTypes.includes(attempt.issueType)) {
    return { outcome: 'needs_approval', reason: `${attempt.issueType} issues are outside this agent's scope.` };
  }
  if (severityRank(attempt.severity) > severityRank(brief.maxSeverity)) {
    return {
      outcome: 'needs_approval',
      reason: `${attempt.severity[0].toUpperCase()}${attempt.severity.slice(1)} severity is above the ${brief.maxSeverity} limit for acting without asking.`,
    };
  }
  if (rule.mode === 'ask') {
    return { outcome: 'needs_approval', reason: `The Brief says to ask before you ${label}.` };
  }

  const decision: Decision = { outcome: 'allowed', reason: `Within the Brief: ${label}.` };
  if (rule.dailyLimit !== null && rule.dailyLimit > 0 && (used + 1) / rule.dailyLimit >= WARN_AT) {
    decision.warning = `${used + 1} of ${rule.dailyLimit} ${ACTION_NOUNS[attempt.action]} used today.`;
  }
  return decision;
}

export function createRequest(
  attempt: Attempt,
  decision: Decision,
  brief: Brief,
  now: Date,
  id: string,
): ApprovalRequest {
  return {
    id,
    attempt,
    reason: decision.reason,
    briefVersion: brief.version,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + brief.askTimeoutMinutes * 60_000).toISOString(),
    status: 'pending',
  };
}

export interface ExpiryResult {
  requests: ApprovalRequest[];
  /** Requests that changed status in this pass. */
  changed: ApprovalRequest[];
}

/** Apply the hand-off rule to pending requests whose time ran out. */
export function resolveExpired(requests: ApprovalRequest[], brief: Brief, now: Date): ExpiryResult {
  const changed: ApprovalRequest[] = [];
  const next = requests.map((r) => {
    if (r.status !== 'pending' || new Date(r.expiresAt).getTime() > now.getTime()) return r;
    let updated: ApprovalRequest;
    if (brief.onTimeout === 'skip') {
      updated = { ...r, status: 'skipped', resolvedAt: now.toISOString() };
    } else if (brief.onTimeout === 'handoff' && brief.handoffTo.trim()) {
      updated = { ...r, status: 'handed_off', handedOffTo: brief.handoffTo.trim(), resolvedAt: now.toISOString() };
    } else if (brief.onTimeout === 'handoff') {
      // Nobody to hand off to: fall back to skipping rather than leaving it hanging.
      updated = { ...r, status: 'skipped', resolvedAt: now.toISOString() };
    } else {
      updated = { ...r, status: 'waiting' };
    }
    changed.push(updated);
    return updated;
  });
  return { requests: next, changed };
}

export function answerRequest(r: ApprovalRequest, approve: boolean, now: Date): ApprovalRequest {
  if (r.status !== 'pending' && r.status !== 'waiting') return r;
  return { ...r, status: approve ? 'approved' : 'denied', resolvedAt: now.toISOString() };
}

export function minutesLeft(r: ApprovalRequest, now: Date): number {
  return Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - now.getTime()) / 60_000));
}
