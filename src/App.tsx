import { useState } from 'react';
import { minutesLeft } from './engine';
import { Activity } from './components/Activity';
import { AgentList } from './components/AgentList';
import { Approvals } from './components/Approvals';
import { BriefEditor } from './components/BriefEditor';
import { DashboardLayout } from './components/DashboardLayout';
import { Replay } from './components/Replay';
import { Scenarios } from './components/Scenarios';
import { Simulator } from './components/Simulator';
import { Usage } from './components/Usage';
import { Avatar, Icon, Toasts, useNow, useToasts, type IconName } from './components/ui';
import { LEVEL_HELP } from './status';
import { useStore } from './store';

type Tab = 'briefs' | 'approvals' | 'try' | 'replay' | 'activity';

const TABS: { id: Tab; label: string; icon: IconName; hint: string }[] = [
  { id: 'briefs', label: 'Briefs', icon: 'brief', hint: 'What each agent may do' },
  { id: 'approvals', label: 'Approvals', icon: 'hand', hint: 'Requests waiting for you' },
  { id: 'try', label: 'Try it', icon: 'play', hint: 'Practise an action safely' },
  { id: 'replay', label: 'Replay', icon: 'replay', hint: 'Your real week under today’s Briefs' },
  { id: 'activity', label: 'Activity', icon: 'list', hint: 'Every decision, with reasons' },
];

