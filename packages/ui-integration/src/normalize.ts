import {
  type NormalizedDisputeSummary,
  type NormalizedEventDetail,
  type NormalizedMarketplaceListing,
  type NormalizedTicketRecord,
  type RawFigmaDataset,
  type RawFigmaDisputeStatus,
  type RawFigmaResaleStatus,
  type RawFigmaTicketStatus,
  type NormalizedUiDataset
} from "./types.js";

function extractCityFromVenue(venue: string): string {
  const parts = venue.split(",").map((item) => item.trim());
  return parts[parts.length - 1] ?? "Unknown";
}

function inferEventEndAt(startAt: string): string {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return startAt;
  }

  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return end.toISOString();
}

function normalizeEventStatus(rawDate: string): "active" | "cancelled" {
  const timestamp = Date.parse(rawDate);
  if (Number.isNaN(timestamp)) {
    return "active";
  }

  return "active";
}

function normalizeTicketState(state: RawFigmaTicketStatus): "active" | "used" | "resale" | "expired" {
  if (state === "active" || state === "used" || state === "resale" || state === "expired") {
    return state;
  }

  return "active";
}

function normalizeListingStatus(status: RawFigmaResaleStatus): "active" | "cancelled" | "completed" {
  if (status === "active") {
    return "active";
  }

  if (status === "sold") {
    return "completed";
  }

  return "cancelled";
}

function normalizeDisputeStatus(status: RawFigmaDisputeStatus): "open" | "investigating" | "resolved" | "closed" {
  if (status === "open" || status === "investigating" || status === "resolved" || status === "closed") {
    return status;
  }

  return "open";
}

export function toNormalizedEvents(raw: RawFigmaDataset["events"]): NormalizedEventDetail[] {
  return raw.map((event) => {
    const startAt = new Date(event.date).toISOString();

    return {
      id: event.id,
      organizerId: event.organizerId,
      title: event.title,
      city: extractCityFromVenue(event.venue),
      venue: event.venue,
      startAt,
      endAt: inferEventEndAt(startAt),
      status: normalizeEventStatus(event.date),
      ticketTypes: event.tickets.map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        price: ticket.price,
        quantity: ticket.total,
        soldCount: Math.max(0, ticket.total - ticket.available)
      }))
    };
  });
}

export function toNormalizedTickets(
  raw: RawFigmaDataset["tickets"],
  events: NormalizedEventDetail[]
): NormalizedTicketRecord[] {
  const ticketTypeByEventAndName = new Map<string, string>();

  for (const event of events) {
    for (const ticketType of event.ticketTypes) {
      ticketTypeByEventAndName.set(`${event.id}:${ticketType.name.toLowerCase()}`, ticketType.id);
    }
  }

  return raw.map((ticket) => ({
    tokenId: ticket.id,
    eventId: ticket.eventId,
    ticketTypeId: ticketTypeByEventAndName.get(`${ticket.eventId}:${ticket.tierName.toLowerCase()}`) ?? "unknown",
    ownerUserId: "imported-user",
    seatInfo: ticket.tierName,
    reservationId: `res_${ticket.id}`,
    createdAt: new Date(ticket.purchaseDate).toISOString(),
    state: normalizeTicketState(ticket.status)
  }));
}

export function toNormalizedListings(
  raw: RawFigmaDataset["resaleListings"],
  tickets: NormalizedTicketRecord[],
  events: NormalizedEventDetail[]
): NormalizedMarketplaceListing[] {
  const ticketById = new Map(tickets.map((ticket) => [ticket.tokenId, ticket]));
  const eventById = new Map(events.map((event) => [event.id, event]));

  const output: NormalizedMarketplaceListing[] = [];

  for (const listing of raw) {
    const ticket = ticketById.get(listing.ticketId);
    if (!ticket) {
      continue;
    }

    const event = eventById.get(ticket.eventId);
    if (!event) {
      continue;
    }

    const fallbackPrice = event.ticketTypes.find((item) => item.id === ticket.ticketTypeId)?.price ?? listing.askPrice;

    output.push({
      id: listing.id,
      tokenId: listing.ticketId,
      eventId: ticket.eventId,
      sellerUserId: listing.sellerId,
      sellerWalletAddress: `0ximported-${listing.sellerId}`,
      originalPrice: fallbackPrice,
      askPrice: listing.askPrice,
      currency: "VND",
      status: normalizeListingStatus(listing.status),
      eventStartAt: event.startAt,
      expiresAt: new Date(listing.expiresAt).toISOString(),
      resaleCount: 1,
      createdAt: new Date(listing.createdAt).toISOString(),
      updatedAt: new Date(listing.createdAt).toISOString()
    });
  }

  return output;
}

export function toNormalizedDisputes(raw: RawFigmaDataset["disputes"]): NormalizedDisputeSummary[] {
  return raw.map((dispute) => ({
    id: dispute.id,
    ticketTokenId: dispute.ticketId,
    reporterId: dispute.reporterId,
    reporterType: dispute.reporterType,
    type: dispute.type,
    status: normalizeDisputeStatus(dispute.status),
    priority: dispute.priority,
    amount: typeof dispute.amount === "number" ? dispute.amount : null,
    createdAt: new Date(dispute.createdAt).toISOString(),
    updatedAt: new Date(dispute.updatedAt).toISOString()
  }));
}

export function normalizeFigmaUiDataset(raw: RawFigmaDataset): NormalizedUiDataset {
  const events = toNormalizedEvents(raw.events);
  const tickets = toNormalizedTickets(raw.tickets, events);
  const marketplaceListings = toNormalizedListings(raw.resaleListings, tickets, events);
  const disputes = toNormalizedDisputes(raw.disputes);

  return {
    events,
    tickets,
    marketplaceListings,
    disputes
  };
}
