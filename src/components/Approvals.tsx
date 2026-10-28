import { minutesLeft } from '../engine';
import { ACTION_LABELS, type Agent, type ApprovalRequest } from '../types';

interface Props {
  requests: ApprovalRequest[];
  agents: Agent[];
  now: Date;
  onAnswer: (requestId: string, approve: boolean) => void;
}

export function Approvals({ requests, agents, now, onAnswer }: Props) {
  const open = requests.filter((r) => r.status === 'pending' || r.status === 'waiting');
  const closed = requests.filter((r) => r.status !== 'pending' && r.status !== 'waiting').slice(0, 10);
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Unknown agent';

  return (
    <section className="panel" aria-labelledby="appr-title">
      <h2 id="appr-title">Waiting for your yes ({open.length})</h2>
      {open.length === 0 && <p className="muted">Nothing is waiting. Requests appear here when an action needs an owner.</p>}
      <ul className="cards">
        {open.map((r) => (
          <li key={r.id} className="card">
            <p>
              <strong>{nameOf(r.attempt.agentId)}</strong> wants to {ACTION_LABELS[r.attempt.action].toLowerCase()}:{' '}
              <em>{r.attempt.title}</em>
            </p>
            <p className="muted">
              {r.attempt.platform} · {r.attempt.issueType} · {r.attempt.severity}. {r.reason}
            </p>
            <p className="muted">
              {r.status === 'waiting'
                ? 'No time limit. Still waiting for you.'
                : `${minutesLeft(r, now)} min left to answer. Brief v${r.briefVersion}.`}
            </p>
            <div className="actions">
              <button className="primary" onClick={() => onAnswer(r.id, true)}>
                Approve
              </button>
              <button onClick={() => onAnswer(r.id, false)}>Deny</button>
            </div>
          </li>
        ))}
      </ul>

      {closed.length > 0 && (
        <>
          <h3>Recently closed</h3>
          <ul className="closed">
            {closed.map((r) => (
              <li key={r.id}>
                <span className={`tag ${r.status}`}>{r.status.replace('_', ' ')}</span> {nameOf(r.attempt.agentId)}:{' '}
                {ACTION_LABELS[r.attempt.action].toLowerCase()} ({r.attempt.title})
                {r.handedOffTo ? ` → ${r.handedOffTo}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
