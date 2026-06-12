import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

import {
  clearAuthTokens,
  clearOnboardingDraft,
  loadPersistedSessionSnapshot
} from "@/features/onboarding/storage";
import { clearPurchasedTicketMetadata } from "@/lib/synced-tickets";
import { useApiClient } from "@/providers/AppProviders";

export function useLogout() {
  const client = useApiClient();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const snapshot = loadPersistedSessionSnapshot();
      if (snapshot?.userId && snapshot.sessionId) {
        // Best-effort revoke — don't block local cleanup on network failure
        await client.revokeSession(snapshot.sessionId, { userId: snapshot.userId }).catch(() => {});
      }
    } finally {
      clearAuthTokens();
      clearOnboardingDraft();
      clearPurchasedTicketMetadata();

      if (Capacitor.isNativePlatform()) {
        navigate("/onboarding", { replace: true });
      } else {
        // Web: redirect to onboarding then reload so all in-memory state is cleared
        navigate("/onboarding", { replace: true });
        window.location.reload();
      }
    }
  };

  return { logout, isLoggingOut };
}
