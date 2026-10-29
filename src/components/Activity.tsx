import { useState } from 'react';
import { ZIKI_BASE } from '../data/zikiSnapshot';
import { OWNER_ID } from '../store';
import { ACTION_LABELS, type Agent, type LogEntry, type Source } from '../types';
import { Empty, KindPill } from './ui';

interface Props {
  log: LogEntry[];
  agents: Agent[];
}

type Filter = 'all' | Source;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'ziki', label: 'From Ziki' },
  { value: 'you', label: 'Tried by you' },
];

const SOURCE_LABEL: Record<Source, string> = { ziki: 'From Ziki', demo: '', you: 'Tried by you' };

export function Activity({ log, agents }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const rows = log.filter((e) => filter === 'all' || (e.source ?? 'you') === filter).slice(0, 150);
  const nameOf = (id: string) => (id === OWNER_ID ? 'You' : agents.find((a) => a.id === id)?.name ?? 'Unknown agent');

  return (
    <section className="panel" aria-labelledby="act-title">
      <header className="panel-head">
        <div>
          <h2 id="act-title">Activity</h2>
          <p className="muted small">
            Everything your agents tried, what their Brief decided, and why. Real Ziki events happened before any Brief
            existed.
          </p>
        </div>
        <div className="filter" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.value} className="filter-chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <Empty icon="list" title="Nothing here yet">
          <p className="muted small">
            {filter === 'you' ? 'Actions you try on the Try it tab will appear here.' : 'Activity will appear as your agents act.'}
          </p>
        </Empty>
      ) : (
        <ul className="log">
          {rows.map((e) => {
            const source = e.source ?? 'you';
            const date = new Date(e.at);
            return (
              <li key={e.id}>
                <time dateTime={e.at}>
                  {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  <span className="muted small">{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                </time>
                <span className="tags">
                  <KindPill kind={e.kind} />
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
                  <span className="muted small">
                    {e.note}
                    {e.points ? ` +${e.points} points.` : ''} {e.kind === 'history' ? '(Before Briefs)' : `(Brief v${e.briefVersion})`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
