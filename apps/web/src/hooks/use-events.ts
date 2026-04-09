import { useQuery } from "@tanstack/react-query";
import type { EventCardView, EventDetailView, TicketTierView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { toEventCardView, toEventDetailView, toTicketTierViews } from "@/lib/adapters";

export function useEventCatalog() {
  const client = useApiClient();

  return useQuery({
    queryKey: ["events", "catalog"],
    queryFn: async (): Promise<EventCardView[]> => {
      const response = await client.listEvents({ status: "active" });
      const details = await Promise.all(response.data.map((event) => client.getEvent(event.id)));
      return details.map((item) => toEventCardView(item.data, item.data));
    }
  });
}

export function useEventDetail(eventId?: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: ["events", "detail", eventId],
    enabled: Boolean(eventId),
    queryFn: async (): Promise<{ event: EventDetailView; tiers: TicketTierView[] }> => {
      const response = await client.getEvent(eventId as string);
      return {
        event: toEventDetailView(response.data),
        tiers: toTicketTierViews(response.data)
      };
    }
  });
}
