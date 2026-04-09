import { useQuery } from "@tanstack/react-query";
import type { TicketCardView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { splitTicketsByEventTime, toTicketCardView } from "@/lib/adapters";
import { getSessionUserId, getSessionWalletAddress } from "@/lib/session";
import { toSyncedTicketRecord } from "@/lib/synced-tickets";

export function useMyTickets() {
  const client = useApiClient();
  const userId = getSessionUserId();
  const walletAddress = getSessionWalletAddress();

  return useQuery({
    queryKey: ["tickets", "me", userId, walletAddress],
    queryFn: async (): Promise<{ upcoming: TicketCardView[]; past: TicketCardView[] }> => {
      const [ticketsResponse, syncedTokensResponse] = await Promise.all([
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
      const eventMap = new Map(eventDetails.map((item) => [item.data.id, item.data]));
      const cards = mergedTickets.map((ticket) =>
        toTicketCardView(ticket, eventMap.get(ticket.eventId))
      );
      return splitTicketsByEventTime(cards, eventMap, mergedTickets);
    }
  });
}
