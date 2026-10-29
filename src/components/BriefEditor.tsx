import { useEffect, useRef, useState } from 'react';
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
import { Icon, Segmented, type IconName } from './ui';

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

/** "a", "a and b", "a, b and c" */
function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const ACTION_ICON: Record<ActionKind, IconName> = {
  bid: 'gavel',
  accept_offer: 'check',
  review: 'eye',
  flag_duplicate: 'copy',
  report: 'file',
  comment: 'chat',
};

const MODES = [
  { value: 'allow', label: 'On its own', className: 'mode-allow' },
  { value: 'ask', label: 'Ask me first', className: 'mode-ask' },
  { value: 'never', label: 'Never', className: 'mode-never' },
] satisfies { value: Mode; label: string; className: string }[];

const SEVERITY_OPTIONS = SEVERITIES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

const TIMEOUT_OPTIONS: { value: OnTimeout; label: string }[] = [
  { value: 'skip', label: 'Skip the action' },
  { value: 'wait', label: 'Keep waiting for me' },
  { value: 'handoff', label: 'Hand it to a teammate' },
];

/**
 * A daily-limit box that lets you type freely (even clear it to retype), clamps to the
 * safe maximum, and says so when it had to.
 */
function LimitInput({
  action,
  value,
  disabled,
  hintId,
  onChange,
}: {
  action: ActionKind;
  value: number;
  disabled: boolean;
  hintId: string;
  onChange: (n: number) => void;
}) {
  const { max } = SAFE_DAILY_LIMITS[action];
  const [text, setText] = useState(String(value));
  const [tooHigh, setTooHigh] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  // Follow outside changes (like Discard) unless the person is in the middle of typing.
  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setText(String(value));
      setTooHigh(null);
    }
  }, [value]);

  return (
    <span className="limit-wrap">
      <label className={`limit${disabled ? ' off' : ''}`}>
        <input
          ref={ref}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          disabled={disabled}
          aria-label={`Daily limit for ${ACTION_LABELS[action]}`}
          aria-describedby={tooHigh !== null ? `${hintId} ${hintId}-clamp` : hintId}
          aria-invalid={tooHigh !== null ? true : undefined}
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            if (raw === '') return;
            const n = Math.max(0, Math.floor(Number(raw)));
            if (Number.isNaN(n)) return;
            if (n > max) {
              setTooHigh(n);
              setText(String(max));
              onChange(max);
            } else {
              setTooHigh(null);
              onChange(n);
            }
          }}
          onBlur={() => {
            if (text === '') setText(String(value));
          }}
        />
        <span className="muted small">a day</span>
      </label>
      {tooHigh !== null && (
        <span id={`${hintId}-clamp`} className="field-error small" role="status">
          {tooHigh} is above the safe limit, so it was set to {max} a day.
        </span>
      )}
    </span>
  );
}

/** The Brief in plain words, built from the same rules the engine applies. */
function describe(draft: Draft, agent: Agent): string[] {
  const actions = ACTIONS.filter((a) => levelAllows(agent.level, a));
  const verb = (a: ActionKind) => ACTION_LABELS[a].charAt(0).toLowerCase() + ACTION_LABELS[a].slice(1);
  const byMode = (m: Mode) => actions.filter((a) => draft.rules[a].mode === m);
  const lines: string[] = [];

  const own = byMode('allow').map((a) => `${verb(a)} (up to ${effectiveLimit(a, draft.rules[a].dailyLimit)} a day)`);
  if (own.length) lines.push(`On its own, ${agent.name} can ${joinWords(own)}.`);
  const ask = byMode('ask').map(verb);
  if (ask.length) lines.push(`It asks you before it does this: ${joinWords(ask)}.`);
  const never = byMode('never').map(verb);
  if (never.length) lines.push(`It will never ${joinWords(never)}.`);
  if (!own.length && !ask.length) lines.push(`${agent.name} is not allowed to do anything right now.`);

  if (own.length) {
    lines.push(
      draft.platforms.length && draft.issueTypes.length
        ? `It only goes ahead alone on ${joinWords(draft.platforms)} ${joinWords(draft.issueTypes)} issues up to ${draft.maxSeverity} severity. For anything else, it asks you.`
        : 'No platform or issue type is ticked, so it asks you about everything.',
    );
  }

  const wait = `If you don't answer within ${draft.askTimeoutMinutes} min`;
  if (draft.onTimeout === 'skip') lines.push(`${wait}, it skips the action.`);
  else if (draft.onTimeout === 'wait') lines.push("If you don't answer, it keeps waiting for you.");
  else if (draft.handoffTo.trim()) lines.push(`${wait}, it hands the request to ${draft.handoffTo.trim()}.`);
  else lines.push(`${wait}, it skips the action, because no teammate is named to hand it to.`);

  return lines;
}

