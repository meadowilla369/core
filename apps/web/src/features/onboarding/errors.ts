import { ApiClientError } from "@ticket-platform/sdk-client";

import type { OnboardingErrorState } from "./types";

export function normalizeOnboardingError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
): OnboardingErrorState {
  if (error instanceof ApiClientError && error.payload && typeof error.payload === "object") {
    const payload = error.payload as { error?: { code?: string; message?: string } };
    if (payload.error?.code || payload.error?.message) {
      return {
        code: payload.error?.code ?? fallbackCode,
        message: payload.error?.message ?? fallbackMessage
      };
    }
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message || fallbackMessage
    };
  }

  return {
    code: fallbackCode,
    message: fallbackMessage
  };
}
