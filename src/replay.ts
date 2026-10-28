import { dayKey, evaluate } from './engine';
import type { HistoryEvent } from './data/zikiSnapshot';
import { ISSUE_TYPES, PLATFORMS, type Agent, type Attempt, type Decision } from './types';

export interface ReplayRow {
  event: HistoryEvent;
  agent: Agent;
  decision: Decision;
}

export interface ReplaySummary {
  agent: Agent;
  total: number;
  allowed: number;
  asked: number;
  blocked: number;
  pointsAtRisk: number;
}

/** Level each agent had when the real event happened (Bebz 2.0 was a triager then). */
export const LEVEL_AT_THE_TIME: Record<string, Agent['level']> = {
  bebz: 'contributor',
  'bebz-2': 'triager',
  'bebz-5': 'triager',
};

/**
 * Re-run real agent actions through today's Briefs.
 * Missing platform or type only matters when the Brief's scope would depend on it;
 * if the scope covers every value, the decision is the same whatever the value is.
 */
export function replay(history: HistoryEvent[], agents: Agent[]): ReplayRow[] {
  const usedByDay = new Map<string, number>();
  const rows: ReplayRow[] = [];

  for (const event of history) {
    if (!event.agentId || event.action === 'resolve' || event.action === 'link_pr') continue;
    const agent = agents.find((a) => a.id === event.agentId);
    if (!agent) continue;
    const { brief } = agent;

    const platformKnown = event.platform ?? (PLATFORMS.every((p) => brief.platforms.includes(p)) ? PLATFORMS[0] : null);
    const typeKnown = event.issueType ?? (ISSUE_TYPES.every((t) => brief.issueTypes.includes(t)) ? ISSUE_TYPES[0] : null);

    let decision: Decision;
    if (!platformKnown || !typeKnown) {
      const missing = [!platformKnown && 'platform', !typeKnown && 'issue type'].filter(Boolean).join(' and ');
      decision = { outcome: 'needs_approval', reason: `Ziki has no ${missing} for #${event.issue}, so the Brief would ask you.` };
    } else {
      const attempt: Attempt = {
        id: `replay-${event.issue}-${event.at}`,
        agentId: agent.id,
        action: event.action,
        platform: platformKnown,
        issueType: typeKnown,
        severity: event.severity,
        title: event.title,
        at: event.at,
        source: 'ziki',
        issueNumber: event.issue,
      };
      const key = `${agent.id}|${event.action}|${dayKey(event.at)}`;
      const used = usedByDay.get(key) ?? 0;
      decision = evaluate(brief, used, attempt, false, LEVEL_AT_THE_TIME[agent.id] ?? agent.level);
      if (decision.outcome === 'allowed') usedByDay.set(key, used + 1);
    }
    rows.push({ event, agent, decision });
  }
  return rows;
}

export function summarise(rows: ReplayRow[]): ReplaySummary[] {
  const byAgent = new Map<string, ReplaySummary>();
  for (const { agent, decision, event } of rows) {
    const s = byAgent.get(agent.id) ?? { agent, total: 0, allowed: 0, asked: 0, blocked: 0, pointsAtRisk: 0 };
    s.total += 1;
    if (decision.outcome === 'allowed') s.allowed += 1;
    else {
      if (decision.outcome === 'needs_approval') s.asked += 1;
      else s.blocked += 1;
      s.pointsAtRisk += event.points;
    }
    byAgent.set(agent.id, s);
  }
  return [...byAgent.values()];
}