export function BriefEditor({ agent, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(agent.brief));
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(agent.brief));
  const actions = ACTIONS.filter((a) => levelAllows(agent.level, a));
  const saved = new Date(agent.brief.updatedAt);

  const setRule = (action: ActionKind, patch: Partial<ActionRule>) =>
    setDraft((d) => ({ ...d, rules: { ...d.rules, [action]: { ...d.rules[action], ...patch } } }));

  return (
    <section className="panel brief" aria-labelledby="brief-title">
      <header className="panel-head">
        <div>
          <h2 id="brief-title">{agent.name}'s Brief</h2>
          <p className="muted small">
            Version {agent.brief.version} · saved{' '}
            {saved.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at{' '}
            {saved.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`save-state${dirty ? ' unsaved' : ''}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
      </header>

      <div className="plain-words" aria-live="polite">
        <p className="eyebrow">
          <Icon name="spark" size={16} /> In plain words
        </p>
        <ul>
          {describe(draft, agent).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="brief-section">
        <h3>
          <Icon name="bolt" size={16} /> What it can do
        </h3>
        <p className="muted small">
          Only the actions a {agent.level} can take on Ziki are listed. Daily limits stop below the point where Ziki
          refuses, flags or demotes an agent.
        </p>
        <ul className="rules">
          {actions.map((a) => {
            const rule = draft.rules[a];
            const safe = SAFE_DAILY_LIMITS[a];
            return (
              <li key={a} className="rule">
                <span className="rule-name" id={`rule-${a}`}>
                  <span className="rule-icon">
                    <Icon name={ACTION_ICON[a]} size={16} />
                  </span>
                  {ACTION_LABELS[a]}
                </span>
                <Segmented
                  name={`mode-${a}`}
                  labelledBy={`rule-${a}`}
                  value={rule.mode}
                  options={MODES}
                  onChange={(mode) => setRule(a, { mode })}
                />
                <LimitInput
                  action={a}
                  value={effectiveLimit(a, rule.dailyLimit)}
                  disabled={rule.mode === 'never'}
                  hintId={`max-${a}`}
                  onChange={(dailyLimit) => setRule(a, { dailyLimit })}
                />
                <span id={`max-${a}`} className="muted small rule-why">
                  Up to {safe.max} a day, {safe.why}.
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="brief-section">
        <h3>
          <Icon name="shield" size={16} /> Where it can act alone
        </h3>
        <p className="muted small">Outside these, the agent asks you first.</p>
        <div className="scope">
          <fieldset className="plain">
            <legend className="label">Platforms</legend>
            <div className="chip-row">
              {PLATFORMS.map((p: Platform) => (
                <label key={p} className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={draft.platforms.includes(p)}
                    onChange={() => setDraft((d) => ({ ...d, platforms: toggle(d.platforms, p) }))}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="plain">
            <legend className="label">Issue types</legend>
            <div className="chip-row">
              {ISSUE_TYPES.map((t: IssueType) => (
                <label key={t} className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={draft.issueTypes.includes(t)}
                    onChange={() => setDraft((d) => ({ ...d, issueTypes: toggle(d.issueTypes, t) }))}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <span className="label" id="severity-label">
              Highest severity it handles alone
            </span>
            <Segmented
              name="max-severity"
              labelledBy="severity-label"
              tone="accent"
              value={draft.maxSeverity}
              options={SEVERITY_OPTIONS}
              onChange={(maxSeverity: Severity) => setDraft((d) => ({ ...d, maxSeverity }))}
            />
            <span className="muted small">
              {draft.maxSeverity === 'critical'
                ? 'It handles every severity on its own.'
                : `Anything above ${draft.maxSeverity} goes to you first.`}
            </span>
          </div>
        </div>
        {(!draft.platforms.length || !draft.issueTypes.length) && (
          <p className="field-hint warn">
            Tick at least one platform and one issue type, or {agent.name} will ask you about every action.
          </p>
        )}
      </div>

      <div className="brief-section">
        <h3>
          <Icon name="clock" size={16} /> When it needs you
        </h3>
        <div className="row">
          <label>
            <span className="label">Time you have to answer</span>
            <span className="with-suffix">
              <input
                type="number"
                min={1}
                value={draft.askTimeoutMinutes}
                disabled={draft.onTimeout === 'wait'}
                onChange={(e) => setDraft((d) => ({ ...d, askTimeoutMinutes: Math.max(1, Number(e.target.value) || 1) }))}
              />
              <span className="muted small">minutes</span>
            </span>
          </label>
          <div className="field">
            <span className="label" id="timeout-label">
              If you don't answer in time
            </span>
            <Segmented
              name="on-timeout"
              labelledBy="timeout-label"
              tone="accent"
              stack
              value={draft.onTimeout}
              options={TIMEOUT_OPTIONS}
              onChange={(onTimeout) => setDraft((d) => ({ ...d, onTimeout }))}
            />
          </div>
          {draft.onTimeout === 'handoff' && (
            <label>
              <span className="label">Teammate</span>
              <input
                type="text"
                value={draft.handoffTo}
                placeholder="For example, Team lead"
                aria-describedby={!draft.handoffTo.trim() ? 'handoff-hint' : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, handoffTo: e.target.value }))}
              />
            </label>
          )}
        </div>
        {draft.onTimeout === 'handoff' && !draft.handoffTo.trim() && (
          <p id="handoff-hint" className="field-hint warn">
            Add a name. Without one, unanswered requests are skipped instead.
          </p>
        )}
      </div>

      {dirty && (
        <div className="save-bar" role="region" aria-label="Unsaved changes">
          <span>
            <strong>Unsaved changes</strong>
            <span className="muted small"> · Saving creates version {agent.brief.version + 1}.</span>
          </span>
          <span className="actions">
            <button onClick={() => setDraft(toDraft(agent.brief))}>Discard</button>
            <button className="primary" onClick={() => onSave(draft)}>
              Save Brief
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
