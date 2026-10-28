import { levelAllows, usageSummary } from '../engine';
import { ACTION_LABELS, type Agent, type LogEntry } from '../types';

interface Props {
  agent: Agent;
  log: LogEntry[];
  now: string;
}

export function Usage({ agent, log, now }: Props) {
  const rows = usageSummary(agent.brief, log, agent.id, now).filter(
    (r) => levelAllows(agent.level, r.action) && agent.brief.rules[r.action].mode !== 'never',
  );
  if (rows.length === 0) return null;
  return (
    <section className="panel" aria-labelledby="usage-title">
      <h2 id="usage-title">Today's usage</h2>
      <ul className="usage">
        {rows.map((r) => (
          <li key={r.action} className={r.warn ? 'warn' : ''}>
            <span>{ACTION_LABELS[r.action]}</span>
            <span className="bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round(r.ratio * 100))}%` }} />
            </span>
            <span className="count">
              {r.used} of {r.limit}
              {r.warn && r.used < r.limit ? ' (nearly there)' : ''}
              {r.warn && r.used >= r.limit ? ' (limit reached)' : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
