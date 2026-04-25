import type {
  OnboardingAction,
  OnboardingAuthSession,
  OnboardingState,
  PersistedSessionSnapshot
} from "./types";

function toAuthSession(
  payload: Extract<OnboardingAction, { type: "OTP_VERIFIED" }>["payload"]
): OnboardingAuthSession {
  return {
    userId: payload.userId,
    sessionId: payload.sessionId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessTokenExpiresAt: payload.accessTokenExpiresAt,
    refreshTokenExpiresAt: payload.refreshTokenExpiresAt
  };
}

export function createInitialOnboardingState(): OnboardingState {
  return {
    stage: "phone_entry",
    phone: "",
    requestId: null,
    auth: null,
    wallet: null,
    prefund: null,
    error: null
  };
}

export function reduceOnboardingState(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case "RESET":
      return createInitialOnboardingState();
    case "OTP_REQUESTED":
      return {
        ...state,
        stage: "otp_requested",
        phone: action.payload.phone,
        requestId: action.payload.requestId,
        error: null
      };
    case "OTP_VERIFYING":
      return {
        ...state,
        stage: "otp_verifying",
        phone: action.payload.phone,
        requestId: action.payload.requestId,
        error: null
      };
    case "OTP_VERIFIED":
      return {
        ...state,
        stage: "otp_verified",
        phone: action.payload.phone,
        requestId: action.payload.requestId,
        auth: toAuthSession(action.payload),
        error: null
      };
    case "WALLET_GENERATING":
      return {
        ...state,
        stage: "wallet_generating",
        error: null
      };
    case "WALLET_REGISTERING":
      return {
        ...state,
        stage: "wallet_registering",
        wallet: action.payload,
        error: null
      };
    case "PREFUND_PENDING":
      return {
        ...state,
        stage: "prefund_pending",
        prefund: action.payload,
        error: null
      };
    case "PREFUND_CONFIRMED":
      return {
        ...state,
        stage: "prefund_confirmed",
        prefund: action.payload,
        error: null
      };
    case "READY":
      return {
        ...state,
        stage: "ready",
        wallet: action.payload.wallet,
        prefund: action.payload.prefund,
        error: null
      };
    case "FAILED":
      return {
        ...state,
        error: action.payload
      };
    default:
      return state;
  }
}

export function shouldResumeFromStorage(
  state: OnboardingState | null | undefined
): OnboardingState {
  if (!state) {
    return createInitialOnboardingState();
  }

  switch (state.stage) {
    case "otp_requested":
    case "otp_verifying":
      return state.phone && state.requestId ? state : createInitialOnboardingState();
    case "otp_verified":
      return state.phone && state.requestId && state.auth ? state : createInitialOnboardingState();
    case "wallet_generating":
    case "wallet_registering":
      return state.auth ? state : createInitialOnboardingState();
    case "prefund_pending":
    case "prefund_confirmed":
      if (!state.auth || !state.wallet) {
        return createInitialOnboardingState();
      }

      if (state.prefund?.funded) {
        return {
          ...state,
          stage: "ready"
        };
      }

      return state;
    case "ready":
      return state.auth && state.wallet && state.prefund?.funded
        ? state
        : createInitialOnboardingState();
    case "phone_entry":
    default:
      return createInitialOnboardingState();
  }
}

export function toPersistedSessionSnapshot(
  state: OnboardingState
): PersistedSessionSnapshot | null {
  if (!state.auth || !state.wallet) {
    return null;
  }

  return {
    userId: state.auth.userId,
    walletAddress: state.wallet.walletAddress,
    privateKey: state.wallet.privateKey,
    phone: state.phone,
    accessToken: state.auth.accessToken,
    refreshToken: state.auth.refreshToken,
    accessTokenExpiresAt: state.auth.accessTokenExpiresAt,
    refreshTokenExpiresAt: state.auth.refreshTokenExpiresAt
  };
}
