import type {
  ApiSuccessResponse,
  ContractSyncedTokenData,
  EventDetail,
  TicketRecord
} from "@ticket-platform/sdk-client";
import { toTicketCardView } from "./adapters.ts";
import { isFutureIso } from "./format.ts";
import {
  loadPurchasedTicketMetadata,
  mergeTicketRecords,
  type MergedTicketRecord,
  type PurchasedTicketMetadata
} from "./synced-tickets.ts";

interface TicketClient {
  getMyTickets(userId: string): Promise<ApiSuccessResponse<TicketRecord[]>>;
  listSyncedTokens(query: {
    ownerWalletAddress?: string;
  }): Promise<ApiSuccessResponse<ContractSyncedTokenData[]>>;
  getEvent(id: string): Promise<ApiSuccessResponse<EventDetail>>;
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
}

function toTicketOwnershipView(
  ticket: MergedTicketRecord,
  event: EventDetail | undefined,
  syncStatus: TicketSyncStatus
): TicketOwnershipView {
  const card = toTicketCardView(ticket, event);
  return {
    ...card,
    date: event ? card.date : "Dang cap nhat",
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
    transactionHash: ticket.transactionHash
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
  const [ticketsResponse, syncedTokensResponse] = await Promise.allSettled([
    input.client.getMyTickets(input.userId),
    input.client.listSyncedTokens({ ownerWalletAddress: input.walletAddress })
  ]);

  const ticketingTickets =
    ticketsResponse.status === "fulfilled" ? ticketsResponse.value.data : [];
  const syncedTokens =
    syncedTokensResponse.status === "fulfilled" ? syncedTokensResponse.value.data : [];
  const cachedTickets = input.cachedTickets ?? loadPurchasedTicketMetadata();

  if (
    ticketsResponse.status === "rejected" &&
    syncedTokensResponse.status === "rejected" &&
    cachedTickets.length === 0
  ) {
    throw ticketsResponse.reason;
  }

  const mergedTickets = mergeTicketRecords({
    ticketingTickets,
    syncedTokens,
    cachedTickets,
    userId: input.userId,
    walletAddress: input.walletAddress
  });
  const eventIds = Array.from(new Set(mergedTickets.map((item) => item.eventId)));
  const eventDetails = await Promise.allSettled(eventIds.map((id) => input.client.getEvent(id)));
  const eventMap = new Map(
    eventDetails.flatMap((item) =>
      item.status === "fulfilled" ? [[item.value.data.id, item.value.data]] : []
    )
  );
  const hasPartialSource =
    ticketsResponse.status === "rejected" ||
    syncedTokensResponse.status === "rejected" ||
    eventDetails.some((item) => item.status === "rejected");
  const syncStatus = hasPartialSource ? "partial" : "ready";
  const tickets = mergedTickets.map((ticket) =>
    toTicketOwnershipView(ticket, eventMap.get(ticket.eventId), syncStatus)
  );
  const split = splitOwnershipTicketsByEventTime(tickets, eventMap);

  return {
    ...split,
    tickets,
    status: hasPartialSource ? "partial" : "ready"
  };
}
