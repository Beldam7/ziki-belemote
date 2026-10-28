import { useState } from 'react';
import { ZIKI_BASE } from '../data/zikiSnapshot';
import { OWNER_ID } from '../store';
import { ACTION_LABELS, type Agent, type LogEntry, type Source } from '../types';
import { labelFor } from './Simulator';

interface Props {
  log: LogEntry[];
  agents: Agent[];
}

type Filter = 'all' | Source;

const SOURCE_LABEL: Record<Source, string> = { ziki: 'From Ziki', demo: '', you: 'Simulated' };

export function Activity({ log, agents }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const rows = log.filter((e) => filter === 'all' || (e.source ?? 'you') === filter).slice(0, 150);
  const nameOf = (id: string) => (id === OWNER_ID ? 'You' : agents.find((a) => a.id === id)?.name ?? 'Unknown agent');

  return (
    <section className="panel" aria-labelledby="act-title">
      <header className="panel-head">
        <div>
          <h2 id="act-title">Activity</h2>
          <p className="muted">
            Each row says where it came from and which Brief version it ran under. Real Ziki events happened before any
            Brief existed.
          </p>
        </div>
        <label>
          <span className="label">Show</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">Everything</option>
            <option value="ziki">From Ziki only</option>
            <option value="you">Simulated by you</option>
          </select>
        </label>
      </header>
      {rows.length === 0 && <p className="muted">Nothing here yet.</p>}
      <ul className="log">
        {rows.map((e) => {
          const source = e.source ?? 'you';
          const date = new Date(e.at);
          return (
            <li key={e.id}>
              <time dateTime={e.at}>
                {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                <br />
                <span className="muted small">{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
              </time>
              <span className="tags">
                <span className={`tag ${e.kind}`}>{labelFor(e.kind)}</span>
                {SOURCE_LABEL[source] && <span className={`tag source-${source}`}>{SOURCE_LABEL[source]}</span>}
              </span>
              <span>
                <strong>{nameOf(e.agentId)}</strong>
                {e.attempt ? ` · ${ACTION_LABELS[e.attempt.action].toLowerCase()}` : e.actionLabel ? ` · ${e.actionLabel}` : ''}
                {e.issueNumber ? (
                  <>
                    {' · '}
                    <a href={`${ZIKI_BASE}/issues/${e.issueNumber}`} target="_blank" rel="noreferrer">
                      #{e.issueNumber}
                    </a>
                  </>
                ) : null}
                {e.attempt ? `: ${e.attempt.title}` : e.title ? `: ${e.title}` : ''}
                <br />
                <span className="muted">
                  {e.note}
                  {e.points ? ` +${e.points} points.` : ''} {e.kind === 'history' ? '(Before Briefs)' : `(Brief v${e.briefVersion})`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
