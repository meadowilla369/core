import { useQuery } from "@tanstack/react-query";
import type { ProfileSummaryView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { toProfileSummaryView } from "@/lib/adapters";
import { getSessionUserId, getSessionWalletAddress } from "@/lib/session";
import { toSyncedTicketRecord } from "@/lib/synced-tickets";

export function useProfileSummary() {
  const client = useApiClient();
  const userId = getSessionUserId();
  const walletAddress = getSessionWalletAddress();

  return useQuery({
    queryKey: ["profile", "summary", userId, walletAddress],
    queryFn: async (): Promise<ProfileSummaryView> => {
      const [profileResponse, ticketsResponse, syncedTokensResponse] = await Promise.all([
        client.getMyProfile(userId),
        client.getMyTickets(userId),
        client.listSyncedTokens({ ownerWalletAddress: walletAddress })
      ]);
      const syncedTickets = syncedTokensResponse.data
        .filter((token) => !token.isRefunded)
        .map((token) => toSyncedTicketRecord(token, userId))
        .filter((ticket): ticket is NonNullable<typeof ticket> => Boolean(ticket));

      const knownTokenIds = new Set(ticketsResponse.data.map((ticket) => ticket.tokenId));
      const mergedTickets = [
        ...ticketsResponse.data,
        ...syncedTickets.filter((ticket) => !knownTokenIds.has(ticket.tokenId))
      ];

      const eventIds = Array.from(new Set(mergedTickets.map((item) => item.eventId)));
      const eventDetails = await Promise.all(eventIds.map((id) => client.getEvent(id)));
      return toProfileSummaryView(
        profileResponse.data,
        mergedTickets,
        eventDetails.map((item) => item.data)
      );
    }
  });
}
