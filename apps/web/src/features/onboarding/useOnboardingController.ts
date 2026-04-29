import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@ticket-platform/shared-ui";

import {
  clearPersistedSessionSnapshot,
  loadOnboardingDraft,
  saveOnboardingDraft,
  savePersistedSessionSnapshot
} from "./storage";
import {
  createInitialOnboardingState,
  reduceOnboardingState,
  shouldResumeFromStorage,
  toPersistedSessionSnapshot
} from "./machine";
import { createLocalWallet } from "./wallet";
import { normalizeOnboardingError } from "./errors";
import { buildOnboardingViewModel } from "./view-model";
import type {
  OnboardingAuthSession,
  OnboardingPrefundState,
  OnboardingState,
  OnboardingWalletDraft
} from "./types";
import { webAppConfig } from "@/lib/config";
import { useApiClient } from "@/providers/AppProviders";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getInitialState() {
  return shouldResumeFromStorage(loadOnboardingDraft()) ?? createInitialOnboardingState();
}

export function useOnboardingController() {
  const client = useApiClient();
  const [state, setState] = useState<OnboardingState>(getInitialState);
  const [phoneInput, setPhoneInput] = useState(() => loadOnboardingDraft()?.phone ?? "");
  const [otpInput, setOtpInput] = useState("");
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  useEffect(() => {
    saveOnboardingDraft(state);
  }, [state]);

  useEffect(() => {
    const snapshot = toPersistedSessionSnapshot(state);

    if (snapshot) {
      savePersistedSessionSnapshot(snapshot);
      return;
    }

    if (state.stage === "phone_entry") {
      clearPersistedSessionSnapshot();
    }
  }, [state]);

  useEffect(() => {
    if (countdownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdownSeconds]);

  async function pollPrefund(walletAddress: string): Promise<OnboardingPrefundState> {
    const deadline = Date.now() + webAppConfig.onboardingPrefundTimeoutMs;

    while (Date.now() <= deadline) {
      const result = await client.getWalletPrefundStatus(walletAddress);

      if (result.data.funded) {
        return {
          funded: true,
          txHash: result.data.txHash
        };
      }

      await sleep(webAppConfig.onboardingPrefundPollIntervalMs);
    }

    throw new Error("Waiting for localchain confirmation");
  }

  async function continueWalletBootstrap(
    auth: OnboardingAuthSession,
    wallet: OnboardingWalletDraft
  ) {
    setState((current) =>
      reduceOnboardingState(current, {
        type: "WALLET_REGISTERING",
        payload: wallet
      })
    );

    const registered = await client.registerPaymentWallet(
      { walletAddress: wallet.walletAddress },
      { userId: auth.userId }
    );

    const prefundState: OnboardingPrefundState = {
      funded: registered.data.prefunded,
      txHash: registered.data.prefundTxHash ?? null
    };

    setState((current) =>
      reduceOnboardingState(current, {
        type: "PREFUND_PENDING",
        payload: prefundState
      })
    );

    if (prefundState.funded) {
      setState((current) =>
        reduceOnboardingState(current, {
          type: "READY",
          payload: {
            wallet,
            prefund: prefundState
          }
        })
      );
      return;
    }

    const fundedState = await pollPrefund(wallet.walletAddress);
    setState((current) =>
      reduceOnboardingState(current, {
        type: "READY",
        payload: {
          wallet,
          prefund: fundedState
        }
      })
    );
  }

  const requestOtpMutation = useMutation({
    mutationFn: async (phone: string) => client.requestOtp({ phone }),
    onSuccess: (result, phone) => {
      setState((current) =>
        reduceOnboardingState(current, {
          type: "OTP_REQUESTED",
          payload: {
            phone,
            requestId: result.data.requestId
          }
        })
      );
      setPhoneInput(phone);
      setOtpInput("");
      setDevOtpCode(result.data.otpCode ?? null);
      setCountdownSeconds(result.data.retryAfter ?? 0);
      toast({
        title: "OTP request da tao",
        description: "Ban co the dung ma dev tu backend de xac minh."
      });
    },
    onError: (error) => {
      setState((current) =>
        reduceOnboardingState(current, {
          type: "FAILED",
          payload: normalizeOnboardingError(
            error,
            "OTP_REQUEST_FAILED",
            "Khong the ket noi backend OTP"
          )
        })
      );
    }
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (otp: string) => {
      const phone = state.phone || phoneInput.trim();
      const requestId = state.requestId;

      if (!phone || !requestId) {
        throw new Error("Missing phone or requestId for OTP verification");
      }

      setState((current) =>
        reduceOnboardingState(current, {
          type: "OTP_VERIFYING",
          payload: {
            phone,
            requestId
          }
        })
      );

      const verified = await client.verifyOtp({
        phone,
        requestId,
        otp,
        deviceId: "web-browser",
        deviceName: "Web browser",
        platform: "web"
      });

      const auth: OnboardingAuthSession = {
        userId: verified.data.userId,
        sessionId: verified.data.sessionId,
        accessToken: verified.data.accessToken,
        refreshToken: verified.data.refreshToken,
        accessTokenExpiresAt: verified.data.accessTokenExpiresAt,
        refreshTokenExpiresAt: verified.data.refreshTokenExpiresAt
      };

      setState((current) =>
        reduceOnboardingState(current, {
          type: "OTP_VERIFIED",
          payload: {
            phone,
            requestId,
            ...auth
          }
        })
      );

      if (!Capacitor.isNativePlatform()) {
        return {
          auth,
          wallet: null
        };
      }

      setState((current) => reduceOnboardingState(current, { type: "WALLET_GENERATING" }));
      const wallet = createLocalWallet();

      await continueWalletBootstrap(auth, wallet);

      return {
        auth,
        wallet
      };
    },
    onSuccess: () => {
      toast({
        title: "Onboarding san sang",
        description: "Wallet da duoc bootstrap va prefund hoan tat."
      });
    },
    onError: (error) => {
      const fallbackCode =
        state.stage === "wallet_generating" || state.stage === "wallet_registering"
          ? "BOOTSTRAP_FAILED"
          : "OTP_EXPIRED";
      const fallbackMessage =
        fallbackCode === "BOOTSTRAP_FAILED"
          ? "Wallet bootstrap that bai"
          : "OTP khong hop le hoac da het han";

      setState((current) =>
        reduceOnboardingState(current, {
          type: "FAILED",
          payload: normalizeOnboardingError(error, fallbackCode, fallbackMessage)
        })
      );
    }
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!state.auth || !state.wallet) {
        throw new Error("Khong co bootstrap state de tiep tuc");
      }

      await continueWalletBootstrap(state.auth, state.wallet);
    },
    onError: (error) => {
      setState((current) =>
        reduceOnboardingState(current, {
          type: "FAILED",
          payload: normalizeOnboardingError(
            error,
            "PREFUND_DELAYED",
            "Waiting for localchain confirmation"
          )
        })
      );
    }
  });

  const view = useMemo(() => buildOnboardingViewModel(state), [state]);

  return {
    state,
    view,
    phoneInput,
    otpInput,
    devOtpCode,
    countdownSeconds,
    isRequestingOtp: requestOtpMutation.isPending,
    isVerifyingOtp: verifyOtpMutation.isPending,
    isRetrying: retryMutation.isPending,
    setPhoneInput,
    setOtpInput,
    submitPhone: () => {
      const phone = phoneInput.trim();
      if (!phone) {
        return;
      }
      requestOtpMutation.mutate(phone);
    },
    resendOtp: () => {
      const phone = state.phone || phoneInput.trim();
      if (!phone) {
        return;
      }
      requestOtpMutation.mutate(phone);
    },
    submitOtp: () => {
      if (otpInput.length !== 6) {
        return;
      }
      verifyOtpMutation.mutate(otpInput);
    },
    retry: () => {
      retryMutation.mutate();
    },
    clearError: () => {
      setState((current) => ({
        ...current,
        error: null
      }));
    }
  };
}
