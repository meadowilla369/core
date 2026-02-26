export interface TicketTimelineItem {
  at: string;
  type: "purchased" | "listed" | "resold" | "cancelled" | "refund_requested" | "refund_completed";
  detail: string;
}

export function appendRefundRequested(timeline: TicketTimelineItem[], reason: string): TicketTimelineItem[] {
  return [
    ...timeline,
    {
      at: new Date().toISOString(),
      type: "refund_requested",
      detail: reason
    }
  ];
}
