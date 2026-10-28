import { useState } from 'react';
import { SAFE_DAILY_LIMITS, effectiveLimit, levelAllows } from '../engine';
import {
  ACTIONS,
  ACTION_LABELS,
  ISSUE_TYPES,
  PLATFORMS,
  SEVERITIES,
  type ActionKind,
  type ActionRule,
  type Agent,
  type Brief,
  type IssueType,
  type Mode,
  type OnTimeout,
  type Platform,
  type Severity,
} from '../types';

type Draft = Omit<Brief, 'version' | 'updatedAt'>;

interface Props {
  agent: Agent;
  onSave: (brief: Draft) => void;
}

function toDraft(brief: Brief): Draft {
  const { version: _v, updatedAt: _u, ...rest } = brief;
  return structuredClone(rest);
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function BriefEditor({ agent, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(agent.brief));
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(agent.brief));

  const setRule = (action: ActionKind, patch: Partial<ActionRule>) =>
    setDraft((d) => ({ ...d, rules: { ...d.rules, [action]: { ...d.rules[action], ...patch } } }));

  return (
    <section className="panel" aria-labelledby="brief-title">
      <header className="panel-head">
        <div>
          <h2 id="brief-title">Brief for {agent.name}</h2>
          <p className="muted">Version {agent.brief.version}. Saving creates version {agent.brief.version + 1}.</p>
        </div>
        <button className="primary" disabled={!dirty} onClick={() => onSave(draft)}>
          Save Brief
        </button>
      </header>

      <fieldset>
        <legend>1. Scope</legend>
        <div className="row">
          <div>
            <p className="label">Platforms</p>
            {PLATFORMS.map((p: Platform) => (
              <label key={p} className="check">
                <input
                  type="checkbox"
                  checked={draft.platforms.includes(p)}
                  onChange={() => setDraft((d) => ({ ...d, platforms: toggle(d.platforms, p) }))}
                />
                {p}
              </label>
            ))}
          </div>
          <div>
            <p className="label">Issue types</p>
            {ISSUE_TYPES.map((t: IssueType) => (
              <label key={t} className="check">
                <input
                  type="checkbox"
                  checked={draft.issueTypes.includes(t)}
                  onChange={() => setDraft((d) => ({ ...d, issueTypes: toggle(d.issueTypes, t) }))}
                />
                {t}
              </label>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="maxSev">
              Highest severity without asking
            </label>
            <select
              id="maxSev"
              value={draft.maxSeverity}
              onChange={(e) => setDraft((d) => ({ ...d, maxSeverity: e.target.value as Severity }))}
            >
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>2. Allowed actions and daily limits</legend>
        <p className="muted small">
          Only the actions a {agent.level} can take on Ziki are shown. Each limit is capped below the point where Ziki
          refuses, flags or demotes an agent.
        </p>
        <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th>Action</th>
              <th>Rule</th>
              <th>Daily limit</th>
            </tr>
          </thead>
          <tbody>
            {ACTIONS.filter((a) => levelAllows(agent.level, a)).map((a) => {
              const rule = draft.rules[a];
              return (
                <tr key={a}>
                  <td>{ACTION_LABELS[a]}</td>
                  <td>
                    <select
                      aria-label={`Rule for ${ACTION_LABELS[a]}`}
                      value={rule.mode}
                      onChange={(e) => setRule(a, { mode: e.target.value as Mode })}
                    >
                      <option value="allow">Allow</option>
                      <option value="ask">Ask first</option>
                      <option value="never">Never</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={SAFE_DAILY_LIMITS[a].max}
                      aria-label={`Daily limit for ${ACTION_LABELS[a]}`}
                      aria-describedby={`max-${a}`}
                      value={effectiveLimit(a, rule.dailyLimit)}
                      onChange={(e) => {
                        const n = e.target.value === '' ? SAFE_DAILY_LIMITS[a].max : Math.floor(Number(e.target.value));
                        setRule(a, { dailyLimit: effectiveLimit(a, Math.max(0, n)) });
                      }}
                    />
                    <span id={`max-${a}`} className="muted small limit-max">
                      Max {SAFE_DAILY_LIMITS[a].max}. {SAFE_DAILY_LIMITS[a].why}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </fieldset>

      <fieldset>
        <legend>3 and 4. Ask-first timing and hand-off</legend>
        <div className="row">
          <div>
            <label className="label" htmlFor="timeout">
              Minutes the owner has to answer
            </label>
            <input
              id="timeout"
              type="number"
              min={1}
              value={draft.askTimeoutMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, askTimeoutMinutes: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="onTimeout">
              If nobody answers
            </label>
            <select
              id="onTimeout"
              value={draft.onTimeout}
              onChange={(e) => setDraft((d) => ({ ...d, onTimeout: e.target.value as OnTimeout }))}
            >
              <option value="skip">Skip the action</option>
              <option value="wait">Keep waiting</option>
              <option value="handoff">Hand off to a teammate</option>
            </select>
          </div>
          {draft.onTimeout === 'handoff' && (
            <div>
              <label className="label" htmlFor="handoff">
                Teammate to hand off to
              </label>
              <input
                id="handoff"
                type="text"
                value={draft.handoffTo}
                placeholder="Name"
                onChange={(e) => setDraft((d) => ({ ...d, handoffTo: e.target.value }))}
              />
            </div>
          )}
        </div>
      </fieldset>
    </section>
  );
}
