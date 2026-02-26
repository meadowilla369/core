export interface EventSummary {
  id: string;
  title: string;
  city: string;
  venue: string;
  status: "active" | "cancelled";
}

export interface EventFilter {
  city?: string;
  status?: "active" | "cancelled";
}

export interface TicketAvailability {
  ticketTypeId: string;
  available: number;
}

export function filterEvents(events: EventSummary[], filter: EventFilter): EventSummary[] {
  return events.filter((event) => {
    const cityMatch = filter.city ? event.city.toLowerCase().includes(filter.city.toLowerCase()) : true;
    const statusMatch = filter.status ? event.status === filter.status : true;
    return cityMatch && statusMatch;
  });
}

export function summarizeAvailability(items: TicketAvailability[]): number {
  return items.reduce((sum, item) => sum + item.available, 0);
}
