import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { KIND_META, hueFor, initials, type Tone } from '../status';
import type { LogKind } from '../types';

const PATHS = {
  brief: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  check: 'M5 12l5 5 9-10',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  hand: 'M12 3v9M8 6v7M16 6v7M4 11v2a8 8 0 0 0 16 0v-4',
  play: 'M8 5v14l11-7z',
  replay: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14',
  pause: 'M9 5v14M15 5v14',
  stop: 'M6 6l12 12M18 6L6 18',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  chat: 'M4 5h16v11H9l-5 4z',
  gavel: 'M14 4l6 6M11 7l6 6M8 10l6-6M3 21l8-8',
  file: 'M7 3h7l5 5v13H7zM12 11v6M9 14h6',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Avatar({ id, name, size }: { id: string; name: string; size?: 'sm' | 'lg' }) {
  return (
    <span className={`agent-avatar hue-${hueFor(id)}${size ? ` ${size}` : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Extra class on the option, used to colour on its own / ask first / never. */
  className?: string;
}

/**
 * A row of pill-shaped choices, one selected. Built on native radio inputs, so arrow keys
 * move and select, Tab enters and leaves the group, and the focus ring shows on the pill.
 */
export function Segmented<T extends string>({
  name,
  labelledBy,
  value,
  options,
  onChange,
  tone,
  stack,
}: {
  name: string;
  /** id of the element that names this group. */
  labelledBy: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** 'accent' is the neutral purple selection used where the choice has no good/bad meaning. */
  tone?: 'accent';
  /** On narrow screens, put the options on top of each other instead of side by side. */
  stack?: boolean;
}) {
  return (
    <div className={`seg${tone ? ` tone-${tone}` : ''}${stack ? ' seg-stack' : ''}`} role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((o) => (
        <label key={o.value} className={`seg-option${o.className ? ` ${o.className}` : ''}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * A quick "are you sure?" that opens in place instead of a browser pop-up.
 * Focus starts on the safe choice, and Escape cancels.
 */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="confirm-inline" role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`}>
      <p id={`${id}-title`}>
        <strong>{title}</strong>
      </p>
      <p id={`${id}-text`} className="small">
        {children}
      </p>
      <div className="actions">
        <button className="primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button autoFocus onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill-status tone-${tone}`}>{children}</span>;
}

export function KindPill({ kind }: { kind: LogKind }) {
  const meta = KIND_META[kind];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

/** Short-lived confirmations, announced to screen readers. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const notify = useCallback((text: string, tone: Tone = 'ok') => {
    next.current += 1;
    const id = next.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, notify, dismiss };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast tone-${t.tone}`}>
          <Icon name={t.tone === 'bad' ? 'stop' : t.tone === 'warn' ? 'clock' : 'check'} />
          <span>{t.text}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="stop" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Re-render every `ms` so relative times and countdowns stay current. */
export function useNow(ms = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
