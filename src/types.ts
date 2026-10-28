export const PLATFORMS = ['Desktop', 'Web', 'Mobile'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const ISSUE_TYPES = ['Fix', 'Feat', 'Design', 'Marketing'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ACTIONS = ['bid', 'accept_offer', 'review', 'flag_duplicate', 'report', 'comment'] as const;
export type ActionKind = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<ActionKind, string> = {
  bid: 'Bid on an issue',
  accept_offer: 'Accept an offer',
  review: 'Review a report',
  flag_duplicate: 'Flag a duplicate',
  report: 'File a report',
  comment: 'Post a comment',
};

export type Mode = 'allow' | 'ask' | 'never';
export type OnTimeout = 'skip' | 'wait' | 'handoff';

export interface ActionRule {
  mode: Mode;
  /** Max executed actions per day. null = no limit. */
  dailyLimit: number | null;
}

export interface Brief {
  version: number;
  platforms: Platform[];
  issueTypes: IssueType[];
  /** Highest severity the agent may act on without asking. */
  maxSeverity: Severity;
  rules: Record<ActionKind, ActionRule>;
  askTimeoutMinutes: number;
  onTimeout: OnTimeout;
  handoffTo: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  level: 'contributor' | 'reviewer' | 'triager';
  paused: boolean;
  brief: Brief;
  lastSeen: string | null;
}

export interface Attempt {
  id: string;
  agentId: string;
  action: ActionKind;
  platform: Platform;
  issueType: IssueType;
  severity: Severity;
  title: string;
  at: string;
}

export type Outcome = 'allowed' | 'needs_approval' | 'blocked';

export interface Decision {
  outcome: Outcome;
  reason: string;
  /** Set when this action brings the agent to 80% or more of a daily limit. */
  warning?: string;
}

export type RequestStatus = 'pending' | 'waiting' | 'approved' | 'denied' | 'skipped' | 'handed_off';

export interface ApprovalRequest {
  id: string;
  attempt: Attempt;
  reason: string;
  briefVersion: number;
  createdAt: string;
  expiresAt: string;
  status: RequestStatus;
  handedOffTo?: string;
  resolvedAt?: string;
}

export type LogKind = 'auto_allowed' | 'approved' | 'denied' | 'blocked' | 'skipped' | 'handed_off' | 'requested' | 'paused';

export interface LogEntry {
  id: string;
  at: string;
  agentId: string;
  kind: LogKind;
  attempt?: Attempt;
  briefVersion: number;
  note: string;
}

export interface State {
  agents: Agent[];
  requests: ApprovalRequest[];
  log: LogEntry[];
  selectedAgentId: string | null;
}
