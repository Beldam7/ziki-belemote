import { HISTORY, OWNER, ZIKI_BASE } from '../data/zikiSnapshot';
import { replay, summarise } from '../replay';
import { ACTION_LABELS, type Agent } from '../types';
import { Pill } from './ui';

interface Props {
  agents: Agent[];
  onEditBrief: (agentId: string) => void;
}

const OUTCOME_LABEL = { allowed: 'Allowed', needs_approval: 'Would ask you', blocked: 'Stopped' } as const;
const OUTCOME_TONE = { allowed: 'ok', needs_approval: 'warn', blocked: 'bad' } as const;

export function Replay({ agents, onEditBrief }: Props) {
  const rows = replay(HISTORY, agents);
  const summary = summarise(rows);
  const flags = HISTORY.filter((e) => e.action === 'flag_duplicate');
  const flagPoints = flags.reduce((sum, e) => sum + e.points, 0);
  const stoppedCount = rows.filter((r) => r.agent.id === 'bebz-5' && r.decision.outcome !== 'allowed').length;

  return (
    <section className="panel" aria-labelledby="replay-title">
      <h2 id="replay-title">Replay your real week under today's Briefs</h2>
      <p className="muted small">
        These are your agents' real actions on Ziki, from 24 October. Each row shows what the agent's current Brief would
        have done. Edit a Brief and this page updates.
      </p>
      <p className="callout">
        These {flags.length.toLocaleString()} duplicate flags earned {flagPoints.toLocaleString()} of your{' '}
        {OWNER.points.toLocaleString()} points.{' '}
        {stoppedCount === 0
          ? "Under today's Briefs, none of Bebz 5.0's would have been stopped."
          : `Under today's Briefs, ${stoppedCount.toLocaleString()} of Bebz 5.0's would have been stopped before the demotion.`}
      </p>

      <ul className="summary">
        {summary.map((s) => (
          <li key={s.agent.id}>
            <strong>{s.agent.name}</strong>: {s.allowed} of {s.total} allowed
            {s.asked ? `, ${s.asked} would ask you` : ''}
            {s.blocked ? `, ${s.blocked} stopped` : ''}.
            {s.agent.id === 'bebz-5' && s.blocked > 0 && (
              <> On Ziki, Bebz 5.0 made all 10 flags and was demoted to reviewer straight after.</>
            )}
            {s.agent.id === 'bebz-2' && (
              <> Bebz 2.0 was a triager then and is a reviewer now, so its Brief no longer allows flagging.</>
            )}{' '}
            <button className="link" onClick={() => onEditBrief(s.agent.id)}>
              Edit {s.agent.name}'s Brief
            </button>
          </li>
        ))}
      </ul>

      <div className="table-wrap">
        <table className="stack">
          <thead>
            <tr>
              <th>When (UTC)</th>
              <th>Agent</th>
              <th>Action</th>
              <th>Issue</th>
              <th>Under the Brief</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ event, agent, decision }) => (
              <tr key={`${event.issue}-${event.at}`}>
                <td className="nowrap" data-label="When (UTC)">{event.at.slice(5, 16).replace('T', ' ')}</td>
                <td data-label="Agent">{agent.name}</td>
                <td data-label="Action">{ACTION_LABELS[event.action as keyof typeof ACTION_LABELS] ?? event.action}</td>
                <td data-label="Issue">
                  <a href={`${ZIKI_BASE}/issues/${event.issue}`} target="_blank" rel="noreferrer">
                    #{event.issue}
                  </a>{' '}
                  <span className="muted">{event.title}</span>
                </td>
                <td data-label="Under the Brief">
                  <Pill tone={OUTCOME_TONE[decision.outcome]}>{OUTCOME_LABEL[decision.outcome]}</Pill>
                  <br />
                  <span className="muted small">{decision.warning ? `${decision.reason} ${decision.warning}` : decision.reason}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
