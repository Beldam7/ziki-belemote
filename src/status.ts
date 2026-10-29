import type { Agent, LogKind, RequestStatus } from './types';

/** Visual tone of a status: done, needs a person, stopped, handed on, neutral or from Ziki. */
export type Tone = 'ok' | 'warn' | 'bad' | 'ask' | 'neutral' | 'info';

export const KIND_META: Record<LogKind, { label: string; tone: Tone }> = {
  auto_allowed: { label: 'Allowed', tone: 'ok' },
  approved: { label: 'You approved', tone: 'ok' },
  requested: { label: 'Needs you', tone: 'warn' },
  denied: { label: 'You declined', tone: 'bad' },
  blocked: { label: 'Stopped', tone: 'bad' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  handed_off: { label: 'Handed off', tone: 'ask' },
  paused: { label: 'Pause', tone: 'neutral' },
  history: { label: 'On Ziki', tone: 'info' },
};

export const REQUEST_META: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Needs you', tone: 'warn' },
  waiting: { label: 'Still waiting', tone: 'warn' },
  approved: { label: 'You approved', tone: 'ok' },
  denied: { label: 'You declined', tone: 'bad' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  handed_off: { label: 'Handed off', tone: 'ask' },
};

/** What each Ziki level is for, in plain words (from the Ziki agent docs). */
export const LEVEL_HELP: Record<Agent['level'], string> = {
  contributor: 'Files issues, bids on work and delivers fixes.',
  reviewer: 'Checks reports and tests fixes.',
  triager: 'Spots duplicate issues.',
};

/** A stable colour for each agent, so the same agent looks the same everywhere. */
export function hueFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 37 + c.charCodeAt(0)) >>> 0;
  return h % 6;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function timeAgo(iso: string | null, now: Date): string {
  if (!iso) return 'Not seen yet';
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
