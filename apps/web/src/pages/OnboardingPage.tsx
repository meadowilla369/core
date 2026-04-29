import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";

import BootstrapFailedModal from "@/components/onboarding/BootstrapFailedModal";
import OtpExpiredModal from "@/components/onboarding/OtpExpiredModal";
import OtpHelpModal from "@/components/onboarding/OtpHelpModal";
import OtpVerifyScreen from "@/components/onboarding/OtpVerifyScreen";
import PhoneEntryScreen from "@/components/onboarding/PhoneEntryScreen";
import PrefundPendingScreen from "@/components/onboarding/PrefundPendingScreen";
import PrefundRetrySheet from "@/components/onboarding/PrefundRetrySheet";
import RateLimitModal from "@/components/onboarding/RateLimitModal";
import ReadyScreen from "@/components/onboarding/ReadyScreen";
import WalletBootstrapScreen from "@/components/onboarding/WalletBootstrapScreen";
import WalletReadySheet from "@/components/onboarding/WalletReadySheet";
import WhatIsThisWalletModal from "@/components/onboarding/WhatIsThisWalletModal";
import WhyInitialGasModal from "@/components/onboarding/WhyInitialGasModal";
import WhyPhoneModal from "@/components/onboarding/WhyPhoneModal";
import { useOnboardingController } from "@/features/onboarding/useOnboardingController";
import { openEntrDiscoverApp } from "@/lib/appLinks";
import { useApiClient } from "@/providers/AppProviders";
import type { OnboardingHelpSurface } from "@/features/onboarding/view-model";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const client = useApiClient();
  const controller = useOnboardingController();
  const [activeHelp, setActiveHelp] = useState<OnboardingHelpSurface | null>(null);
  const [prefundRetryOpen, setPrefundRetryOpen] = useState(false);
  const [walletReadyOpen, setWalletReadyOpen] = useState(false);

  useEffect(() => {
    if (controller.state.stage === "ready") {
      setWalletReadyOpen(true);
    }
  }, [controller.state.stage]);

  const errorCode = controller.state.error?.code;
  const prefundError = errorCode === "PREFUND_DELAYED" || errorCode === "PREFUND_RPC_UNAVAILABLE";
  const continueToApp = async () => {
    if (Capacitor.isNativePlatform()) {
      navigate("/discover");
      return;
    }

    if (!controller.state.auth) {
      return;
    }

    const handoff = await client.createOnboardingHandoffToken({
      refreshToken: controller.state.auth.refreshToken
    });
    openEntrDiscoverApp({ handoffToken: handoff.data.handoffToken });
  };

  return (
    <>
      {controller.view.screen === "phone_entry" && (
        <PhoneEntryScreen
          view={controller.view}
          phone={controller.phoneInput}
          onPhoneChange={controller.setPhoneInput}
          onSubmit={controller.submitPhone}
          onWhyPhoneOpen={() => setActiveHelp("why-phone")}
          isSubmitting={controller.isRequestingOtp}
          errorMessage={prefundError ? null : controller.state.error?.message}
        />
      )}

      {controller.view.screen === "otp_verify" && (
        <OtpVerifyScreen
          view={controller.view}
          phone={controller.state.phone || controller.phoneInput}
          otp={controller.otpInput}
          countdownSeconds={controller.countdownSeconds}
          devOtpCode={controller.devOtpCode}
          errorMessage={
            controller.state.error?.code === "OTP_EXPIRED" ? null : controller.state.error?.message
          }
          isSubmitting={controller.isVerifyingOtp}
          onOtpChange={controller.setOtpInput}
          onSubmit={controller.submitOtp}
          onResend={controller.resendOtp}
          onHelpOpen={() => setActiveHelp("otp-help")}
        />
      )}

      {controller.view.screen === "wallet_bootstrap" && (
        <WalletBootstrapScreen
          view={controller.view}
          walletAddress={controller.state.wallet?.walletAddress ?? null}
          isWorking={controller.isVerifyingOtp || controller.isRetrying}
          onExplainWallet={() => setActiveHelp("what-is-wallet")}
          onContinue={controller.state.stage === "otp_verified" ? continueToApp : undefined}
        />
      )}

      {controller.view.screen === "prefund_pending" && (
        <PrefundPendingScreen
          view={controller.view}
          walletAddress={controller.state.wallet?.walletAddress ?? null}
          statusLabel={controller.state.error?.message ?? undefined}
          errorMessage={prefundError ? null : controller.state.error?.message}
          onExplainGas={() => setActiveHelp("why-initial-gas")}
          onRetry={() => setPrefundRetryOpen(true)}
        />
      )}

      {controller.view.screen === "ready" && controller.state.auth && controller.state.wallet && (
        <ReadyScreen
          view={controller.view}
          userId={controller.state.auth.userId}
          walletAddress={controller.state.wallet.walletAddress}
          onContinue={continueToApp}
        />
      )}

      <WhyPhoneModal
        open={activeHelp === "why-phone"}
        onOpenChange={(open) => setActiveHelp(open ? "why-phone" : null)}
      />
      <OtpHelpModal
        open={activeHelp === "otp-help"}
        onOpenChange={(open) => setActiveHelp(open ? "otp-help" : null)}
      />
      <WhatIsThisWalletModal
        open={activeHelp === "what-is-wallet"}
        onOpenChange={(open) => setActiveHelp(open ? "what-is-wallet" : null)}
      />
      <WhyInitialGasModal
        open={activeHelp === "why-initial-gas"}
        onOpenChange={(open) => setActiveHelp(open ? "why-initial-gas" : null)}
      />

      <OtpExpiredModal
        open={errorCode === "OTP_EXPIRED"}
        onOpenChange={(open) => {
          if (!open) {
            controller.clearError();
          }
        }}
        onResend={() => {
          controller.clearError();
          controller.resendOtp();
        }}
      />
      <RateLimitModal
        open={errorCode === "OTP_RATE_LIMITED"}
        onOpenChange={(open) => {
          if (!open) {
            controller.clearError();
          }
        }}
        retryAfterSeconds={controller.countdownSeconds || undefined}
      />
      <BootstrapFailedModal
        open={errorCode === "BOOTSTRAP_FAILED"}
        onOpenChange={(open) => {
          if (!open) {
            controller.clearError();
          }
        }}
        errorMessage={controller.state.error?.message}
        onRetry={() => {
          controller.clearError();
          controller.retry();
        }}
      />
      <PrefundRetrySheet
        open={prefundRetryOpen || prefundError}
        onOpenChange={(open) => {
          setPrefundRetryOpen(open);
          if (!open && prefundError) {
            controller.clearError();
          }
        }}
        statusMessage={controller.state.error?.message}
        onRetry={() => {
          controller.clearError();
          controller.retry();
        }}
      />
      <WalletReadySheet
        open={walletReadyOpen}
        onOpenChange={setWalletReadyOpen}
        walletAddress={controller.state.wallet?.walletAddress}
        onContinue={continueToApp}
      />
    </>
  );
};

export default OnboardingPage;