export function App() {
  const [state, dispatch] = useStore();
  const [tab, setTab] = useState<Tab>('briefs');
  const now = useNow();
  const { toasts, notify, dismiss } = useToasts();

  const agent = state.agents.find((a) => a.id === state.selectedAgentId) ?? state.agents[0];
  const open = state.requests.filter((r) => r.status === 'pending' || r.status === 'waiting');
  const pendingByAgent = open.reduce<Record<string, number>>((m, r) => ({ ...m, [r.attempt.agentId]: (m[r.attempt.agentId] ?? 0) + 1 }), {});
  const soonest = open.filter((r) => r.status === 'pending').map((r) => minutesLeft(r, now)).sort((a, b) => a - b)[0];
  const nameOf = (id: string) => state.agents.find((a) => a.id === id)?.name ?? 'The agent';
  // Only results from the simulator itself, not the seeded activity or real history.
  const lastEntry = agent ? state.log.find((e) => e.agentId === agent.id && e.attempt && (e.source ?? 'you') === 'you') : undefined;
  const select = (agentId: string) => dispatch({ type: 'select', agentId });
  const activeCount = state.agents.filter((a) => !a.paused).length;
  // Every one of these is a decision a Brief made: allowed, stopped, asked, skipped or handed off.
  const decisions = state.log.filter((e) => e.kind !== 'history' && e.kind !== 'paused').length;

  return (
    <DashboardLayout
      agents={state.agents}
      onSelectAgent={(agentId) => {
        select(agentId);
        setTab('briefs');
      }}
    >
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">
            <Icon name="spark" size={16} /> Your agents, your rules
          </p>
          <h1>
            Agent Briefs <span className="badge-new">New</span>
          </h1>
          <p className="hero-lede">
            Decide once what each agent may do on its own, what needs your yes, and what happens when you are away.
          </p>
        </div>
        <dl className="hero-stats">
          <div className="hero-stat">
            <dt>
              <Icon name="users" size={15} /> Agents
            </dt>
            <dd>{state.agents.length}</dd>
            <span>{activeCount} active</span>
          </div>
          <div className={`hero-stat${open.length ? ' hot' : ''}`}>
            <dt>
              <Icon name="hand" size={15} /> Waiting for you
            </dt>
            <dd>{open.length}</dd>
            <span>{open.length ? 'Needs your yes' : 'All clear'}</span>
          </div>
          <div className="hero-stat">
            <dt>
              <Icon name="shield" size={15} /> Brief decisions
            </dt>
            <dd>{decisions}</dd>
            <span>Allowed, stopped or asked</span>
          </div>
        </dl>
      </header>

      {open.length > 0 && tab !== 'approvals' ? (
        <div className="attention" role="region" aria-label="Needs your attention">
          <span className="attention-icon">
            <Icon name="hand" size={20} />
          </span>
          <div>
            <p className="attention-title">
              {open.length === 1 ? '1 request is' : `${open.length} requests are`} waiting for your yes
            </p>
            <p className="small">
              {soonest !== undefined ? `The next one runs out in ${soonest} min. ` : ''}Your agents do nothing about these until you answer.
            </p>
          </div>
          <button className="primary" onClick={() => setTab('approvals')}>
            Review now <Icon name="arrow" size={16} />
          </button>
        </div>
      ) : (
        open.length === 0 && (
          <p className="calm">
            <Icon name="check" size={16} /> Nothing is waiting for you.
          </p>
        )
      )}

      <nav className="tabs" aria-label="Agent Briefs sections">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id ? 'page' : undefined} title={t.hint} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={16} />
            {t.label}
            {t.id === 'approvals' && open.length > 0 && <span className="count-badge">{open.length}</span>}
          </button>
        ))}
      </nav>

      {tab === 'briefs' && agent && (
        <div className="workspace">
          <AgentList
            agents={state.agents}
            selectedId={agent.id}
            pendingByAgent={pendingByAgent}
            now={now}
            onSelect={select}
            onAdd={(name, level) => {
              dispatch({ type: 'add_agent', id: `agent-${Date.now()}`, name, level, now: new Date().toISOString() });
              notify(`Added ${name} with a starting Brief for a ${level}.`);
            }}
          />
          <div className="column">
            <section className="panel agent-head" aria-label={`${agent.name} at a glance`}>
              <Avatar id={agent.id} name={agent.name} size="lg" />
              <div className="agent-head-text">
                <p className="agent-head-name">
                  {agent.name} <span className="role">{agent.level}</span>
                </p>
                <p className="muted small">
                  {LEVEL_HELP[agent.level]}{' '}
                  {agent.paused ? 'Paused: it will not act until you resume it.' : 'Active: it acts within its Brief.'}
                </p>
              </div>
              <button
                className={agent.paused ? 'primary' : ''}
                onClick={() => {
                  dispatch({ type: 'toggle_pause', agentId: agent.id, now: new Date().toISOString() });
                  notify(
                    agent.paused ? `${agent.name} is active again.` : `${agent.name} is paused. It won't act until you resume it.`,
                    agent.paused ? 'ok' : 'warn',
                  );
                }}
              >
                <Icon name={agent.paused ? 'play' : 'pause'} size={16} /> {agent.paused ? 'Resume' : 'Pause'}
              </button>
            </section>
            <BriefEditor
              key={`${agent.id}-${agent.brief.version}`}
              agent={agent}
              onSave={(brief) => {
                dispatch({ type: 'save_brief', agentId: agent.id, brief, now: new Date().toISOString() });
                notify(`Saved. ${agent.name}'s Brief is now version ${agent.brief.version + 1}.`);
              }}
            />
          </div>
        </div>
      )}

      {tab === 'approvals' && (
        <Approvals
          requests={state.requests}
          agents={state.agents}
          now={now}
          onTryAction={() => setTab('try')}
          onAnswer={(requestId, approve) => {
            const r = state.requests.find((x) => x.id === requestId);
            dispatch({ type: 'answer', requestId, approve, now: new Date().toISOString() });
            if (r) {
              const who = nameOf(r.attempt.agentId);
              notify(approve ? `Approved. ${who} can go ahead.` : `Declined. ${who} won't do it.`, approve ? 'ok' : 'neutral');
            }
          }}
        />
      )}

      {tab === 'try' && agent && (
        <>
          <div className="picker" role="group" aria-label="Agent to try with">
            <span className="label">Trying with</span>
            {state.agents.map((a) => (
              <button key={a.id} className="filter-chip" aria-pressed={a.id === agent.id} onClick={() => select(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
          <Scenarios dispatch={dispatch} goTo={setTab} />
          <Simulator agent={agent} lastEntry={lastEntry} onAttempt={(attempt) => dispatch({ type: 'attempt', attempt })} onReview={() => setTab('approvals')} />
          <Usage agent={agent} log={state.log} now={now.toISOString()} />
        </>
      )}

      {tab === 'replay' && (
        <Replay
          agents={state.agents}
          onEditBrief={(agentId) => {
            select(agentId);
            setTab('briefs');
          }}
        />
      )}

      {tab === 'activity' && <Activity log={state.log} agents={state.agents} />}

      <footer className="page-foot">
        <p className="muted small">
          The replay uses real agent history read from ziki.dev on 28 Oct 2026. Nothing is sent to Ziki, and changes are
          stored in this browser only.
        </p>
        <p className="foot-actions">
          <button
            className="ghost small"
            onClick={() => {
              if (window.confirm('Reload your Ziki data and the starting activity? Changes made in this browser will be lost.')) {
                dispatch({ type: 'reset', now: new Date().toISOString() });
                setTab('briefs');
                notify('Back to the starting data.');
              }
            }}
          >
            Reset to starting data
          </button>
          <button
            className="ghost small"
            onClick={() => {
              if (window.confirm('Go back to your five agents with their starting Briefs, with no activity or approvals?')) {
                dispatch({ type: 'reset', now: new Date().toISOString(), empty: true });
                setTab('briefs');
                notify('Started fresh with no activity.');
              }
            }}
          >
            Start with no activity
          </button>
        </p>
      </footer>
      <Toasts toasts={toasts} dismiss={dismiss} />
    </DashboardLayout>
  );
}
