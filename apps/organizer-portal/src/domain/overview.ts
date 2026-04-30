import { getEventStatusTone, getStatusTone, type StatusTone } from "./status.ts";
import type { OrganizerEventSummary, OrganizerSnapshot, QueueSnapshot } from "../lib/demo-data.ts";

export interface OverviewEvent extends OrganizerEventSummary {
  statusTone: StatusTone;
  availableTickets: number;
  sellThroughRate: number;
}

export interface OverviewRiskQueue extends QueueSnapshot {
  tone: StatusTone;
}

export interface OverviewModel {
  organizerId: string;
  generatedAt: string;
  kpis: {
    grossSalesVnd: number;
    ticketsSold: number;
    checkinRate: number;
    openRiskItems: number;
  };
  events: OverviewEvent[];
  gates: OrganizerSnapshot["gates"];
  riskQueues: OverviewRiskQueue[];
}

export function buildOverviewModel(snapshot: OrganizerSnapshot): OverviewModel {
  const ticketsSold = snapshot.events.reduce((sum, event) => sum + event.ticketsSold, 0);
  const grossSalesVnd = snapshot.events.reduce((sum, event) => sum + event.grossSalesVnd, 0);
  const activeCheckinRates = snapshot.events
    .filter((event) => event.checkinRate > 0)
    .map((event) => event.checkinRate);
  const openRiskItems = snapshot.queues.reduce((sum, queue) => sum + queue.count, 0);

  return {
    organizerId: snapshot.organizerId,
    generatedAt: snapshot.generatedAt,
    kpis: {
      grossSalesVnd,
      ticketsSold,
      checkinRate:
        activeCheckinRates.length === 0 ? 0 : Number(Math.max(...activeCheckinRates).toFixed(2)),
      openRiskItems
    },
    events: snapshot.events.map((event) => ({
      ...event,
      statusTone: getEventStatusTone(event.status),
      availableTickets: Math.max(event.ticketCapacity - event.ticketsSold - event.ticketsLocked, 0),
      sellThroughRate:
        event.ticketCapacity === 0
          ? 0
          : Number((event.ticketsSold / event.ticketCapacity).toFixed(2))
    })),
    gates: snapshot.gates,
    riskQueues: snapshot.queues.map((queue) => ({
      ...queue,
      tone: getStatusTone(queue.status)
    }))
  };
}
