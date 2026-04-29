import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProfileSummaryView } from "@ticket-platform/shared-types";
import { useApiClient } from "@/providers/AppProviders";
import { getSessionUserId, getSessionWalletAddress } from "@/lib/session";
import { loadProfileSummary } from "@/lib/profile-summary-loader";
import {
  loadProfileCustomization,
  saveProfileCustomization,
  type ProfileCustomization
} from "@/lib/profile-customization";

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

export function useProfileCustomization() {
  const [customization, setCustomizationState] = useState<ProfileCustomization>(() =>
    loadProfileCustomization()
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "entr:profile-customization:v1") {
        setCustomizationState(loadProfileCustomization());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setCustomization = useCallback((next: ProfileCustomization) => {
    const normalized = saveProfileCustomization(next);
    setCustomizationState(normalized);
    return normalized;
  }, []);

  return {
    customization,
    setCustomization
  };
}
