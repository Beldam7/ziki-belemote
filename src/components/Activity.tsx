import { ACTION_LABELS, type Agent, type LogEntry } from '../types';
import { labelFor } from './Simulator';

interface Props {
  log: LogEntry[];
  agents: Agent[];
  onlyAgentId: string | null;
}

export function Activity({ log, agents, onlyAgentId }: Props) {
  const rows = log.filter((e) => !onlyAgentId || e.agentId === onlyAgentId).slice(0, 100);
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Unknown agent';

  return (
    <section className="panel" aria-labelledby="act-title">
      <h2 id="act-title">Activity</h2>
      <p className="muted">Every action is labelled with the Brief version it ran under.</p>
      {rows.length === 0 && <p className="muted">No activity yet. Try an action in the simulator.</p>}
      <ul className="log">
        {rows.map((e) => (
          <li key={e.id}>
            <time dateTime={e.at}>{new Date(e.at).toLocaleTimeString()}</time>
            <span className={`tag ${e.kind}`}>{labelFor(e.kind)}</span>
            <span>
              <strong>{nameOf(e.agentId)}</strong>
              {e.attempt ? ` · ${ACTION_LABELS[e.attempt.action].toLowerCase()}: ${e.attempt.title}` : ''}
              <br />
              <span className="muted">
                {e.note} (Brief v{e.briefVersion})
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
