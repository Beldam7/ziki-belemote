import { useState } from 'react';
import { LEVEL_HELP, timeAgo } from '../status';
import type { Agent } from '../types';
import { Avatar, Icon } from './ui';

interface Props {
  agents: Agent[];
  selectedId: string | undefined;
  pendingByAgent: Record<string, number>;
  now: Date;
  onSelect: (agentId: string) => void;
  onAdd: (name: string, level: Agent['level']) => void;
}

const LEVELS: Agent['level'][] = ['contributor', 'reviewer', 'triager'];

export function AgentList({ agents, selectedId, pendingByAgent, now, onSelect, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Agent['level']>('contributor');
  const [error, setError] = useState('');

  return (
    <section className="panel agent-list" aria-labelledby="agents-title">
      <h2 id="agents-title">Your agents</h2>
      <p className="muted small">Pick an agent to see and change its Brief.</p>
      <ul className="agent-items">
        {agents.map((a) => {
          const pending = pendingByAgent[a.id] ?? 0;
          return (
            <li key={a.id}>
              <button
                className={`agent-item${a.id === selectedId ? ' selected' : ''}`}
                aria-current={a.id === selectedId ? 'true' : undefined}
                onClick={() => onSelect(a.id)}
              >
                <Avatar id={a.id} name={a.name} />
                <span className="agent-main">
                  <span className="agent-name">{a.name}</span>
                  <span className="agent-meta">
                    <span className={`dot ${a.paused ? 'dot-paused' : 'dot-active'}`} aria-hidden="true" />
                    {a.paused ? 'Paused' : 'Active'} · {timeAgo(a.lastSeen, now)}
                  </span>
                </span>
                <span className="agent-side">
                  <span className="role">{a.level}</span>
                  {pending > 0 && <span className="count-badge">{pending} {pending === 1 ? 'needs' : 'need'} you</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form
          className="add-agent"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              setError('Give the agent a name, for example "Bebz 6.0".');
              return;
            }
            onAdd(name.trim(), level);
            setName('');
            setError('');
            setAdding(false);
          }}
        >
          <label>
            <span className="label">Name</span>
            <input
              type="text"
              value={name}
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'add-error' : undefined}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
            />
          </label>
          {error && (
            <p id="add-error" className="field-error">
              {error}
            </p>
          )}
          <fieldset className="plain">
            <legend className="label">What it does on Ziki</legend>
            {LEVELS.map((l) => (
              <label key={l} className="radio-card">
                <input type="radio" name="level" value={l} checked={level === l} onChange={() => setLevel(l)} />
                <span>
                  <strong className="cap">{l}</strong>
                  <span className="muted small">{LEVEL_HELP[l]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="actions">
            <button type="submit" className="primary">
              Add agent
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="ghost add-toggle" onClick={() => setAdding(true)}>
          <Icon name="plus" /> Add an agent
        </button>
      )}
    </section>
  );
}
