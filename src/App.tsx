import { useEffect, useState } from 'react';
import { Activity } from './components/Activity';
import { Approvals } from './components/Approvals';
import { BriefEditor } from './components/BriefEditor';
import { Simulator } from './components/Simulator';
import { Usage } from './components/Usage';
import { useStore } from './store';
import type { Agent } from './types';

type Tab = 'brief' | 'try' | 'approvals' | 'activity';

function timeAgo(iso: string | null, now: Date): string {
  if (!iso) return 'Never';
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

export function App() {
  const [state, dispatch] = useStore();
  const [tab, setTab] = useState<Tab>('brief');
  const [now, setNow] = useState(() => new Date());
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState<Agent['level']>('contributor');

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const agent = state.agents.find((a) => a.id === state.selectedAgentId) ?? state.agents[0];
  const pendingCount = state.requests.filter((r) => r.status === 'pending' || r.status === 'waiting').length;
  const lastEntry = agent ? state.log.find((e) => e.agentId === agent.id && e.attempt) : undefined;

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Agent Briefs</h1>
          <p className="muted">
            Set once what each agent may do, what needs your yes, and what happens when you are away.
          </p>
        </div>
        <button
          onClick={() => {
            if (window.confirm('Clear all agents, Briefs and activity stored in this browser?')) {
              dispatch({ type: 'reset', now: new Date().toISOString() });
            }
          }}
        >
          Reset demo data
        </button>
      </header>

      <section className="panel" aria-labelledby="agents-title">
        <h2 id="agents-title">Your agents</h2>
        <div className="table-wrap">
          <table className="agents">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Level</th>
                <th>Status</th>
                <th>Last seen</th>
                <th>Brief</th>
              </tr>
            </thead>
            <tbody>
              {state.agents.map((a) => (
                <tr key={a.id} className={a.id === agent?.id ? 'selected' : ''}>
                  <td>
                    <button className="link" onClick={() => dispatch({ type: 'select', agentId: a.id })} aria-current={a.id === agent?.id}>
                      {a.name}
                    </button>
                  </td>
                  <td>{a.level}</td>
                  <td>{a.paused ? 'Paused' : 'Active'}</td>
                  <td>{timeAgo(a.lastSeen, now)}</td>
                  <td>v{a.brief.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            dispatch({ type: 'add_agent', id: `agent-${Date.now()}`, name: newName, level: newLevel, now: new Date().toISOString() });
            setNewName('');
          }}
        >
          <input type="text" placeholder="New agent name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New agent name" />
          <select value={newLevel} onChange={(e) => setNewLevel(e.target.value as Agent['level'])} aria-label="New agent level">
            <option>contributor</option>
            <option>reviewer</option>
            <option>triager</option>
          </select>
          <button type="submit">Add agent</button>
        </form>
      </section>

      {agent && (
        <>
          <div className="agent-bar">
            <h2>{agent.name}</h2>
            <button onClick={() => dispatch({ type: 'toggle_pause', agentId: agent.id, now: new Date().toISOString() })}>
              {agent.paused ? 'Resume agent' : 'Pause agent'}
            </button>
          </div>

          <nav className="tabs" role="tablist" aria-label="Agent sections">
            {(
              [
                ['brief', 'Brief'],
                ['try', 'Try an action'],
                ['approvals', `Approvals${pendingCount ? ` (${pendingCount})` : ''}`],
                ['activity', 'Activity'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>

          {tab === 'brief' && (
            <BriefEditor
              key={`${agent.id}-${agent.brief.version}`}
              agent={agent}
              onSave={(brief) => dispatch({ type: 'save_brief', agentId: agent.id, brief, now: new Date().toISOString() })}
            />
          )}
          {tab === 'try' && (
            <>
              <Simulator agent={agent} lastEntry={lastEntry} onAttempt={(attempt) => dispatch({ type: 'attempt', attempt })} />
              <Usage agent={agent} log={state.log} now={now.toISOString()} />
            </>
          )}
          {tab === 'approvals' && (
            <Approvals
              requests={state.requests}
              agents={state.agents}
              now={now}
              onAnswer={(requestId, approve) => dispatch({ type: 'answer', requestId, approve, now: new Date().toISOString() })}
            />
          )}
          {tab === 'activity' && <Activity log={state.log} agents={state.agents} onlyAgentId={null} />}
        </>
      )}

      <footer className="muted">
        Prototype. Everything is stored in this browser only and nothing is sent to Ziki. See the README for the
        optional webhook receiver.
      </footer>
    </div>
  );
}
