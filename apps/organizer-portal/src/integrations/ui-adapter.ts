import type { EventSalesSnapshot } from "../features/analytics.js";
import type { OrganizerEventInput } from "../features/events.js";

export interface ImportedUiEventForOrganizer {
  id: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
}

export interface ImportedUiListingForOrganizer {
  id: string;
  eventId: string;
  status: "active" | "cancelled" | "completed";
  askPrice: number;
}

export function toOrganizerEventInputs(events: ImportedUiEventForOrganizer[]): OrganizerEventInput[] {
  return events.map((event) => ({
    title: event.title,
    city: event.city,
    venue: event.venue,
    startAt: event.startAt,
    endAt: event.endAt
  }));
}

export function toEventSalesSnapshots(
  events: ImportedUiEventForOrganizer[],
  listings: ImportedUiListingForOrganizer[]
): EventSalesSnapshot[] {
  return events.map((event) => {
    const eventListings = listings.filter((listing) => listing.eventId === event.id);
    const sold = eventListings.filter((listing) => listing.status === "completed");

    return {
      eventId: event.id,
      reservations: eventListings.length,
      soldTickets: sold.length,
      grossRevenue: sold.reduce((sum, listing) => sum + listing.askPrice, 0),
      checkins: sold.length
    };
  });
}
