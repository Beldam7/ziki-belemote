import { useEffect, useReducer } from 'react';
import {
  answerRequest,
  createRequest,
  defaultBrief,
  evaluate,
  resolveExpired,
  usedToday,
} from './engine';
import type { Agent, Attempt, Brief, LogEntry, State } from './types';

const STORAGE_KEY = 'agent-briefs:v1';

export type Action =
  | { type: 'select'; agentId: string }
  | { type: 'add_agent'; id: string; name: string; level: Agent['level']; now: string }
  | { type: 'save_brief'; agentId: string; brief: Omit<Brief, 'version' | 'updatedAt'>; now: string }
  | { type: 'toggle_pause'; agentId: string; now: string }
  | { type: 'attempt'; attempt: Attempt }
  | { type: 'answer'; requestId: string; approve: boolean; now: string }
  | { type: 'tick'; now: string }
  | { type: 'reset'; now: string };

function seed(now: string): State {
  const mk = (id: string, name: string, level: Agent['level'], lastSeen: string | null): Agent => ({
    id,
    name,
    level,
    paused: false,
    brief: defaultBrief(new Date(now)),
    lastSeen,
  });
  return {
    agents: [mk('agent-1', 'Bebz', 'contributor', now), mk('agent-2', 'Bebz 4.0', 'reviewer', null)],
    requests: [],
    log: [],
    selectedAgentId: 'agent-1',
  };
}

function entry(
  id: string,
  at: string,
  agent: Agent,
  kind: LogEntry['kind'],
  note: string,
  attempt?: Attempt,
): LogEntry {
  return { id, at, agentId: agent.id, kind, attempt, briefVersion: agent.brief.version, note };
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
        brief: defaultBrief(new Date(action.now)),
        lastSeen: null,
      };
      return { ...state, agents: [...state.agents, agent], selectedAgentId: agent.id };
    }

    case 'save_brief':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === action.agentId
            ? { ...a, brief: { ...action.brief, version: a.brief.version + 1, updatedAt: action.now } }
            : a,
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
          entry(`log-pause-${action.now}-${agent.id}`, action.now, agent, 'paused', paused ? 'Owner paused the agent.' : 'Owner resumed the agent.'),
          ...state.log,
        ],
      };
    }

    case 'attempt': {
      const { attempt } = action;
      const agent = state.agents.find((a) => a.id === attempt.agentId);
      if (!agent) return state;
      const used = usedToday(state.log, agent.id, attempt.action, attempt.at);
      const decision = evaluate(agent.brief, used, attempt, agent.paused);
      const agents = state.agents.map((a) => (a.id === agent.id ? { ...a, lastSeen: attempt.at } : a));

      if (decision.outcome === 'allowed') {
        const note = decision.warning ? `${decision.reason} Warning: ${decision.warning}` : decision.reason;
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
            action.approve ? 'Owner approved. The agent can go ahead.' : 'Owner denied the request.',
            request.attempt,
          ),
          ...state.log,
        ],
      };
    }

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
              r.status === 'skipped' ? 'No answer in time. The Brief says skip.' : `No answer in time. Handed off to ${r.handedOffTo}.`,
              r.attempt,
            ),
          );
        log = [...entries, ...log];
      }
      return requests === state.requests ? state : { ...state, requests, log };
    }

    case 'reset':
      return seed(action.now);
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
