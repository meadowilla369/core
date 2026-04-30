export type StatusToneName = "info" | "success" | "attention" | "critical" | "neutral" | "review";

export interface StatusTone {
  name: StatusToneName;
  label: string;
  accent: string;
  soft: string;
  border: string;
  text: string;
  badgeClass: string;
}

export type EventLifecycleStatus =
  | "draft"
  | "scheduled"
  | "upcoming"
  | "active"
  | "live"
  | "cancelled"
  | "postponed"
  | "ended"
  | "archived";

export type OperationalStatus =
  | EventLifecycleStatus
  | "valid"
  | "completed"
  | "resolved"
  | "paid"
  | "duplicate"
  | "already_used"
  | "qr_expired"
  | "pending"
  | "awaiting_evidence"
  | "invalid"
  | "wrong_event"
  | "mark_as_used_failed"
  | "failed"
  | "rejected"
  | "blocked"
  | "no_data"
  | "sync_retry"
  | "manual_review"
  | "in_review"
  | "escalated"
  | "reconciling"
  | "open"
  | "processing"
  | "ready";

export const statusTones = {
  info: {
    name: "info",
    label: "Info",
    accent: "#2563EB",
    soft: "#DBEAFE",
    border: "#BFDBFE",
    text: "#1D4ED8",
    badgeClass: "border border-blue-200 bg-blue-100 text-blue-700"
  },
  success: {
    name: "success",
    label: "Success",
    accent: "#16A34A",
    soft: "#DCFCE7",
    border: "#BBF7D0",
    text: "#166534",
    badgeClass: "border border-green-200 bg-green-100 text-green-700"
  },
  attention: {
    name: "attention",
    label: "Attention",
    accent: "#D97706",
    soft: "#FEF3C7",
    border: "#FDE68A",
    text: "#92400E",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-800"
  },
  critical: {
    name: "critical",
    label: "Critical",
    accent: "#DC2626",
    soft: "#FEE2E2",
    border: "#FECACA",
    text: "#B91C1C",
    badgeClass: "border border-red-200 bg-red-100 text-red-700"
  },
  neutral: {
    name: "neutral",
    label: "Neutral",
    accent: "#64748B",
    soft: "#F1F5F9",
    border: "#CBD5E1",
    text: "#475569",
    badgeClass: "border border-slate-300 bg-slate-100 text-slate-600"
  },
  review: {
    name: "review",
    label: "Review",
    accent: "#9333EA",
    soft: "#F3E8FF",
    border: "#E9D5FF",
    text: "#7E22CE",
    badgeClass: "border border-purple-200 bg-purple-100 text-purple-700"
  }
} satisfies Record<StatusToneName, StatusTone>;

export const statusToneMap = {
  draft: "info",
  scheduled: "info",
  upcoming: "info",
  active: "success",
  live: "success",
  valid: "success",
  completed: "success",
  resolved: "success",
  paid: "success",
  postponed: "attention",
  duplicate: "attention",
  already_used: "attention",
  qr_expired: "attention",
  pending: "attention",
  awaiting_evidence: "attention",
  cancelled: "critical",
  invalid: "critical",
  wrong_event: "critical",
  mark_as_used_failed: "critical",
  failed: "critical",
  rejected: "critical",
  blocked: "critical",
  ended: "neutral",
  archived: "neutral",
  no_data: "neutral",
  sync_retry: "review",
  manual_review: "review",
  in_review: "review",
  escalated: "review",
  reconciling: "review",
  open: "info",
  processing: "info",
  ready: "info"
} satisfies Record<OperationalStatus, StatusToneName>;

export function getStatusTone(status: OperationalStatus): StatusTone {
  return statusTones[statusToneMap[status]];
}

export function getEventStatusTone(status: EventLifecycleStatus): StatusTone {
  return getStatusTone(status);
}
