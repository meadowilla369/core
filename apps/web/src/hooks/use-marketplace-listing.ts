import { useQuery } from "@tanstack/react-query";
import type { EventDetail, MarketplaceListing } from "@ticket-platform/sdk-client";
import { useApiClient } from "@/providers/AppProviders";

export interface MarketplaceListingDetail {
  listing: MarketplaceListing;
  event?: EventDetail;
}

export function useMarketplaceListing(listingId?: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: ["marketplace", "listing", listingId],
    enabled: Boolean(listingId),
    queryFn: async (): Promise<MarketplaceListingDetail> => {
      const listingsResponse = await client.listMarketplaceListings();
      const listing = listingsResponse.data.find((item) => item.id === listingId);

      if (!listing) {
        throw new Error("Listing not found");
      }

      try {
        const eventResponse = await client.getEvent(listing.eventId);
        return { listing, event: eventResponse.data };
      } catch {
        return { listing };
      }
    }
  });
}
