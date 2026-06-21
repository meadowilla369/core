import type {
  ApiSuccessResponse,
  ContractSyncedTokenData,
  EventDetail,
  UserProfileData
} from "@ticket-platform/sdk-client";
import type { ProfileSummaryView } from "@ticket-platform/shared-types";

import { toProfileSummaryView } from "./adapters.ts";
import {
  loadPurchasedTicketMetadata,
  mergeTicketRecords,
  type PurchasedTicketMetadata
} from "./synced-tickets.ts";

export interface ProfileSummaryClient {
  getMyProfile(userId: string): Promise<ApiSuccessResponse<UserProfileData>>;
  listSyncedTokens(query: {
    ownerWalletAddress?: string;
  }): Promise<ApiSuccessResponse<ContractSyncedTokenData[]>>;
  getEvent(eventId: string): Promise<ApiSuccessResponse<EventDetail>>;
}

export async function loadProfileSummary(input: {
  client: ProfileSummaryClient;
  userId: string;
  walletAddress: string;
  cachedTickets?: PurchasedTicketMetadata[];
}): Promise<ProfileSummaryView> {
  const [profileResponse, syncedTokensResponse] = await Promise.all([
    input.client.getMyProfile(input.userId),
    input.client.listSyncedTokens({ ownerWalletAddress: input.walletAddress }).catch(() => null)
  ]);

  const syncedTokens = syncedTokensResponse?.data ?? [];
  const cachedTickets = input.cachedTickets ?? loadPurchasedTicketMetadata();
  const mergedTickets = mergeTicketRecords({
    syncedTokens,
    cachedTickets,
    userId: input.userId,
    walletAddress: input.walletAddress
  });
  const eventIds = Array.from(new Set(mergedTickets.map((item) => item.eventId)));
  const eventDetails = await Promise.allSettled(eventIds.map((id) => input.client.getEvent(id)));
  const events = eventDetails.flatMap((item) =>
    item.status === "fulfilled" ? [item.value.data] : []
  );

  return toProfileSummaryView(profileResponse.data, mergedTickets, events);
}
