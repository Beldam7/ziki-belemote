import { useRef, useState } from 'react';
import { minutesLeft } from './engine';
import { Activity } from './components/Activity';
import { AgentList } from './components/AgentList';
import { AgentHeader } from './components/AgentHeader';
import { Approvals } from './components/Approvals';
import { BriefEditor } from './components/BriefEditor';
import { DashboardLayout } from './components/DashboardLayout';
import { Replay } from './components/Replay';
import { Scenarios } from './components/Scenarios';
import { Simulator } from './components/Simulator';
import { Usage } from './components/Usage';
import { ConfirmPanel, Icon, Toasts, useNow, useToasts, type IconName } from './components/ui';
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
  const [resetting, setResetting] = useState<'reset' | 'empty' | null>(null);
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
  const waitingNote = open.length
    ? soonest !== undefined
      ? `Next one runs out in ${soonest} min`
      : 'Still waiting for your answer'
    : 'Nothing needs you';
  const activeCount = state.agents.filter((a) => !a.paused).length;
  const pausedCount = state.agents.length - activeCount;
  const editorRef = useRef<HTMLDivElement>(null);
  const calmMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Below this width the Brief editor sits under the agent list instead of beside it.
  const stacked = () => window.matchMedia('(max-width: 900px)').matches;
  const selectFromList = (agentId: string) => {
    select(agentId);
    if (stacked()) {
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: calmMotion() ? 'auto' : 'smooth', block: 'start' }));
    }
  };
  const backToAgents = () => {
    document.getElementById('agent-list')?.scrollIntoView({ behavior: calmMotion() ? 'auto' : 'smooth', block: 'start' });
    document.querySelector<HTMLElement>('.agent-item.selected')?.focus({ preventScroll: true });
  };
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
        <span className="bubble b1" aria-hidden="true" />
        <span className="bubble b2" aria-hidden="true" />
        <span className="bubble b3" aria-hidden="true" />
        <span className="bubble b4" aria-hidden="true" />
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
        <ul className="hero-stats">
          <li>
            <div className="hero-stat s-agents">
              <span className="stat-label">
                <Icon name="users" size={15} /> Agents
              </span>
              <span className="stat-value">{state.agents.length}</span>
              <span className="stat-note">
                {activeCount} active{pausedCount ? ` · ${pausedCount} paused` : ''}
              </span>
            </div>
          </li>
          <li>
            <button
              className={`hero-stat s-wait${open.length ? ' hot' : ''}`}
              onClick={() => setTab('approvals')}
              aria-label={`${open.length} waiting for you. ${waitingNote}. Open Approvals.`}
            >
              <span className="stat-label">
                <Icon name="hand" size={15} /> Waiting for you
              </span>
              <span className="stat-value">{open.length}</span>
              <span className="stat-note">{waitingNote}</span>
              <span className="stat-cue">
                {open.length ? 'Review now' : 'Open Approvals'} <Icon name="arrow" size={14} />
              </span>
            </button>
          </li>
          <li>
            <div className="hero-stat s-decide">
              <span className="stat-label">
                <Icon name="shield" size={15} /> Brief decisions
              </span>
              <span className="stat-value">{decisions}</span>
              <span className="stat-note">Allowed, stopped or asked</span>
            </div>
          </li>
        </ul>
      </header>

      <nav className="tabs" aria-label="Agent Briefs sections">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-${t.id}${tab === t.id ? ' active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} title={t.hint} onClick={() => setTab(t.id)}>
            <span className="tab-icon">
              <Icon name={t.icon} size={15} />
            </span>
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
            onSelect={selectFromList}
            onAdd={(name, level) => {
              dispatch({ type: 'add_agent', id: `agent-${Date.now()}`, name, level, now: new Date().toISOString() });
              notify(`Added ${name} with a starting Brief for a ${level}.`);
            }}
          />
          <div className="column" ref={editorRef}>
            <a
              className="back-link"
              href="#agent-list"
              onClick={(e) => {
                e.preventDefault();
                backToAgents();
              }}
            >
              <Icon name="arrow" size={14} /> Back to agents
            </a>
            <AgentHeader
              agent={agent}
              waiting={pendingByAgent[agent.id] ?? 0}
              onPause={() => {
                dispatch({ type: 'toggle_pause', agentId: agent.id, now: new Date().toISOString() });
                notify(`${agent.name} is paused. It won't start anything new until you resume it.`, 'warn');
              }}
              onResume={() => {
                dispatch({ type: 'toggle_pause', agentId: agent.id, now: new Date().toISOString() });
                notify(`${agent.name} is active again.`);
              }}
            />
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
          <button className="ghost small" onClick={() => setResetting('reset')}>
            Reset to starting data
          </button>
          <button className="ghost small" onClick={() => setResetting('empty')}>
            Start with no activity
          </button>
        </p>
        {resetting && (
          <ConfirmPanel
            title={resetting === 'reset' ? 'Go back to the starting data?' : 'Start with no activity?'}
            confirmLabel={resetting === 'reset' ? 'Reset to starting data' : 'Start with no activity'}
            cancelLabel="Keep what I have"
            onCancel={() => setResetting(null)}
            onConfirm={() => {
              dispatch({ type: 'reset', now: new Date().toISOString(), empty: resetting === 'empty' });
              setResetting(null);
              setTab('briefs');
              notify(resetting === 'reset' ? 'Back to the starting data.' : 'Started fresh with no activity.');
            }}
          >
            {resetting === 'reset'
              ? 'Your five agents go back to their starting Briefs and the real Ziki history is reloaded. Changes you made in this browser, including any agents you added, are lost.'
              : 'Your five agents go back to their starting Briefs, and all activity and approvals are cleared. Changes you made in this browser, including any agents you added, are lost.'}
          </ConfirmPanel>
        )}
      </footer>
      <Toasts toasts={toasts} dismiss={dismiss} />
    </DashboardLayout>
  );
}
