import type {
  ApiSuccessResponse,
  ContractSyncedTokenData,
  EventDetail,
  TicketRecord
} from "@ticket-platform/sdk-client";
import type { TicketCardView } from "@ticket-platform/shared-types";
import { splitTicketsByEventTime, toTicketCardView } from "./adapters.ts";
import {
  loadPurchasedTicketMetadata,
  mergeTicketRecords,
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
  upcoming: TicketCardView[];
  past: TicketCardView[];
  status: "ready" | "partial";
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
  const cards = mergedTickets.map((ticket) =>
    toTicketCardView(ticket, eventMap.get(ticket.eventId))
  );
  const split = splitTicketsByEventTime(cards, eventMap, mergedTickets);
  const hasPartialSource =
    ticketsResponse.status === "rejected" ||
    syncedTokensResponse.status === "rejected" ||
    eventDetails.some((item) => item.status === "rejected");

  return {
    ...split,
    status: hasPartialSource ? "partial" : "ready"
  };
}
