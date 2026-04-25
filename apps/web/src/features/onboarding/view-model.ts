import type { OnboardingState } from "./types";

export type OnboardingScreen =
  | "phone_entry"
  | "otp_verify"
  | "wallet_bootstrap"
  | "prefund_pending"
  | "ready";

export type OnboardingTimelineStatus = "done" | "current" | "upcoming";

export type OnboardingHelpSurface = "why-phone" | "otp-help" | "what-is-wallet" | "why-initial-gas";

export type OnboardingErrorSurface =
  | "otp-expired"
  | "rate-limit"
  | "bootstrap-failed"
  | "prefund-retry";

export interface OnboardingTimelineItem {
  label: string;
  status: OnboardingTimelineStatus;
  detail?: string;
}

export interface OnboardingViewModel {
  screen: OnboardingScreen;
  eyebrow: string;
  title: string;
  description: string;
  stageLabel: string;
  progressValue: number;
  trustBadges: string[];
  timeline: OnboardingTimelineItem[];
  availableHelp: OnboardingHelpSurface[];
  availableErrors: OnboardingErrorSurface[];
  primaryActionLabel: string;
  secondaryActionLabel?: string;
}

export function buildOnboardingViewModel(state: OnboardingState): OnboardingViewModel {
  switch (state.stage) {
    case "phone_entry":
      return {
        screen: "phone_entry",
        eyebrow: "Flow 0",
        title: "Dang nhap bang so dien thoai",
        description:
          "So dien thoai la diem khoi tao cho dang nhap, khoi phuc va chong tao tai khoan lap.",
        stageLabel: "Buoc 1/5",
        progressValue: 18,
        trustBadges: ["Phone OTP", "Real session"],
        timeline: [],
        availableHelp: ["why-phone"],
        availableErrors: [],
        primaryActionLabel: "Nhan ma OTP"
      };
    case "otp_requested":
    case "otp_verifying":
      return {
        screen: "otp_verify",
        eyebrow: "Verify",
        title: "Nhap ma OTP dev",
        description:
          "Trong local dev, ma OTP duoc backend tra ve de team test luong xac minh ma khong can SMS vendor.",
        stageLabel: "Buoc 2/5",
        progressValue: 38,
        trustBadges: ["Dev OTP", "Phone verified"],
        timeline: [
          { label: "Phone submitted", status: "done" },
          {
            label: "OTP requested",
            status: "done",
            detail: state.requestId ? `Request ${state.requestId}` : undefined
          },
          {
            label: "Confirming phone ownership",
            status: state.stage === "otp_verifying" ? "current" : "upcoming"
          }
        ],
        availableHelp: ["otp-help"],
        availableErrors: state.error?.code === "OTP_RATE_LIMITED" ? ["rate-limit"] : [],
        primaryActionLabel: state.stage === "otp_verifying" ? "Dang xac minh" : "Xac minh OTP",
        secondaryActionLabel: "Gui lai ma"
      };
    case "otp_verified":
    case "wallet_generating":
    case "wallet_registering":
      return {
        screen: "wallet_bootstrap",
        eyebrow: "Invisible Wallet",
        title: "Khoi tao vi cho giao dich dau tien",
        description:
          "Nguoi dung khong can tu cau hinh wallet. Ung dung tao vi local, dang ky backend va chuan bi cho giao dich ticket.",
        stageLabel: "Buoc 3/5",
        progressValue: 62,
        trustBadges: ["Wallet hidden", "Backend registration"],
        timeline: [
          { label: "Phone verified", status: "done" },
          {
            label: "Generate local wallet",
            status: state.stage === "wallet_generating" ? "current" : "done",
            detail: state.wallet?.walletAddress
          },
          {
            label: "Register wallet with backend",
            status: state.stage === "wallet_registering" ? "current" : "upcoming"
          }
        ],
        availableHelp: ["what-is-wallet"],
        availableErrors: state.error ? ["bootstrap-failed"] : [],
        primaryActionLabel: "Tiep tuc khoi tao"
      };
    case "prefund_pending":
    case "prefund_confirmed":
      return {
        screen: "prefund_pending",
        eyebrow: "Bootstrap Gas",
        title: "Dang cap gas khoi tao",
        description:
          "He thong xu ly prefund mot lan tren localchain de giao dich ticket dau tien co the chay tru tru.",
        stageLabel: "Buoc 4/5",
        progressValue: state.prefund?.funded ? 88 : 80,
        trustBadges: ["One-time prefund", "Localchain confirmation"],
        timeline: [
          { label: "Wallet registered", status: "done" },
          {
            label: "Prefund transaction submitted",
            status: state.prefund?.txHash ? "done" : "current",
            detail: state.prefund?.txHash ?? undefined
          },
          {
            label: "Waiting blockchain confirmation",
            status: state.prefund?.funded ? "done" : "current"
          }
        ],
        availableHelp: ["why-initial-gas"],
        availableErrors: state.error ? ["prefund-retry"] : [],
        primaryActionLabel: state.prefund?.funded ? "Hoan tat prefund" : "Dang cho xac nhan",
        secondaryActionLabel: state.error ? "Mo retry" : undefined
      };
    case "ready":
      return {
        screen: "ready",
        eyebrow: "Wallet Ready",
        title: "Tai khoan da san sang cho giao dich dau tien",
        description:
          "Session, wallet va gas khoi tao da co. Nguoi dung co the vao app ma khong can thao tac crypto thu cong.",
        stageLabel: "Buoc 5/5",
        progressValue: 100,
        trustBadges: ["Session active", "Wallet funded", "Ready to explore"],
        timeline: [
          { label: "Phone verified", status: "done" },
          { label: "Wallet registered", status: "done" },
          { label: "Prefund confirmed", status: "done" }
        ],
        availableHelp: [],
        availableErrors: [],
        primaryActionLabel: "Vao app"
      };
    default:
      return {
        screen: "phone_entry",
        eyebrow: "Flow 0",
        title: "Dang nhap bang so dien thoai",
        description: "Bat dau lai onboarding.",
        stageLabel: "Buoc 1/5",
        progressValue: 18,
        trustBadges: ["Phone OTP"],
        timeline: [],
        availableHelp: ["why-phone"],
        availableErrors: [],
        primaryActionLabel: "Nhan ma OTP"
      };
  }
}
