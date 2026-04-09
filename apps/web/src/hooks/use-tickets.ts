import { useQuery } from "@tanstack/react-query";
import type { TicketCardView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { splitTicketsByEventTime, toTicketCardView } from "@/lib/adapters";
import { getSessionUserId } from "@/lib/session";

export function useMyTickets() {
  const client = useApiClient();
  const userId = getSessionUserId();

  return useQuery({
    queryKey: ["tickets", "me", userId],
    queryFn: async (): Promise<{ upcoming: TicketCardView[]; past: TicketCardView[] }> => {
      const ticketsResponse = await client.getMyTickets(userId);
      const eventIds = Array.from(new Set(ticketsResponse.data.map((item) => item.eventId)));
      const eventDetails = await Promise.all(eventIds.map((id) => client.getEvent(id)));
      const eventMap = new Map(eventDetails.map((item) => [item.data.id, item.data]));
      const cards = ticketsResponse.data.map((ticket) =>
        toTicketCardView(ticket, eventMap.get(ticket.eventId))
      );
      return splitTicketsByEventTime(cards, eventMap, ticketsResponse.data);
    }
  });
}
