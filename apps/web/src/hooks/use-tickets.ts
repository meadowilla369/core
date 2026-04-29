import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/providers/AppProviders";
import { getSessionUserId, getSessionWalletAddress } from "@/lib/session";
import { loadMyTicketCards, type LoadedTicketCards } from "@/lib/ticket-loader";

export function useMyTickets() {
  const client = useApiClient();
  const userId = getSessionUserId();
  const walletAddress = getSessionWalletAddress();

  return useQuery({
    queryKey: ["tickets", "me", userId, walletAddress],
    queryFn: async (): Promise<LoadedTicketCards> =>
      loadMyTicketCards({ client, userId, walletAddress })
  });
}
