import { useQuery } from "@tanstack/react-query";
import type { ProfileSummaryView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { getSessionUserId, getSessionWalletAddress } from "@/lib/session";
import { loadProfileSummary } from "@/lib/profile-summary-loader";

export function useProfileSummary() {
  const client = useApiClient();
  const userId = getSessionUserId();
  const walletAddress = getSessionWalletAddress();

  return useQuery({
    queryKey: ["profile", "summary", userId, walletAddress],
    queryFn: async (): Promise<ProfileSummaryView> =>
      loadProfileSummary({ client, userId, walletAddress })
  });
}
