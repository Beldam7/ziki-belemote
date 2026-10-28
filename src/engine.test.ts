import { describe, expect, it } from 'vitest';
import { answerRequest, createRequest, defaultBrief, evaluate, resolveExpired, usedToday } from './engine';
import type { Attempt, Brief, LogEntry } from './types';

const NOW = new Date('2026-10-28T12:00:00.000Z');

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a1',
    agentId: 'ag1',
    action: 'bid',
    platform: 'Desktop',
    issueType: 'Fix',
    severity: 'medium',
    title: 'Close buttons have no tooltip',
    at: NOW.toISOString(),
    ...over,
  };
}

function brief(over: Partial<Brief> = {}): Brief {
  return { ...defaultBrief(NOW), ...over };
}

describe('evaluate', () => {
  it('allows an in-scope action', () => {
    expect(evaluate(brief(), 0, attempt()).outcome).toBe('allowed');
  });

  it('blocks a paused agent before anything else', () => {
    expect(evaluate(brief(), 0, attempt(), true).outcome).toBe('blocked');
  });

  it('blocks an action the Brief says never to do', () => {
    const d = evaluate(brief(), 0, attempt({ action: 'flag_duplicate' }));
    expect(d.outcome).toBe('blocked');
    expect(d.reason).toMatch(/never/i);
  });

  it('blocks at the daily limit and says it saves the write budget', () => {
    const d = evaluate(brief(), 2, attempt({ action: 'bid' }));
    expect(d.outcome).toBe('blocked');
    expect(d.reason).toMatch(/write budget/i);
  });

  it('asks when the platform is out of scope', () => {
    const d = evaluate(brief(), 0, attempt({ platform: 'Mobile' }));
    expect(d.outcome).toBe('needs_approval');
    expect(d.reason).toMatch(/Mobile/);
  });

  it('asks when the issue type is out of scope', () => {
    expect(evaluate(brief(), 0, attempt({ issueType: 'Feat' })).outcome).toBe('needs_approval');
  });

  it('asks when severity is above the limit, and allows it at the limit', () => {
    expect(evaluate(brief(), 0, attempt({ severity: 'high' })).outcome).toBe('needs_approval');
    expect(evaluate(brief(), 0, attempt({ severity: 'medium' })).outcome).toBe('allowed');
    expect(evaluate(brief(), 0, attempt({ severity: 'low' })).outcome).toBe('allowed');
  });

  it('asks when the rule is ask', () => {
    expect(evaluate(brief(), 0, attempt({ action: 'report' })).outcome).toBe('needs_approval');
  });

  it('warns once an allowed action reaches 80% of its limit', () => {
    const b = brief();
    // review limit is 10: the 8th action (7 used before it) reaches 80%.
    expect(evaluate(b, 6, attempt({ action: 'review' })).warning).toBeUndefined();
    expect(evaluate(b, 7, attempt({ action: 'review' })).warning).toMatch(/8 of 10/);
  });

  it('does not warn when there is no limit', () => {
    expect(evaluate(brief(), 50, attempt({ action: 'comment' })).warning).toBeUndefined();
  });
});

describe('usedToday', () => {
  const entry = (over: Partial<LogEntry>): LogEntry => ({
    id: 'l',
    at: NOW.toISOString(),
    agentId: 'ag1',
    kind: 'auto_allowed',
    attempt: attempt(),
    briefVersion: 1,
    note: '',
    ...over,
  });

  it('counts executed actions for the same agent, action and day only', () => {
    const log = [
      entry({}),
      entry({ kind: 'approved' }),
      entry({ kind: 'blocked' }),
      entry({ agentId: 'other' }),
      entry({ at: '2026-10-27T12:00:00.000Z' }),
      entry({ attempt: attempt({ action: 'review' }) }),
    ];
    expect(usedToday(log, 'ag1', 'bid', NOW.toISOString())).toBe(2);
  });
});

describe('approval lifecycle', () => {
  const decision = { outcome: 'needs_approval' as const, reason: 'ask' };

  it('sets the expiry from the Brief timeout', () => {
    const r = createRequest(attempt(), decision, brief({ askTimeoutMinutes: 45 }), NOW, 'r1');
    expect(new Date(r.expiresAt).getTime() - NOW.getTime()).toBe(45 * 60_000);
    expect(r.status).toBe('pending');
  });

  it('leaves requests alone before they expire', () => {
    const r = createRequest(attempt(), decision, brief(), NOW, 'r1');
    expect(resolveExpired([r], brief(), NOW).changed).toHaveLength(0);
  });

  const later = new Date(NOW.getTime() + 31 * 60_000);

  it('skips on timeout when the Brief says skip', () => {
    const r = createRequest(attempt(), decision, brief(), NOW, 'r1');
    expect(resolveExpired([r], brief({ onTimeout: 'skip' }), later).requests[0].status).toBe('skipped');
  });

  it('keeps waiting when the Brief says wait', () => {
    const r = createRequest(attempt(), decision, brief(), NOW, 'r1');
    expect(resolveExpired([r], brief({ onTimeout: 'wait' }), later).requests[0].status).toBe('waiting');
  });

  it('hands off to the named teammate', () => {
    const r = createRequest(attempt(), decision, brief(), NOW, 'r1');
    const out = resolveExpired([r], brief({ onTimeout: 'handoff', handoffTo: 'Bishop' }), later).requests[0];
    expect(out.status).toBe('handed_off');
    expect(out.handedOffTo).toBe('Bishop');
  });

  it('falls back to skip when hand-off has no name', () => {
    const r = createRequest(attempt(), decision, brief(), NOW, 'r1');
    expect(resolveExpired([r], brief({ onTimeout: 'handoff', handoffTo: ' ' }), later).requests[0].status).toBe('skipped');
  });

  it('lets the owner answer a pending or waiting request, but not a closed one', () => {
    const r = createRequest(attempt(), decision, brief(), NOW, 'r1');
    expect(answerRequest(r, true, NOW).status).toBe('approved');
    expect(answerRequest({ ...r, status: 'waiting' }, false, NOW).status).toBe('denied');
    const closed = { ...r, status: 'skipped' as const };
    expect(answerRequest(closed, true, NOW).status).toBe('skipped');
  });
});
