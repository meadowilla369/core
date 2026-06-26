import type {
  ApiSuccessResponse,
  ContractSyncedTokenData,
  EventDetail,
  MarketplaceListing
} from "@ticket-platform/sdk-client";
import { toTicketCardView } from "./adapters.ts";
import { formatMediumEventDate, formatTime, isFutureIso } from "./format.ts";
import {
  loadPurchasedTicketMetadata,
  mergeTicketRecords,
  type MergedTicketRecord,
  type PurchasedTicketMetadata
} from "./synced-tickets.ts";

interface TicketClient {
  listSyncedTokens(query: {
    ownerWalletAddress?: string;
  }): Promise<ApiSuccessResponse<ContractSyncedTokenData[]>>;
  getEvent(id: string): Promise<ApiSuccessResponse<EventDetail>>;
  listMarketplaceListings(query: {
    sellerUserId?: string;
  }): Promise<ApiSuccessResponse<MarketplaceListing[]>>;
}

export interface LoadedTicketCards {
  upcoming: TicketOwnershipView[];
  past: TicketOwnershipView[];
  tickets: TicketOwnershipView[];
  status: "ready" | "partial";
}

export type TicketDataSource = "ticketing" | "contract-sync" | "local-cache";
export type TicketSyncStatus = "ready" | "syncing" | "partial";

export interface TicketOwnershipView {
  id: string;
  tokenId: string;
  eventId: string;
  eventName: string;
  date: string;
  time: string;
  location: string;
  ticketType: string;
  qrCode?: string;
  ownerUserId: string;
  ownerWalletAddress: string | null;
  seatInfo: string;
  reservationId: string;
  createdAt: string;
  source: TicketDataSource;
  syncStatus: TicketSyncStatus;
  transactionHash?: string;
  listingStatus: "none" | "active" | "cancelled" | "completed";
  isUsed: boolean;
  originalPrice?: number;
  /** Populated only when listingStatus === "active" */
  askPrice?: number;
  onChainListingId?: number | null;
  listingId?: string;
}

export function findTicketByTokenId(
  tickets: TicketOwnershipView[],
  tokenId: string
): TicketOwnershipView | null {
  return tickets.find((ticket) => ticket.tokenId === tokenId || ticket.id === tokenId) ?? null;
}

function toTicketOwnershipView(
  ticket: MergedTicketRecord,
  event: EventDetail | undefined,
  syncStatus: TicketSyncStatus
): TicketOwnershipView {
  const card = toTicketCardView(ticket, event);
  return {
    ...card,
    date: event ? card.date : "Đang cập nhật",
    id: ticket.tokenId,
    tokenId: ticket.tokenId,
    eventId: ticket.eventId,
    ownerUserId: ticket.ownerUserId,
    ownerWalletAddress: ticket.ownerWalletAddress,
    seatInfo: ticket.seatInfo,
    reservationId: ticket.reservationId,
    createdAt: ticket.createdAt,
    source: ticket.source,
    syncStatus,
    transactionHash: ticket.transactionHash,
    listingStatus: ticket.listingStatus,
    isUsed: ticket.isUsed,
    originalPrice: ticket.originalPrice
  };
}

function toListedTicketView(
  listing: MarketplaceListing,
  event: EventDetail | undefined
): TicketOwnershipView {
  return {
    id: listing.tokenId,
    tokenId: listing.tokenId,
    eventId: listing.eventId,
    eventName: event?.title ?? listing.eventId,
    date: event ? formatMediumEventDate(event.startAt) : "Đang cập nhật",
    time: event ? formatTime(event.startAt) : "--:--",
    location: event ? `${event.venue}, ${event.city}` : "—",
    ticketType: event?.ticketTypes[0]?.name ?? "Resale",
    ownerUserId: listing.sellerUserId,
    ownerWalletAddress: listing.sellerWalletAddress,
    seatInfo: "Đang bán lại",
    reservationId: listing.id,
    createdAt: listing.createdAt,
    source: "contract-sync",
    syncStatus: "ready",
    listingStatus: "active",
    isUsed: false,
    originalPrice: listing.originalPrice,
    askPrice: listing.askPrice,
    onChainListingId: listing.onChainListingId ?? null,
    listingId: listing.id
  };
}

function splitOwnershipTicketsByEventTime(
  tickets: TicketOwnershipView[],
  eventMap: Map<string, EventDetail>
): { upcoming: TicketOwnershipView[]; past: TicketOwnershipView[] } {
  return tickets.reduce(
    (acc, ticket) => {
      const event = eventMap.get(ticket.eventId);
      if (!event || isFutureIso(event.startAt)) {
        acc.upcoming.push(ticket);
      } else {
        acc.past.push(ticket);
      }
      return acc;
    },
    { upcoming: [] as TicketOwnershipView[], past: [] as TicketOwnershipView[] }
  );
}

export async function loadMyTicketCards(input: {
  client: TicketClient;
  userId: string;
  walletAddress: string;
  cachedTickets?: PurchasedTicketMetadata[];
}): Promise<LoadedTicketCards> {
  const [syncedTokensResponse, listingsResponse] = await Promise.allSettled([
    input.client.listSyncedTokens({ ownerWalletAddress: input.walletAddress }),
    input.client.listMarketplaceListings({ sellerUserId: input.userId })
  ]);

  const syncedTokens =
    syncedTokensResponse.status === "fulfilled" ? syncedTokensResponse.value.data : [];
  const activeListings =
    listingsResponse.status === "fulfilled"
      ? listingsResponse.value.data.filter(
          (l) => l.listingStatus !== "cancelled" && l.listingStatus !== "completed"
        )
      : [];
  const cachedTickets = input.cachedTickets ?? loadPurchasedTicketMetadata();

  if (syncedTokensResponse.status === "rejected" && cachedTickets.length === 0) {
    throw syncedTokensResponse.reason;
  }

  const mergedTickets = mergeTicketRecords({
    syncedTokens,
    cachedTickets,
    userId: input.userId,
    walletAddress: input.walletAddress
  });

  // Collect all eventIds from both owned and listed tickets
  const listedTokenIds = new Set(activeListings.map((l) => l.tokenId));
  const ownedTickets = mergedTickets.filter((t) => !listedTokenIds.has(t.tokenId));
  const allEventIds = Array.from(
    new Set([
      ...ownedTickets.map((t) => t.eventId),
      ...activeListings.map((l) => l.eventId)
    ])
  );

  const eventDetails = await Promise.allSettled(
    allEventIds.map((id) => input.client.getEvent(id))
  );
  const eventMap = new Map(
    eventDetails.flatMap((item) =>
      item.status === "fulfilled" ? [[item.value.data.id, item.value.data]] : []
    )
  );

  const hasPartialSource =
    syncedTokensResponse.status === "rejected" ||
    eventDetails.some((item) => item.status === "rejected");
  const syncStatus = hasPartialSource ? "partial" : "ready";

  const ownedViews = ownedTickets.map((ticket) =>
    toTicketOwnershipView(ticket, eventMap.get(ticket.eventId), syncStatus)
  );
  const listedViews = activeListings.map((listing) =>
    toListedTicketView(listing, eventMap.get(listing.eventId))
  );

  const allTickets = [...ownedViews, ...listedViews];
  const split = splitOwnershipTicketsByEventTime(allTickets, eventMap);

  return {
    ...split,
    tickets: allTickets,
    status: hasPartialSource ? "partial" : "ready"
  };
}
