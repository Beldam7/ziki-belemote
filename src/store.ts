import { useEffect, useReducer } from 'react';
import { answerRequest, briefForLevel, createRequest, evaluate, resolveExpired, usedToday } from './engine';
import { HISTORY, MY_AGENTS } from './data/zikiSnapshot';
import { ACTION_LABELS, type Agent, type Attempt, type Brief, type LogEntry, type State } from './types';

const STORAGE_KEY = 'agent-briefs:v3';

/** Pseudo agent id for things the owner did by hand on Ziki. */
export const OWNER_ID = 'owner';

export type Action =
  | { type: 'select'; agentId: string }
  | { type: 'add_agent'; id: string; name: string; level: Agent['level']; now: string }
  | { type: 'save_brief'; agentId: string; brief: Omit<Brief, 'version' | 'updatedAt'>; now: string }
  | { type: 'toggle_pause'; agentId: string; now: string }
  | { type: 'attempt'; attempt: Attempt }
  | { type: 'answer'; requestId: string; approve: boolean; now: string }
  | { type: 'tick'; now: string }
  /** Demo only: make these open requests run out of time now. */
  | { type: 'expire_now'; requestIds: string[]; now: string }
  | { type: 'reset'; now: string; empty?: boolean };

function entry(id: string, at: string, agent: Agent, kind: LogEntry['kind'], note: string, attempt?: Attempt): LogEntry {
  return {
    id,
    at,
    agentId: agent.id,
    kind,
    attempt,
    briefVersion: agent.brief.version,
    note,
    source: attempt?.source,
    issueNumber: attempt?.issueNumber,
  };
}

function historyLog(): LogEntry[] {
  return HISTORY.map((e, i) => ({
    id: `ziki-${i}`,
    at: e.at,
    agentId: e.agentId ?? OWNER_ID,
    kind: 'history' as const,
    briefVersion: 0,
    note: e.what,
    source: 'ziki' as const,
    points: e.points,
    issueNumber: e.issue,
    title: e.title,
    actionLabel:
      e.action === 'resolve' ? 'resolved the issue' : e.action === 'link_pr' ? 'linked a PR' : ACTION_LABELS[e.action].toLowerCase(),
    attempt:
      e.action === 'resolve' || e.action === 'link_pr' || !e.platform || !e.issueType
        ? undefined
        : {
            id: `ziki-${i}`,
            agentId: e.agentId ?? OWNER_ID,
            action: e.action,
            platform: e.platform,
            issueType: e.issueType,
            severity: e.severity,
            title: e.title,
            at: e.at,
            source: 'ziki' as const,
            issueNumber: e.issue,
          },
  })).reverse();
}

/** Scripted, clearly labelled demo actions, a few minutes apart, ending just before `now`. */
function demoAttempts(now: Date): Attempt[] {
  const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60_000).toISOString();
  const demo = (id: string, minsAgo: number, a: Omit<Attempt, 'id' | 'at' | 'source'>): Attempt => ({ id: `demo-${id}`, at: at(minsAgo), source: 'demo', ...a });
  return [
    demo('r1', 95, { agentId: 'bebz-4', action: 'review', platform: 'Desktop', issueType: 'Fix', severity: 'medium', title: 'Settings tab order skips the Save button' }),
    demo('r2', 80, { agentId: 'bebz-3', action: 'review', platform: 'Web', issueType: 'Fix', severity: 'low', title: 'Tooltip text is cut off on narrow screens' }),
    demo('c1', 70, { agentId: 'bebz', action: 'comment', platform: 'Desktop', issueType: 'Fix', severity: 'medium', title: 'Asked the reporter for the Windows build log' }),
    demo('f1', 60, { agentId: 'bebz-5', action: 'flag_duplicate', platform: 'Web', issueType: 'Fix', severity: 'medium', title: 'Login button overlaps the menu at 375 px' }),
    demo('b1', 45, { agentId: 'bebz', action: 'bid', platform: 'Desktop', issueType: 'Fix', severity: 'medium', title: 'Emoji picker stays open after sending' }),
    // The Brief stops this one outright: reviewers cannot bid on Ziki.
    demo('x1', 25, { agentId: 'bebz-4', action: 'bid', platform: 'Desktop', issueType: 'Fix', severity: 'low', title: 'Reviewer tries to bid on a fix' }),
    // These three need the owner, so they wait in Approvals (recent, so they have time left).
    demo('o1', 12, { agentId: 'bebz', action: 'accept_offer', platform: 'Mobile', issueType: 'Fix', severity: 'medium', title: 'Reactions overlap the keyboard in DMs' }),
    demo('b2', 8, { agentId: 'bebz', action: 'bid', platform: 'Desktop', issueType: 'Fix', severity: 'high', title: 'App crashes when a workspace has no channels' }),
    demo('r3', 4, { agentId: 'bebz-4', action: 'review', platform: 'Web', issueType: 'Fix', severity: 'critical', title: 'Session token visible in the page source' }),
  ];
}

