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

/**
 * The highest daily limit a Brief may set for each action, so an agent never gets
 * close to what Ziki refuses, flags or demotes for (see https://ziki.dev/llms.txt).
 * `why` is a clause that finishes the sentence "Up to {max} a day, ...".
 */
export const SAFE_DAILY_LIMITS: Record<ActionKind, { max: number; why: string }> = {
  bid: { max: 2, why: 'because Ziki lets one person hold at most 2 active claims, and a bid that wins becomes a claim' },
  accept_offer: {
    max: 2,
    why: 'because Ziki lets one person hold at most 2 active claims, and 3 claims released for silence in 7 days demotes a contributor',
  },
  review: { max: 30, why: "so this action alone never goes past Ziki's standard budget of 30 writes an hour" },
  flag_duplicate: { max: 8, why: 'because Ziki demoted Bebz 5.0 from triager after 10 flags in one run' },
  report: { max: 30, why: "so this action alone never goes past Ziki's standard budget of 30 writes an hour" },
  comment: { max: 30, why: "so this action alone never goes past Ziki's standard budget of 30 writes an hour" },
};

/** The limit that applies: the Brief's own, never above the safe maximum. */
export function effectiveLimit(action: ActionKind, dailyLimit: number | null): number {
  const { max } = SAFE_DAILY_LIMITS[action];
  return dailyLimit === null ? max : Math.min(dailyLimit, max);
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
      flag_duplicate: { mode: 'never', dailyLimit: 8 },
      report: { mode: 'ask', dailyLimit: 3 },
      comment: { mode: 'allow', dailyLimit: 30 },
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
    const limit = effectiveLimit(action, brief.rules[action].dailyLimit);
    const ratio = limit ? used / limit : 0;
    return { action, used, limit, ratio, warn: limit > 0 && ratio >= WARN_AT };
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
  const limit = effectiveLimit(attempt.action, rule.dailyLimit);
  const label = ACTION_LABELS[attempt.action].toLowerCase();

  if (paused) {
    return { outcome: 'blocked', reason: "You've paused this agent, so it won't act until you resume it." };
  }
  if (level && !levelAllows(level, attempt.action)) {
    return { outcome: 'blocked', reason: `A ${level} can't ${label} on Ziki.` };
  }
  if (rule.mode === 'never') {
    return { outcome: 'blocked', reason: `Its Brief says never to ${label}.` };
  }
  if (used >= limit) {
    return {
      outcome: 'blocked',
      reason: `Daily limit reached: ${used} of ${limit} ${ACTION_NOUNS[attempt.action]} already today. Stopped before it was sent to Ziki.`,
    };
  }
  if (!brief.platforms.includes(attempt.platform)) {
    return { outcome: 'needs_approval', reason: `${attempt.platform} is outside where this agent can act on its own.` };
  }
  if (!brief.issueTypes.includes(attempt.issueType)) {
    return { outcome: 'needs_approval', reason: `${attempt.issueType} issues are outside what this agent handles on its own.` };
  }
  if (severityRank(attempt.severity) > severityRank(brief.maxSeverity)) {
    return {
      outcome: 'needs_approval',
      reason: `${attempt.severity[0].toUpperCase()}${attempt.severity.slice(1)} severity is more serious than the ${brief.maxSeverity} it handles on its own.`,
    };
  }
  if (rule.mode === 'ask') {
    return { outcome: 'needs_approval', reason: 'Its Brief says to ask you first.' };
  }

  const decision: Decision = { outcome: 'allowed', reason: 'This is inside its Brief, so it can go ahead.' };
  if (limit > 0 && (used + 1) / limit >= WARN_AT) {
    decision.warning = `${used + 1} of ${limit} ${ACTION_NOUNS[attempt.action]} used today.`;
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
