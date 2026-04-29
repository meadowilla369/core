export type StatusToneIntent = "info" | "success" | "attention" | "critical" | "neutral" | "review";

export interface StatusTone {
  intent: StatusToneIntent;
  label: string;
  accent: string;
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

export type OrganizerStatus =
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
    intent: "info",
    label: "Info",
    accent: "#2563EB",
    badgeClass: "border border-blue-200 bg-blue-100 text-blue-700"
  },
  success: {
    intent: "success",
    label: "Success",
    accent: "#16A34A",
    badgeClass: "border border-green-200 bg-green-100 text-green-700"
  },
  attention: {
    intent: "attention",
    label: "Attention",
    accent: "#D97706",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-800"
  },
  critical: {
    intent: "critical",
    label: "Critical",
    accent: "#DC2626",
    badgeClass: "border border-red-200 bg-red-100 text-red-700"
  },
  neutral: {
    intent: "neutral",
    label: "Neutral",
    accent: "#64748B",
    badgeClass: "border border-slate-300 bg-slate-100 text-slate-600"
  },
  review: {
    intent: "review",
    label: "Review",
    accent: "#9333EA",
    badgeClass: "border border-purple-200 bg-purple-100 text-purple-700"
  }
} satisfies Record<StatusToneIntent, StatusTone>;

export const statusToneMap = {
  draft: statusTones.info,
  scheduled: statusTones.info,
  upcoming: statusTones.info,
  active: statusTones.success,
  live: statusTones.success,
  valid: statusTones.success,
  completed: statusTones.success,
  resolved: statusTones.success,
  paid: statusTones.success,
  postponed: statusTones.attention,
  duplicate: statusTones.attention,
  already_used: statusTones.attention,
  qr_expired: statusTones.attention,
  pending: statusTones.attention,
  awaiting_evidence: statusTones.attention,
  cancelled: statusTones.critical,
  invalid: statusTones.critical,
  wrong_event: statusTones.critical,
  mark_as_used_failed: statusTones.critical,
  failed: statusTones.critical,
  rejected: statusTones.critical,
  blocked: statusTones.critical,
  ended: statusTones.neutral,
  archived: statusTones.neutral,
  no_data: statusTones.neutral,
  sync_retry: statusTones.review,
  manual_review: statusTones.review,
  in_review: statusTones.review,
  escalated: statusTones.review,
  reconciling: statusTones.review,
  open: statusTones.info,
  processing: statusTones.info,
  ready: statusTones.info
} satisfies Record<OrganizerStatus, StatusTone>;

export function getStatusTone(status: OrganizerStatus): StatusTone {
  return statusToneMap[status];
}

export function getEventStatusTone(status: EventLifecycleStatus): StatusTone {
  return getStatusTone(status);
}
