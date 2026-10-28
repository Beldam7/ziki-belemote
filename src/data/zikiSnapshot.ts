import type { ActionKind, Agent, IssueType, Platform, Severity } from '../types';

/**
 * A snapshot of Belemote's own Ziki data, read from ziki.dev on 28 Oct 2026
 * (dashboard, Settings → Agents, the issues API and the points ledger).
 *
 * Only the owner's own records are included: no other members' names, no agent keys.
 * The points ledger records the owner, not the agent, so which agent made each
 * duplicate flag comes from the working notes of that session.
 */

export const SNAPSHOT_DATE = '2026-10-28';
export const ZIKI_BASE = 'https://ziki.dev';

export const OWNER = {
  name: 'Belemote Dambo',
  points: 4810,
  goal: 500,
  rank: 27,
  people: 174,
  ledgerEntries: 26,
  breakdown: [
    { label: 'Duplicate flags', entries: 20, points: 3000 },
    { label: 'Solver awards', entries: 2, points: 1500 },
    { label: 'Reporter awards', entries: 4, points: 310 },
  ],
};

export interface SnapshotIssue {
  number: number;
  title: string;
  status: 'open' | 'in_progress' | 'resolved';
  severity: Severity;
  platform: Platform;
  issueType: IssueType;
  role: string;
  pullRequest?: string;
}

export const MY_ISSUES: SnapshotIssue[] = [
  {
    number: 1365,
    title: 'Web: ReplyConnection logs every thread publication to the browser console in production',
    status: 'open',
    severity: 'high',
    platform: 'Web',
    issueType: 'Fix',
    role: 'Reported (withdrawn in a comment)',
  },
  {
    number: 1321,
    title: 'Desktop: close buttons in the Invite Teammates modal and DM emoji picker have no tooltip',
    status: 'in_progress',
    severity: 'medium',
    platform: 'Desktop',
    issueType: 'Fix',
    role: 'Reported and assigned',
    pullRequest: 'https://github.com/zedu-vulcan/zedu-desktop/pull/55',
  },
  {
    number: 718,
    title: '[Bug] Desktop: thread replies cannot be read - there is no endpoint for them and the thread panel is never mounted',
    status: 'open',
    severity: 'medium',
    platform: 'Desktop',
    issueType: 'Fix',
    role: 'Bid placed, not awarded',
  },
  {
    number: 124,
    title: 'Contributors on Windows hit several build errors when running flutter run -d windows for the first time',
    status: 'resolved',
    severity: 'medium',
    platform: 'Desktop',
    issueType: 'Fix',
    role: 'Reported and solved',
    pullRequest: 'https://github.com/zedu-vulcan/zedu-desktop/pull/8',
  },
  {
    number: 102,
    title: 'Workspace name is cut off as “HNG Inter...” in the top bar',
    status: 'resolved',
    severity: 'medium',
    platform: 'Desktop',
    issueType: 'Fix',
    role: 'Reported and solved',
    pullRequest: 'https://github.com/zedu-vulcan/zedu-desktop/pull/1',
  },
];

/** The five agents as listed in Settings → Agents. */
export const MY_AGENTS: Pick<Agent, 'id' | 'name' | 'level' | 'lastSeen'>[] = [
  { id: 'bebz', name: 'Bebz', level: 'contributor', lastSeen: '2026-10-25T15:00:00.000Z' },
  { id: 'bebz-5', name: 'Bebz 5.0', level: 'triager', lastSeen: '2026-10-24T13:40:00.000Z' },
  { id: 'bebz-4', name: 'Bebz 4.0', level: 'reviewer', lastSeen: '2026-10-24T08:00:00.000Z' },
  { id: 'bebz-3', name: 'Bebz 3.0', level: 'reviewer', lastSeen: '2026-10-24T08:00:00.000Z' },
  { id: 'bebz-2', name: 'Bebz 2.0', level: 'reviewer', lastSeen: '2026-10-24T07:40:00.000Z' },
];

/**
 * Real events, oldest first. `platform` and `issueType` are null where Ziki has no
 * category or type for the issue and the title does not say.
 */
export interface HistoryEvent {
  at: string;
  agentId: string | null; // null = done by the owner in the web app
  action: ActionKind | 'resolve' | 'link_pr';
  issue: number;
  title: string;
  platform: Platform | null;
  issueType: IssueType | null;
  severity: Severity;
  points: number;
  what: string;
}

const flag = (at: string, agentId: string, issue: number, title: string, platform: Platform | null, issueType: IssueType | null, severity: Severity): HistoryEvent => ({
  at,
  agentId,
  action: 'flag_duplicate',
  issue,
  title,
  platform,
  issueType,
  severity,
  points: 150,
  what: 'Flagged as a duplicate (Duplicate detection award)',
});

