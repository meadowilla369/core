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
        eyebrow: "Xin chào",
        title: "Đăng nhập bằng số điện thoại",
        description:
          "Số điện thoại là điểm khởi tạo cho đăng nhập, khôi phục và chống tạo tài khoản lập.",
        stageLabel: "Bước 1/5",
        progressValue: 18,
        trustBadges: ["Phone OTP", "Real session"],
        timeline: [],
        availableHelp: ["why-phone"],
        availableErrors: [],
        primaryActionLabel: "Nhận mã OTP"
      };
    case "otp_requested":
    case "otp_verifying":
      return {
        screen: "otp_verify",
        eyebrow: "Verify",
        title: "Nhập mã OTP",
        description:
          "Trong local dev, mã OTP được backend trả về để team test lượng xác minh mà không cần SMS vendor.",
        stageLabel: "Bước 2/5",
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
        primaryActionLabel: state.stage === "otp_verifying" ? "Đang xác minh" : "Xác minh OTP",
        secondaryActionLabel: "Gửi lại mã"
      };
    case "otp_verified":
      return {
        screen: "wallet_bootstrap",
        eyebrow: "Handoff an toàn ",
        title: "Mở app Entr để tạo ví an toàn",
        description:
          "Số điện thoại đã xác minh. App sẽ nhận handoff token dùng một lần, tự tạo ví local và đăng ký prefund mà không đưa private key qua Safari.",
        stageLabel: "Bước 3/5",
        progressValue: 62,
        trustBadges: ["One-time token", "No private key in URL"],
        timeline: [
          { label: "Phone verified", status: "done" },
          { label: "Open Entr app", status: "current" },
          { label: "Generate wallet inside app", status: "upcoming" }
        ],
        availableHelp: ["what-is-wallet"],
        availableErrors: state.error ? ["bootstrap-failed"] : [],
        primaryActionLabel: "Vào app"
      };
    case "wallet_generating":
    case "wallet_registering":
      return {
        screen: "wallet_bootstrap",
        eyebrow: "Invisible Wallet",
        title: "Khởi tạo ví cho giao dịch đầu tiên",
        description:
          "Người dùng không cần tự cấu hình wallet. Ứng dụng tạo ví local, đăng ký backend và chuẩn bị cho giao dịch ticket.",
        stageLabel: "Bước 3/5",
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
        primaryActionLabel: "Tiếp tục khởi tạo"
      };
    case "prefund_pending":
    case "prefund_confirmed":
      return {
        screen: "prefund_pending",
        eyebrow: "Bootstrap Gas",
        title: "Đang cấp gas khởi tạo",
        description:
          "Hệ thống xử lý prefund một lần trên localchain để giao dịch ticket đầu tiên có thể chạy trơn tru.",
        stageLabel: "Bước 4/5",
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
        primaryActionLabel: state.prefund?.funded ? "Hoàn tất prefund" : "Đang chờ xác nhận",
        secondaryActionLabel: state.error ? "Mở retry" : undefined
      };
    case "ready":
      return {
        screen: "ready",
        eyebrow: "Wallet Ready",
        title: "Tài khoản đã sẵn sàng cho giao dịch đầu tiên",
        description:
          "Session, wallet và gas khởi tạo đã có. Người dùng có thể vào app mà không cần thao tác crypto thủ công.",
        stageLabel: "Bước 5/5",
        progressValue: 100,
        trustBadges: ["Session active", "Wallet funded", "Ready to explore"],
        timeline: [
          { label: "Phone verified", status: "done" },
          { label: "Wallet registered", status: "done" },
          { label: "Prefund confirmed", status: "done" }
        ],
        availableHelp: [],
        availableErrors: [],
        primaryActionLabel: "Vào app"
      };
    default:
      return {
        screen: "phone_entry",
        eyebrow: "Flow 0",
        title: "Đăng nhập bằng số điện thoại",
        description: "Bắt đầu lại onboarding.",
        stageLabel: "Bước 1/5",
        progressValue: 18,
        trustBadges: ["Phone OTP"],
        timeline: [],
        availableHelp: ["why-phone"],
        availableErrors: [],
        primaryActionLabel: "Nhận mã OTP"
      };
  }
}
