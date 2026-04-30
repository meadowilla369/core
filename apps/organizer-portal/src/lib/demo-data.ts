import type { EventLifecycleStatus, OperationalStatus } from "../domain/status.ts";

export interface OrganizerEventSummary {
  id: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: EventLifecycleStatus;
  grossSalesVnd: number;
  ticketsSold: number;
  ticketsLocked: number;
  ticketCapacity: number;
  checkinRate: number;
}

export interface GateSnapshot {
  gateId: string;
  checkedInCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export interface QueueSnapshot {
  id: "refunds" | "disputes" | "settlement" | "sync";
  label: string;
  count: number;
  description: string;
  status: OperationalStatus;
}

export interface OrganizerSnapshot {
  organizerId: string;
  generatedAt: string;
  events: OrganizerEventSummary[];
  gates: GateSnapshot[];
  queues: QueueSnapshot[];
}

export const demoOrganizerSnapshot: OrganizerSnapshot = {
  organizerId: "org_rockfest",
  generatedAt: "2026-04-29T10:00:00.000Z",
  events: [
    {
      id: "evt_rockfest_2026",
      title: "Rock Fest 2026",
      city: "Ho Chi Minh",
      venue: "Riverside Arena",
      startAt: "2026-05-10T19:00:00.000Z",
      endAt: "2026-05-10T23:00:00.000Z",
      status: "active",
      grossSalesVnd: 1_250_000_000,
      ticketsSold: 5550,
      ticketsLocked: 210,
      ticketCapacity: 7300,
      checkinRate: 0.68
    },
    {
      id: "evt_jazz_night_2026",
      title: "Jazz Night 2026",
      city: "Ha Noi",
      venue: "Opera Hall",
      startAt: "2026-06-01T12:30:00.000Z",
      endAt: "2026-06-01T16:00:00.000Z",
      status: "upcoming",
      grossSalesVnd: 570_000_000,
      ticketsSold: 1880,
      ticketsLocked: 64,
      ticketCapacity: 2500,
      checkinRate: 0
    },
    {
      id: "evt_product_launch_2026",
      title: "Creator Product Launch",
      city: "Da Nang",
      venue: "Han River Hall",
      startAt: "2026-07-12T13:00:00.000Z",
      endAt: "2026-07-12T16:00:00.000Z",
      status: "scheduled",
      grossSalesVnd: 0,
      ticketsSold: 0,
      ticketsLocked: 0,
      ticketCapacity: 900,
      checkinRate: 0
    }
  ],
  gates: [
    { gateId: "Gate A", checkedInCount: 1240, duplicateCount: 2, invalidCount: 1 },
    { gateId: "Gate B", checkedInCount: 1010, duplicateCount: 1, invalidCount: 0 },
    { gateId: "VIP", checkedInCount: 320, duplicateCount: 0, invalidCount: 0 }
  ],
  queues: [
    {
      id: "refunds",
      label: "Refund queue",
      count: 6,
      description: "1 failed payout and 5 pending refunds",
      status: "pending"
    },
    {
      id: "disputes",
      label: "Dispute SLA",
      count: 4,
      description: "1 case nearing SLA deadline",
      status: "in_review"
    },
    {
      id: "settlement",
      label: "Settlement",
      count: 1,
      description: "318M VND ready for final review",
      status: "ready"
    },
    {
      id: "sync",
      label: "Sync jobs",
      count: 1,
      description: "1 mark-as-used job retrying",
      status: "sync_retry"
    }
  ]
};
