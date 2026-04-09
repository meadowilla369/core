import { useQuery } from "@tanstack/react-query";
import type { MarketplaceEventView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { toMarketplaceEventViews } from "@/lib/adapters";

export function useMarketplaceEvents() {
  const client = useApiClient();

  return useQuery({
    queryKey: ["marketplace", "events"],
    queryFn: async (): Promise<MarketplaceEventView[]> => {
      const listingsResponse = await client.listMarketplaceListings({ status: "active" });
      const eventIds = Array.from(new Set(listingsResponse.data.map((item) => item.eventId)));
      const eventDetails = await Promise.all(eventIds.map((id) => client.getEvent(id)));
      const eventMap = new Map(eventDetails.map((item) => [item.data.id, item.data]));
      return toMarketplaceEventViews(listingsResponse.data, eventMap);
    }
  });
}
