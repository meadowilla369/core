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
  | "completed"
  | "cancelled"
  | "postponed"
  | "ended"
  | "archived";

export type OperationalStatus =
  | EventLifecycleStatus
  | "valid"
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
    soft: "bg-blue-100",
    border: "border border-blue-200",
    text: "text-blue-700",
    badgeClass: "border border-blue-200 bg-blue-100 text-blue-700"
  },
  success: {
    name: "success",
    label: "Success",
    accent: "#16A34A",
    soft: "bg-green-100",
    border: "border border-green-200",
    text: "text-green-700",
    badgeClass: "border border-green-200 bg-green-100 text-green-700"
  },
  attention: {
    name: "attention",
    label: "Attention",
    accent: "#D97706",
    soft: "bg-amber-100",
    border: "border border-amber-200",
    text: "text-amber-800",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-800"
  },
  critical: {
    name: "critical",
    label: "Critical",
    accent: "#DC2626",
    soft: "bg-red-100",
    border: "border border-red-200",
    text: "text-red-700",
    badgeClass: "border border-red-200 bg-red-100 text-red-700"
  },
  neutral: {
    name: "neutral",
    label: "Neutral",
    accent: "#64748B",
    soft: "bg-slate-100",
    border: "border border-slate-300",
    text: "text-slate-600",
    badgeClass: "border border-slate-300 bg-slate-100 text-slate-600"
  },
  review: {
    name: "review",
    label: "Review",
    accent: "#9333EA",
    soft: "bg-purple-100",
    border: "border border-purple-200",
    text: "text-purple-700",
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
