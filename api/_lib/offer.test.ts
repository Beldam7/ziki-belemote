import { describe, expect, it } from 'vitest';
import { defaultBrief } from '../../src/engine';
import { decideOffer, inferPlatform, parseOfferEvent } from './offer';

const NOW = '2026-10-28T12:00:00.000Z';
const brief = defaultBrief(new Date(NOW));

describe('parseOfferEvent', () => {
  it('reads ids from payload and tolerates other shapes', () => {
    expect(parseOfferEvent({ id: 'evt_1', type: 'claim.offered', payload: { claimId: 'claim_1', issueId: 'issue_1' } })).toEqual({
      eventId: 'evt_1',
      type: 'claim.offered',
      claimId: 'claim_1',
      issueId: 'issue_1',
    });
    expect(parseOfferEvent(null).claimId).toBeNull();
    expect(parseOfferEvent({ payload: { bugId: 'b1' } }).issueId).toBe('b1');
  });
});

describe('inferPlatform', () => {
  it('finds the platform in the start of the title', () => {
    expect(inferPlatform('[Bug] Desktop: close buttons')).toBe('Desktop');
    expect(inferPlatform('Web: ReplyConnection logs')).toBe('Web');
    expect(inferPlatform('Fix the crash on startup')).toBeNull();
  });
});

describe('decideOffer', () => {
  const good = { id: 'i1', title: 'Desktop: close buttons have no tooltip', severity: 'medium', type: { name: 'Fix' } };

  it('allows an in-scope offer', () => {
    expect(decideOffer(brief, good, NOW).decision.outcome).toBe('allowed');
  });

  it('asks when the issue is above the severity limit', () => {
    expect(decideOffer(brief, { ...good, severity: 'high' }, NOW).decision.outcome).toBe('needs_approval');
  });

  it('asks when something cannot be read, instead of guessing', () => {
    const r = decideOffer(brief, { id: 'i2', title: 'Close buttons have no tooltip', severity: 'medium' }, NOW);
    expect(r.decision.outcome).toBe('needs_approval');
    expect(r.decision.reason).toMatch(/platform, issue type/);
    expect(r.attempt).toBeNull();
  });

  it('asks for an out-of-scope platform', () => {
    expect(decideOffer(brief, { ...good, title: 'Mobile: join modal closes early' }, NOW).decision.outcome).toBe('needs_approval');
  });
});
