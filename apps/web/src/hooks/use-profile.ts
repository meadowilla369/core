import { useQuery } from "@tanstack/react-query";
import type { ProfileSummaryView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { toProfileSummaryView } from "@/lib/adapters";
import { getSessionUserId } from "@/lib/session";

export function useProfileSummary() {
  const client = useApiClient();
  const userId = getSessionUserId();

  return useQuery({
    queryKey: ["profile", "summary", userId],
    queryFn: async (): Promise<ProfileSummaryView> => {
      const [profileResponse, ticketsResponse] = await Promise.all([
        client.getMyProfile(userId),
        client.getMyTickets(userId)
      ]);
      const eventIds = Array.from(new Set(ticketsResponse.data.map((item) => item.eventId)));
      const eventDetails = await Promise.all(eventIds.map((id) => client.getEvent(id)));
      return toProfileSummaryView(
        profileResponse.data,
        ticketsResponse.data,
        eventDetails.map((item) => item.data)
      );
    }
  });
}
