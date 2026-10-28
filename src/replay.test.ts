import { describe, expect, it } from 'vitest';
import { briefForLevel, evaluate, levelAllows } from './engine';
import { HISTORY, MY_AGENTS, OWNER } from './data/zikiSnapshot';
import { replay, summarise } from './replay';
import type { Agent, Attempt } from './types';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const agents: Agent[] = MY_AGENTS.map((a) => ({ ...a, paused: false, brief: briefForLevel(a.level, NOW) }));

describe('snapshot', () => {
  it('adds up to the points on the dashboard', () => {
    expect(HISTORY.reduce((sum, e) => sum + e.points, 0)).toBe(OWNER.points);
    expect(HISTORY.filter((e) => e.points > 0)).toHaveLength(OWNER.ledgerEntries);
  });
});

describe('levels', () => {
  it('follows what Ziki allows each level to do', () => {
    expect(levelAllows('reviewer', 'bid')).toBe(false);
    expect(levelAllows('triager', 'flag_duplicate')).toBe(true);
    expect(levelAllows('contributor', 'flag_duplicate')).toBe(false);
  });

  it('blocks an action the level cannot do, even if the Brief allows it', () => {
    const brief = briefForLevel('contributor', NOW);
    brief.rules.review = { mode: 'allow', dailyLimit: null };
    const attempt: Attempt = { id: 'x', agentId: 'bebz', action: 'review', platform: 'Desktop', issueType: 'Fix', severity: 'low', title: 't', at: NOW.toISOString() };
    const d = evaluate(brief, 0, attempt, false, 'contributor');
    expect(d.outcome).toBe('blocked');
    expect(d.reason).toMatch(/contributor/);
  });

  it('gives each level a starting Brief that only uses its own actions', () => {
    const reviewer = briefForLevel('reviewer', NOW);
    expect(reviewer.rules.bid.mode).toBe('never');
    expect(reviewer.rules.review.mode).toBe('allow');
    expect(briefForLevel('triager', NOW).rules.flag_duplicate).toEqual({ mode: 'allow', dailyLimit: 8 });
  });
});

describe('replay of the real history', () => {
  const rows = replay(HISTORY, agents);
  const summary = summarise(rows);
  const of = (id: string) => summary.find((s) => s.agent.id === id)!;

  it('stops Bebz 5.0 at 8 flags, before the 10 that led to its demotion', () => {
    const s = of('bebz-5');
    expect(s.total).toBe(10);
    expect(s.allowed).toBe(8);
    expect(s.blocked).toBe(2);
    const blocked = rows.filter((r) => r.agent.id === 'bebz-5' && r.decision.outcome === 'blocked');
    expect(blocked.map((r) => r.event.issue)).toEqual([957, 999]);
  });

  it('blocks all of Bebz 2.0 flags, because its Brief is now a reviewer Brief', () => {
    const s = of('bebz-2');
    expect(s.total).toBe(10);
    expect(s.allowed).toBe(0);
  });

  it('allows both of Bebz bids, which were Desktop fixes at medium severity', () => {
    const s = of('bebz');
    expect(s.total).toBe(2);
    expect(s.allowed).toBe(2);
  });

  it('skips actions the owner took by hand', () => {
    expect(rows.every((r) => r.event.agentId !== null)).toBe(true);
  });
});
