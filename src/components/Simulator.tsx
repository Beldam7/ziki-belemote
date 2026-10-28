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

interface Props {
  agent: Agent;
  lastEntry: LogEntry | undefined;
  onAttempt: (attempt: Attempt) => void;
}

const SAMPLE_TITLES = [
  'Close buttons have no tooltip',
  'Thread panel is never mounted',
  'Invite link copy fails silently',
  'Settings button has an empty handler',
  'Emoji picker does not close on Escape',
  'Credits balance shows stale value',
];

export function Simulator({ agent, lastEntry, onAttempt }: Props) {
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
      <h2 id="sim-title">Try an agent action</h2>
      <p className="muted">
        This is a simulator. It shows what {agent.name} would be allowed to do under its current Brief. It does not
        contact Ziki.
      </p>
      <div className="grid">
        <label>
          <span className="label">Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value as ActionKind)}>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
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
          Agent tries this
        </button>
        <button onClick={runSampleDay}>Run a sample day (14 actions)</button>
      </div>
      {lastEntry && (
        <p className={`result ${lastEntry.kind}`} role="status">
          <strong>{labelFor(lastEntry.kind)}:</strong> {lastEntry.note}
        </p>
      )}
    </section>
  );
}

export function labelFor(kind: LogEntry['kind']): string {
  switch (kind) {
    case 'auto_allowed':
      return 'Allowed';
    case 'approved':
      return 'Approved';
    case 'denied':
      return 'Denied';
    case 'blocked':
      return 'Blocked';
    case 'skipped':
      return 'Skipped';
    case 'handed_off':
      return 'Handed off';
    case 'requested':
      return 'Needs your yes';
    case 'paused':
      return 'Pause';
  }
}
