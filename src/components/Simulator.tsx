import { useRef, useState } from 'react';
import {
  ACTIONS,
  ACTION_LABELS,
  ISSUE_TYPES,
  PLATFORMS,
  SEVERITIES,
  type ActionKind,
  type Agent,
  type Attempt,
  type IssueType,
  type LogEntry,
  type Platform,
  type Severity,
} from '../types';
import { levelAllows } from '../engine';
import { KIND_META } from '../status';
import { Icon, KindPill } from './ui';

interface Props {
  agent: Agent;
  lastEntry: LogEntry | undefined;
  onAttempt: (attempt: Attempt) => void;
  onReview: () => void;
}

const NEXT_STEP: Partial<Record<LogEntry['kind'], string>> = {
  auto_allowed: 'Nothing for you to do. In a real run, this would go ahead.',
  blocked: 'Nothing was sent. Change the Brief if you want to allow this.',
  requested: 'It is waiting for your answer.',
};

const SAMPLE_TITLES = [
  'Close buttons have no tooltip',
  'Thread panel is never mounted',
  'Invite link copy fails silently',
  'Settings button has an empty handler',
  'Emoji picker does not close on Escape',
  'Credits balance shows stale value',
];

export function Simulator({ agent, lastEntry, onAttempt, onReview }: Props) {
  const [action, setAction] = useState<ActionKind>('bid');
  const [platform, setPlatform] = useState<Platform>('Desktop');
  const [issueType, setIssueType] = useState<IssueType>('Fix');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [title, setTitle] = useState(SAMPLE_TITLES[0]);
  const counter = useRef(0);

  const send = (partial: Partial<Attempt> = {}) => {
    counter.current += 1;
    onAttempt({
      id: `${Date.now()}-${counter.current}`,
      agentId: agent.id,
      action,
      platform,
      issueType,
      severity,
      title: title.trim() || 'Untitled issue',
      at: new Date().toISOString(),
      source: 'you',
      ...partial,
    });
  };

  const runSampleDay = () => {
    const pick = <T,>(list: readonly T[], i: number): T => list[i % list.length];
    for (let i = 0; i < 14; i++) {
      send({
        // Different strides so every action, platform, type and severity shows up.
        action: pick(ACTIONS, i),
        platform: pick(PLATFORMS, i * 2 + 1),
        issueType: pick(ISSUE_TYPES, i * 3),
        severity: pick(SEVERITIES, i + 1),
        title: pick(SAMPLE_TITLES, i),
      });
    }
  };

  return (
    <section className="panel" aria-labelledby="sim-title">
      <h2 id="sim-title">Try an action yourself</h2>
      <p className="muted small">
        Pretend {agent.name} is about to do something and see what its Brief decides. This is a practice run: nothing is
        sent to Ziki.
      </p>
      <div className="grid">
        <label>
          <span className="label">Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value as ActionKind)}>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
                {levelAllows(agent.level, a) ? '' : ` (not for a ${agent.level})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Platform</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Issue type</span>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)}>
            {ISSUE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          <span className="label">Issue title</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>
      <div className="actions">
        <button className="primary" onClick={() => send()}>
          <Icon name="play" size={16} /> See what happens
        </button>
        <button onClick={runSampleDay} title="Sends 14 mixed actions at once and logs every decision in Activity">
          Run a sample day (14 actions)
        </button>
      </div>
      <div aria-live="polite">
        {lastEntry && (
          <div key={lastEntry.id} className={`result tone-${KIND_META[lastEntry.kind].tone}`}>
            <p className="result-head">
              <KindPill kind={lastEntry.kind} />
              <strong>{lastEntry.attempt?.title}</strong>
            </p>
            <p>{lastEntry.note}</p>
            {NEXT_STEP[lastEntry.kind] && <p className="muted small">{NEXT_STEP[lastEntry.kind]}</p>}
            {lastEntry.kind === 'requested' && (
              <button className="primary" onClick={onReview}>
                Review it now <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
