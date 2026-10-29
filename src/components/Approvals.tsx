import { minutesLeft } from '../engine';
import { REQUEST_META } from '../status';
import { ACTION_LABELS, type Agent, type ApprovalRequest } from '../types';
import { Avatar, Empty, Icon, Pill } from './ui';

interface Props {
  requests: ApprovalRequest[];
  agents: Agent[];
  now: Date;
  onAnswer: (requestId: string, approve: boolean) => void;
  onTryAction: () => void;
}

const verb = (r: ApprovalRequest) => ACTION_LABELS[r.attempt.action].charAt(0).toLowerCase() + ACTION_LABELS[r.attempt.action].slice(1);

export function Approvals({ requests, agents, now, onAnswer, onTryAction }: Props) {
  const open = requests.filter((r) => r.status === 'pending' || r.status === 'waiting');
  const closed = requests.filter((r) => r.status !== 'pending' && r.status !== 'waiting').slice(0, 10);
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Unknown agent';

  return (
    <section className="panel" aria-labelledby="appr-title">
      <header className="panel-head">
        <div>
          <h2 id="appr-title">Waiting for your yes</h2>
          <p className="muted small">
            An agent asks here when its Brief says to check with you. It does nothing until you answer.
          </p>
        </div>
      </header>

      {open.length === 0 ? (
        <Empty icon="check" title="You're all caught up">
          <p className="muted small">Nothing needs you right now. New requests will show up here.</p>
          <button onClick={onTryAction}>Try an action to see how it works</button>
        </Empty>
      ) : (
        <ul className="requests">
          {open.map((r) => {
            const total = new Date(r.expiresAt).getTime() - new Date(r.createdAt).getTime();
            const left = Math.max(0, new Date(r.expiresAt).getTime() - now.getTime());
            const ratio = total > 0 ? left / total : 0;
            const mins = minutesLeft(r, now);
            return (
              <li key={r.id} className="request">
                <div className="request-head">
                  <Avatar id={r.attempt.agentId} mood="alert" />
                  <p>
                    <strong>{nameOf(r.attempt.agentId)}</strong> wants to {verb(r)}
                  </p>
                  <Pill tone={REQUEST_META[r.status].tone}>{REQUEST_META[r.status].label}</Pill>
                </div>
                <p className="request-title">{r.attempt.title}</p>
                <p className="chips">
                  <span className="chip">{r.attempt.platform}</span>
                  <span className="chip">{r.attempt.issueType}</span>
                  <span className={`chip sev-${r.attempt.severity}`}>{r.attempt.severity} severity</span>
                  {r.attempt.issueNumber && <span className="chip">#{r.attempt.issueNumber}</span>}
                </p>
                <p className="why">
                  <Icon name="info" size={16} />
                  <span>
                    <strong>Why it's asking:</strong> {r.reason}
                  </span>
                </p>
                {r.status === 'waiting' ? (
                  <p className="muted small">The answer time has passed. Its Brief says to keep waiting for you.</p>
                ) : (
                  <div className="timer">
                    <span className="timer-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round(ratio * 100)}%` }} className={ratio < 0.25 ? 'low' : ''} />
                    </span>
                    <span className="muted small">
                      {mins} min left · Brief v{r.briefVersion}
                    </span>
                  </div>
                )}
                <div className="actions">
                  <button className="primary" onClick={() => onAnswer(r.id, true)}>
                    <Icon name="check" size={16} /> Approve
                  </button>
                  <button onClick={() => onAnswer(r.id, false)}>Decline</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {closed.length > 0 && (
        <>
          <h3>Recently closed</h3>
          <ul className="closed">
            {closed.map((r) => (
              <li key={r.id}>
                <Pill tone={REQUEST_META[r.status].tone}>{REQUEST_META[r.status].label}</Pill>
                <span>
                  <strong>{nameOf(r.attempt.agentId)}</strong> · {verb(r)}: {r.attempt.title}
                  {r.handedOffTo ? ` → ${r.handedOffTo}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
