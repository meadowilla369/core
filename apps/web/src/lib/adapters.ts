import type {
  EventCardView,
  EventDetailView,
  MarketplaceEventView,
  MarketplaceTicketListingView,
  ProfileSummaryView,
  TicketCardView,
  TicketTierView
} from "@ticket-platform/shared-types";
import type {
  EventDetail,
  EventSummary,
  MarketplaceListing,
  TicketRecord,
  UserProfileData
} from "@ticket-platform/sdk-client";
import {
  formatMediumEventDate,
  formatShortEventDate,
  formatTime,
  formatTimeRange,
  formatVnd,
  getInitials,
  isFutureIso
} from "./format";

const CATEGORY_OVERRIDES: Record<string, string> = {
  evt_rockfest_2026: "Hòa nhạc",
  evt_jazz_night_2026: "Hòa nhạc"
};

function categoryForEvent(eventId: string, title: string): string {
  const override = CATEGORY_OVERRIDES[eventId];
  if (override) {
    return override;
  }

  const lower = title.toLowerCase();
  if (lower.includes("jazz") || lower.includes("rock") || lower.includes("symphony")) {
    return "Hòa nhạc";
  }
  if (lower.includes("slam") || lower.includes("cup")) {
    return "Thể thao";
  }
  return "Sự kiện";
}

function minTicketPrice(ticketTypes: Array<{ price: number }>): number {
  return ticketTypes.reduce((min, item) => Math.min(min, item.price), Number.POSITIVE_INFINITY);
}

export function toEventCardView(
  event: EventSummary | EventDetail,
  detail?: EventDetail
): EventCardView {
  const ticketTypes = detail?.ticketTypes ?? ("ticketTypes" in event ? event.ticketTypes : []);
  const minPrice = ticketTypes.length > 0 ? minTicketPrice(ticketTypes) : 0;

  return {
    id: event.id,
    name: event.title,
    date: formatShortEventDate(event.startAt),
    location: event.city,
    category: categoryForEvent(event.id, event.title),
    price: minPrice > 0 ? formatVnd(minPrice) : "Sắp mở bán"
  };
}

export function toEventDetailView(event: EventDetail): EventDetailView {
  const prices = event.ticketTypes.map((item) => item.price);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const max = prices.length > 0 ? Math.max(...prices) : 0;
  const sold = event.ticketTypes.reduce((total, item) => total + item.soldCount, 0);

  return {
    id: event.id,
    name: event.title,
    category: categoryForEvent(event.id, event.title),
    date: formatMediumEventDate(event.startAt),
    time: formatTimeRange(event.startAt, event.endAt),
    location: event.venue,
    address: `${event.venue}, ${event.city}`,
    price: { min, max },
    description:
      `${event.title} là sự kiện đang mở bán trên core. Thông tin mô tả chi tiết chưa được event-service cung cấp nên giao diện đang hiển thị bản tóm tắt từ dữ liệu runtime.`,
    lineup: [],
    attendees: sold
  };
}

export function toTicketTierViews(event: EventDetail): TicketTierView[] {
  return event.ticketTypes.map((tier) => ({
    name: tier.name,
    price: formatVnd(tier.price),
    perks: [
      `${Math.max(tier.quantity - tier.soldCount, 0)} vé còn lại`,
      `Đã bán ${tier.soldCount}`,
      `Tổng số lượng ${tier.quantity}`
    ]
  }));
}

export function toTicketCardView(ticket: TicketRecord, event?: EventDetail): TicketCardView {
  const tier = event?.ticketTypes.find((item) => item.id === ticket.ticketTypeId);
  return {
    id: ticket.tokenId,
    eventName: event?.title ?? ticket.eventId,
    date: event ? formatMediumEventDate(event.startAt) : "Đang cập nhật",
    time: event ? formatTime(event.startAt) : "--:--",
    location: event ? `${event.venue}, ${event.city}` : ticket.seatInfo,
    ticketType: tier?.name ?? ticket.ticketTypeId,
    qrCode: ticket.tokenId
  };
}

export function splitTicketsByEventTime(
  tickets: TicketCardView[],
  eventMap: Map<string, EventDetail>,
  rawTickets: TicketRecord[]
): { upcoming: TicketCardView[]; past: TicketCardView[] } {
  return tickets.reduce(
    (acc, ticket, index) => {
      const raw = rawTickets[index];
      const event = raw ? eventMap.get(raw.eventId) : undefined;
      if (event && isFutureIso(event.startAt)) {
        acc.upcoming.push(ticket);
      } else {
        acc.past.push(ticket);
      }
      return acc;
    },
    { upcoming: [] as TicketCardView[], past: [] as TicketCardView[] }
  );
}

export function toMarketplaceEventViews(
  listings: MarketplaceListing[],
  eventMap: Map<string, EventDetail>
): MarketplaceEventView[] {
  const groups = new Map<
    string,
    {
      eventName: string;
      listings: MarketplaceTicketListingView[];
      prices: number[];
    }
  >();

  for (const listing of listings) {
    const event = eventMap.get(listing.eventId);
    const key = listing.eventId;
    const current = groups.get(key) ?? {
      eventName: event?.title ?? listing.eventId,
      listings: [],
      prices: []
    };

    current.listings.push({
      id: listing.id,
      tier: event?.ticketTypes.find((item) => item.id === listing.tokenId)?.name ?? "Resale",
      price: formatVnd(listing.askPrice)
    });
    current.prices.push(listing.askPrice);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([eventId, group], index) => {
    const floor = Math.min(...group.prices);
    const avg = Math.round(group.prices.reduce((sum, price) => sum + price, 0) / group.prices.length);
    const dayChange = index % 2 === 0 ? 6.8 : -3.4;

    return {
      id: eventId,
      eventName: group.eventName,
      dayVolume: formatVnd(avg * group.listings.length),
      dayChange,
      floorPrice: formatVnd(floor),
      floorChange: dayChange / 2,
      listings: group.listings.slice(0, 4)
    };
  });
}

export function toProfileSummaryView(
  profile: UserProfileData,
  tickets: TicketRecord[],
  events: EventDetail[]
): ProfileSummaryView {
  const futureCount = tickets.filter((ticket) => {
    const event = events.find((item) => item.id === ticket.eventId);
    return event ? isFutureIso(event.startAt) : false;
  }).length;

  const spend = tickets.reduce((total, ticket) => {
    const event = events.find((item) => item.id === ticket.eventId);
    const tier = event?.ticketTypes.find((item) => item.id === ticket.ticketTypeId);
    return total + (tier?.price ?? 0);
  }, 0);

  return {
    displayName: profile.fullName || "Entr User",
    email: profile.email ?? profile.phoneNumber,
    avatarInitials: getInitials(profile.fullName || profile.phoneNumber),
    attendedEvents: tickets.length,
    upcomingEvents: futureCount,
    spendSummary: spend > 0 ? formatVnd(spend) : "0₫"
  };
}