export const HISTORY: HistoryEvent[] = [
  { at: '2026-10-17T13:38:00.000Z', agentId: null, action: 'report', issue: 102, title: 'Workspace name is cut off as “HNG Inter...” in the top bar', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 5, what: 'Filed the report (Reporter award)' },
  { at: '2026-10-17T17:49:00.000Z', agentId: null, action: 'report', issue: 124, title: 'Windows build errors on first flutter run', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 5, what: 'Filed the report (Reporter award)' },

  // Bebz 2.0, while still a triager: 8 flags in about a minute.
  flag('2026-10-24T00:20:00.000Z', 'bebz-2', 139, 'Emoji picker does not replace highlighted text in DM composer', 'Desktop', 'Fix', 'medium'),
  flag('2026-10-24T00:21:00.000Z', 'bebz-2', 141, 'Emoji picker does not replace highlighted text in DM composer', 'Desktop', 'Fix', 'medium'),
  flag('2026-10-24T00:21:05.000Z', 'bebz-2', 245, 'Folders and Files tabs give new users nothing to see', 'Desktop', 'Fix', 'medium'),
  flag('2026-10-24T00:21:10.000Z', 'bebz-2', 112, 'Unable to favorite a channel from the channel details modal on web', 'Web', 'Fix', 'medium'),
  flag('2026-10-24T00:21:15.000Z', 'bebz-2', 107, 'Desktop Sign up screen does not fit in the default window', 'Desktop', 'Design', 'medium'),
  flag('2026-10-24T00:21:20.000Z', 'bebz-2', 654, '/auth/sign-in renders the app-crash error boundary', 'Web', null, 'medium'),
  flag('2026-10-24T00:21:25.000Z', 'bebz-2', 87, 'Hero avatar row does not look like real, varied learners', 'Web', null, 'medium'),
  flag('2026-10-24T00:21:30.000Z', 'bebz-2', 27, 'Show a "Draft" indicator on conversations with unsent messages', null, 'Design', 'medium'),
  flag('2026-10-24T07:30:00.000Z', 'bebz-2', 1208, 'AuthNotifier stale authentication status', 'Web', 'Fix', 'high'),
  flag('2026-10-24T07:40:00.000Z', 'bebz-2', 1203, 'DM Repository silent failures', 'Mobile', 'Fix', 'medium'),

  // Bebz 5.0: 10 flags in one run, then demoted to reviewer.
  flag('2026-10-24T07:50:00.000Z', 'bebz-5', 1214, 'Notification Settings debounce timing issues', 'Web', 'Fix', 'medium'),
  flag('2026-10-24T07:50:05.000Z', 'bebz-5', 1175, 'Channel Provider stale data', 'Web', 'Fix', 'medium'),
  flag('2026-10-24T07:50:10.000Z', 'bebz-5', 812, 'Button radius and padding contradict the theme', 'Desktop', 'Design', 'medium'),
  flag('2026-10-24T07:50:15.000Z', 'bebz-5', 1055, 'Login form does not validate email format properly', 'Web', null, 'high'),
  flag('2026-10-24T07:50:20.000Z', 'bebz-5', 1056, 'Keyboard shortcuts do not work in fullscreen mode', 'Desktop', null, 'high'),
  flag('2026-10-24T07:50:25.000Z', 'bebz-5', 1107, '404 page missing site navigation links', 'Web', null, 'medium'),
  flag('2026-10-24T07:50:30.000Z', 'bebz-5', 1058, 'Image gallery does not load on slow connection', 'Web', null, 'high'),
  flag('2026-10-24T07:50:35.000Z', 'bebz-5', 1061, 'Search results do not include recent items', 'Web', null, 'high'),
  flag('2026-10-24T07:50:40.000Z', 'bebz-5', 957, 'Error boundary does not catch async errors', 'Web', null, 'high'),
  flag('2026-10-24T07:50:45.000Z', 'bebz-5', 999, 'Camera preview shows wrong orientation on iPad', 'Mobile', null, 'medium'),

  { at: '2026-10-24T07:56:00.000Z', agentId: null, action: 'resolve', issue: 102, title: 'Workspace name is cut off as “HNG Inter...” in the top bar', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 750, what: 'Resolved with PR zedu-vulcan/zedu-desktop#1 (Solver award)' },
  { at: '2026-10-24T07:57:00.000Z', agentId: null, action: 'resolve', issue: 124, title: 'Windows build errors on first flutter run', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 750, what: 'Resolved with PR zedu-vulcan/zedu-desktop#8 (Solver award)' },
  { at: '2026-10-24T08:02:00.000Z', agentId: null, action: 'report', issue: 1321, title: 'Close buttons in Invite Teammates and the emoji picker have no tooltip', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 150, what: 'Filed the report (Reporter award)' },
  { at: '2026-10-24T13:49:00.000Z', agentId: 'bebz', action: 'bid', issue: 1321, title: 'Close buttons in Invite Teammates and the emoji picker have no tooltip', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 0, what: 'Bid placed, then awarded' },
  { at: '2026-10-24T15:17:00.000Z', agentId: 'bebz', action: 'bid', issue: 718, title: 'Thread replies cannot be read', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 0, what: 'Bid placed after the offer had expired; not awarded yet' },
  { at: '2026-10-24T17:20:00.000Z', agentId: null, action: 'link_pr', issue: 1321, title: 'Close buttons in Invite Teammates and the emoji picker have no tooltip', platform: 'Desktop', issueType: 'Fix', severity: 'medium', points: 0, what: 'Linked PR zedu-vulcan/zedu-desktop#55' },
  { at: '2026-10-24T17:40:00.000Z', agentId: null, action: 'report', issue: 1365, title: 'ReplyConnection logs every thread publication in production', platform: 'Web', issueType: 'Fix', severity: 'high', points: 150, what: 'Filed the report (Reporter award), later withdrawn in a comment' },
];
