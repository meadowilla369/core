import type { EventSummary } from "../features/events.js";
import type { Listing } from "../features/marketplace.js";
import type { Ticket } from "../features/tickets.js";

export interface ImportedUiEvent {
  id: string;
  title: string;
  city: string;
  venue: string;
  status: "active" | "cancelled";
}

export interface ImportedUiTicket {
  tokenId: string;
  eventId: string;
  reservationId: string;
  seatInfo: string;
}

export interface ImportedUiListing {
  id: string;
  tokenId: string;
  originalPrice: number;
  askPrice: number;
  status: "active" | "cancelled" | "completed";
}

export function toMobileEventSummaries(events: ImportedUiEvent[]): EventSummary[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    status: event.status
  }));
}

export function toMobileTickets(tickets: ImportedUiTicket[]): Ticket[] {
  return tickets.map((ticket) => ({
    tokenId: ticket.tokenId,
    eventId: ticket.eventId,
    reservationId: ticket.reservationId,
    seatInfo: ticket.seatInfo
  }));
}

export function toMobileListings(listings: ImportedUiListing[]): Listing[] {
  return listings.map((listing) => ({
    listingId: listing.id,
    tokenId: listing.tokenId,
    originalPrice: listing.originalPrice,
    askPrice: listing.askPrice,
    status: listing.status
  }));
}
