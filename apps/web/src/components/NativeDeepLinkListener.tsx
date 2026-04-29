import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { configureEntrNativeDeepLinks } from "@/lib/nativeDeepLinks";
import { bootstrapNativeWalletFromHandoff } from "@/lib/nativeOnboardingHandoff";
import { useApiClient } from "@/providers/AppProviders";

const NativeDeepLinkListener = () => {
  const navigate = useNavigate();
  const client = useApiClient();

  useEffect(() => {
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
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [client, navigate]);

  return null;
};

export default NativeDeepLinkListener;
