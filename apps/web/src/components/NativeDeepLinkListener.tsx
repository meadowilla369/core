import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

import { configureEntrNativeDeepLinks } from "@/lib/nativeDeepLinks";
import { bootstrapNativeWalletFromHandoff } from "@/lib/nativeOnboardingHandoff";
import { hasValidSession } from "@/features/onboarding/storage";
import { useApiClient } from "@/providers/AppProviders";

const NativeDeepLinkListener = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useApiClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let cleanup: (() => void) | undefined;
    let mounted = true;

    void configureEntrNativeDeepLinks(navigate, async (handoffToken) => {
      await bootstrapNativeWalletFromHandoff(client, handoffToken);
    }).then((removeListener) => {
      if (!mounted) {
        removeListener?.();
        return;
      }

      cleanup = removeListener;

      // Deep link processing done — now check if we actually have a session.
      // If not, send the user to onboarding (unless they're already there).
      if (!hasValidSession() && location.pathname !== "/onboarding") {
        navigate("/onboarding", { replace: true });
      }
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
    // location.pathname intentionally excluded: we only want to run this guard
    // once on mount, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, navigate]);

  return null;
};

export default NativeDeepLinkListener;