export function seed(now: string, empty = false): State {
  const t = new Date(now);
  const agents: Agent[] = MY_AGENTS.map((a) => ({ ...a, paused: false, brief: briefForLevel(a.level, t) }));
  const base: State = { agents, requests: [], log: empty ? [] : historyLog(), selectedAgentId: 'bebz' };
  if (empty) return base;
  // Run the demo through the real reducer so it follows exactly the same rules.
  return demoAttempts(t).reduce((s, attempt) => reducer(s, { type: 'attempt', attempt }), base);
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'select':
      return { ...state, selectedAgentId: action.agentId };

    case 'add_agent': {
      const agent: Agent = {
        id: action.id,
        name: action.name.trim() || 'Unnamed agent',
        level: action.level,
        paused: false,
        brief: briefForLevel(action.level, new Date(action.now)),
        lastSeen: null,
      };
      return { ...state, agents: [...state.agents, agent], selectedAgentId: agent.id };
    }

    case 'save_brief':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === action.agentId ? { ...a, brief: { ...action.brief, version: a.brief.version + 1, updatedAt: action.now } } : a,
        ),
      };

    case 'toggle_pause': {
      const agent = state.agents.find((a) => a.id === action.agentId);
      if (!agent) return state;
      const paused = !agent.paused;
      return {
        ...state,
        agents: state.agents.map((a) => (a.id === agent.id ? { ...a, paused } : a)),
        log: [
          entry(`log-pause-${action.now}-${agent.id}`, action.now, agent, 'paused', paused ? 'You paused this agent.' : 'You resumed this agent.'),
          ...state.log,
        ],
      };
    }

    case 'attempt': {
      const { attempt } = action;
      const agent = state.agents.find((a) => a.id === attempt.agentId);
      if (!agent) return state;
      const used = usedToday(state.log, agent.id, attempt.action, attempt.at);
      const decision = evaluate(agent.brief, used, attempt, agent.paused, agent.level);
      const agents = state.agents.map((a) => (a.id === agent.id ? { ...a, lastSeen: attempt.at } : a));

      if (decision.outcome === 'allowed') {
        const note = decision.warning ? `${decision.reason} Heads up: ${decision.warning}` : decision.reason;
        return { ...state, agents, log: [entry(`log-${attempt.id}`, attempt.at, agent, 'auto_allowed', note, attempt), ...state.log] };
      }
      if (decision.outcome === 'blocked') {
        return { ...state, agents, log: [entry(`log-${attempt.id}`, attempt.at, agent, 'blocked', decision.reason, attempt), ...state.log] };
      }
      const request = createRequest(attempt, decision, agent.brief, new Date(attempt.at), `req-${attempt.id}`);
      return {
        ...state,
        agents,
        requests: [request, ...state.requests],
        log: [entry(`log-${attempt.id}`, attempt.at, agent, 'requested', decision.reason, attempt), ...state.log],
      };
    }

    case 'answer': {
      const request = state.requests.find((r) => r.id === action.requestId);
      if (!request) return state;
      const agent = state.agents.find((a) => a.id === request.attempt.agentId);
      if (!agent) return state;
      const answered = answerRequest(request, action.approve, new Date(action.now));
      if (answered === request) return state;
      return {
        ...state,
        requests: state.requests.map((r) => (r.id === request.id ? answered : r)),
        log: [
          entry(
            `log-${request.id}-${answered.status}`,
            action.now,
            agent,
            action.approve ? 'approved' : 'denied',
            action.approve ? 'You approved this. The agent can go ahead.' : "You declined this. The agent won't do it.",
            request.attempt,
          ),
          ...state.log,
        ],
      };
    }

    case 'expire_now':
      return {
        ...state,
        requests: state.requests.map((r) =>
          action.requestIds.includes(r.id) && r.status === 'pending' ? { ...r, expiresAt: action.now } : r,
        ),
      };

    case 'tick': {
      const now = new Date(action.now);
      let requests = state.requests;
      let log = state.log;
      for (const agent of state.agents) {
        const mine = requests.filter((r) => r.attempt.agentId === agent.id);
        const { requests: updated, changed } = resolveExpired(mine, agent.brief, now);
        if (changed.length === 0) continue;
        const byId = new Map(updated.map((r) => [r.id, r]));
        requests = requests.map((r) => byId.get(r.id) ?? r);
        const entries = changed
          .filter((r) => r.status === 'skipped' || r.status === 'handed_off')
          .map((r) =>
            entry(
              `log-${r.id}-${r.status}`,
              action.now,
              agent,
              r.status === 'skipped' ? 'skipped' : 'handed_off',
              r.status === 'skipped' ? "You didn't answer in time, so its Brief skipped it." : `You didn't answer in time, so it was handed to ${r.handedOffTo}.`,
              r.attempt,
            ),
          );
        log = [...entries, ...log];
      }
      return requests === state.requests ? state : { ...state, requests, log };
    }

    case 'reset':
      return seed(action.now, action.empty);
  }
}

function load(now: string): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (Array.isArray(parsed.agents) && Array.isArray(parsed.requests) && Array.isArray(parsed.log)) return parsed;
    }
  } catch {
    // Storage can be blocked or hold bad data; start fresh.
  }
  return seed(now);
}

export function useStore() {
  const [state, dispatch] = useReducer(reducer, undefined, () => load(new Date().toISOString()));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore: the app still works without saving.
    }
  }, [state]);

  // Apply hand-off rules to requests whose time has run out.
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: 'tick', now: new Date().toISOString() }), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return [state, dispatch] as const;
}
