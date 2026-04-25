export type OnboardingStage =
  | "phone_entry"
  | "otp_requested"
  | "otp_verifying"
  | "otp_verified"
  | "wallet_generating"
  | "wallet_registering"
  | "prefund_pending"
  | "prefund_confirmed"
  | "ready";

export interface OnboardingAuthSession {
  userId: string;
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface OnboardingWalletDraft {
  walletAddress: `0x${string}` | string;
  privateKey: `0x${string}` | string;
}

export interface OnboardingPrefundState {
  funded: boolean;
  txHash: `0x${string}` | string | null;
}

export interface OnboardingErrorState {
  code: string;
  message: string;
}

export interface OnboardingState {
  stage: OnboardingStage;
  phone: string;
  requestId: string | null;
  auth: OnboardingAuthSession | null;
  wallet: OnboardingWalletDraft | null;
  prefund: OnboardingPrefundState | null;
  error: OnboardingErrorState | null;
}

export interface PersistedSessionSnapshot {
  userId: string;
  walletAddress: `0x${string}` | string;
  privateKey?: `0x${string}` | string;
  phone: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export type OnboardingAction =
  | { type: "RESET" }
  | { type: "OTP_REQUESTED"; payload: { phone: string; requestId: string } }
  | { type: "OTP_VERIFYING"; payload: { phone: string; requestId: string } }
  | {
      type: "OTP_VERIFIED";
      payload: {
        phone: string;
        requestId: string;
        userId: string;
        sessionId: string;
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresAt: string;
        refreshTokenExpiresAt: string;
      };
    }
  | { type: "WALLET_GENERATING" }
  | { type: "WALLET_REGISTERING"; payload: OnboardingWalletDraft }
  | { type: "PREFUND_PENDING"; payload: OnboardingPrefundState }
  | { type: "PREFUND_CONFIRMED"; payload: OnboardingPrefundState }
  | { type: "READY"; payload: { wallet: OnboardingWalletDraft; prefund: OnboardingPrefundState } }
  | { type: "FAILED"; payload: OnboardingErrorState };
