import { useRef, useState } from 'react';
import type { Action } from '../store';
import type { Attempt } from '../types';
import { Icon } from './ui';

interface Props {
  dispatch: (a: Action) => void;
  goTo: (tab: 'approvals' | 'activity') => void;
}

interface Scenario {
  id: string;
  title: string;
  today: string;
  withBrief: string;
  /** `send` returns the id of the approval request the action would create, if any. */
  run: (send: (a: Omit<Attempt, 'id' | 'at' | 'source'>) => string, dispatch: (a: Action) => void) => void;
  see: 'approvals' | 'activity';
}

const SCENARIOS: Scenario[] = [
  {
    id: 'offer',
    title: 'An offer for #718 arrives while you are away',
    today: 'On Ziki today the offer waits for someone to accept it. You missed this one and could only bid afterwards.',
    withBrief: "#718 is a Desktop fix at medium severity, which is inside Bebz's Brief, so Bebz accepts it and tells you. Accepting starts Ziki's delivery clock (15 minutes by default), so only allow this when you can deliver fast.",
    run: (send) =>
      send({ agentId: 'bebz', action: 'accept_offer', platform: 'Desktop', issueType: 'Fix', severity: 'medium', title: 'Thread replies cannot be read (what if it were offered again)', issueNumber: 718 }),
    see: 'activity',
  },
  {
    id: 'flags',
    title: 'Bebz 5.0 flags duplicates in bulk',
    today: 'On 24 October Bebz 5.0 made 10 flags in one run and was demoted to reviewer, with no warning first.',
    withBrief: 'Its Brief allows 8 flags a day. You get a warning as it nears the limit, and anything past 8 today is stopped before it is sent, so the agent is never pushed to the point where Ziki demoted it.',
    run: (send) => {
      for (let i = 1; i <= 10; i++) {
        send({ agentId: 'bebz-5', action: 'flag_duplicate', platform: 'Web', issueType: 'Fix', severity: 'medium', title: `possible duplicate ${i} of 10` });
      }
    },
    see: 'activity',
  },
  {
    id: 'scope',
    title: 'A high-severity Mobile offer, outside the Brief',
    today: 'On Ziki today an agent with the key can take it, whether or not you would want it to.',
    withBrief: "Mobile and high severity are both outside Bebz's Brief, so it asks you first. Approve or deny it in Approvals.",
    run: (send) => send({ agentId: 'bebz', action: 'accept_offer', platform: 'Mobile', issueType: 'Fix', severity: 'high', title: 'Push notifications never arrive on Android 14' }),
    see: 'approvals',
  },
  {
    id: 'timeout',
    title: 'Nobody answers in time',
    today: 'On Ziki today an unanswered offer simply lapses, and nobody else hears about it.',
    withBrief: "Bebz 4.0's Brief hands unanswered requests to the team lead, and Bebz's Brief skips them. This runs the clock out straight away so you can see both.",
    run: (send, dispatch) => {
      const a = send({ agentId: 'bebz-4', action: 'review', platform: 'Web', issueType: 'Fix', severity: 'critical', title: 'Password reset link never expires' });
      const b = send({ agentId: 'bebz', action: 'bid', platform: 'Mobile', issueType: 'Fix', severity: 'medium', title: 'Group description has no length limit' });
      const now = new Date().toISOString();
      // Only these two run out of time; requests already waiting are left alone.
      dispatch({ type: 'expire_now', requestIds: [a, b], now });
      dispatch({ type: 'tick', now });
    },
    see: 'activity',
  },
];

export function Scenarios({ dispatch, goTo }: Props) {
  const [last, setLast] = useState<Scenario | null>(null);
  const counter = useRef(0);

  const play = (s: Scenario) => {
    const send = (a: Omit<Attempt, 'id' | 'at' | 'source'>) => {
      counter.current += 1;
      const id = `scn-${s.id}-${Date.now()}-${counter.current}`;
      dispatch({ type: 'attempt', attempt: { ...a, id, at: new Date().toISOString(), source: 'demo' } });
      return `req-${id}`;
    };
    s.run(send, dispatch);
    setLast(s);
  };

  return (
    <section className="panel" aria-labelledby="scn-title">
      <h2 id="scn-title">See a real situation play out</h2>
      <p className="muted small">Pick one. It runs a short scripted situation with your agents and shows what the Brief changes.</p>
      <div className="scenario-grid">
        {SCENARIOS.map((s) => (
          <button key={s.id} className={`scenario${last?.id === s.id ? ' played' : ''}`} onClick={() => play(s)}>
            <strong>{s.title}</strong>
            <span className="muted small">
              <span className="eyebrow-inline">Without a Brief:</span> {s.today}
            </span>
            <span className="scenario-go">
              <Icon name="play" size={14} /> {last?.id === s.id ? 'Play again' : 'Play'}
            </span>
          </button>
        ))}
      </div>
      {last && (
        <div className="result tone-info" role="status">
          <p className="result-head">
            <Icon name="spark" size={16} />
            <strong>With a Brief</strong>
          </p>
          <p>{last.withBrief}</p>
          <button onClick={() => goTo(last.see)}>
            See it in {last.see === 'approvals' ? 'Approvals' : 'Activity'} <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
