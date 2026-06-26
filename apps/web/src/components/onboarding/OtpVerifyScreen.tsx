import type { FormEvent } from "react";
import { LifeBuoy, TimerReset } from "lucide-react";

import OnboardingShell from "./OnboardingShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { OnboardingViewModel } from "@/features/onboarding/view-model";

interface OtpVerifyScreenProps {
  view: OnboardingViewModel;
  phone: string;
  otp: string;
  countdownSeconds: number;
  devOtpCode?: string | null;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onOtpChange: (value: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onHelpOpen?: () => void;
}

const OtpVerifyScreen = ({
  view,
  phone,
  otp,
  countdownSeconds,
  devOtpCode,
  errorMessage,
  isSubmitting = false,
  onOtpChange,
  onSubmit,
  onResend,
  onHelpOpen
}: OtpVerifyScreenProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <OnboardingShell
      eyebrow={view.eyebrow}
      title={view.title}
      description={view.description}
      stageLabel={view.stageLabel}
      progressValue={view.progressValue}
      trustBadges={view.trustBadges}
      timeline={view.timeline}
      helpActionLabel="OTP help"
      onHelpAction={onHelpOpen}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Phone</p>
          <p className="mt-2 text-base font-medium text-white">{phone}</p>
          {devOtpCode && (
            <p className="mt-2 text-sm text-amber-200">
              Dev OTP: <span className="font-mono">{devOtpCode}</span>
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/52">
            Nhập 6 chữ số
          </p>
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={onOtpChange}
            containerClassName="justify-between"
            className="w-full"
          >
            <InputOTPGroup className="w-full justify-between gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.05] text-lg text-white first:rounded-2xl first:border-l last:rounded-2xl"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
          <div className="flex items-center gap-2">
            <TimerReset className="h-4 w-4 text-amber-300" />
            <span>Còn lại {countdownSeconds}s trước khi resend</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResend}
            className="rounded-full px-3 text-[11px] uppercase tracking-[0.16em] text-white/78 hover:bg-white/8 hover:text-white"
          >
            Gửi lại
          </Button>
        </div>

        {errorMessage && (
          <div className="border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onHelpOpen}
            className="rounded-full px-0 text-sm text-white/58 hover:bg-transparent hover:text-white"
          >
            <LifeBuoy className="h-4 w-4" />
            OTP đến từ đâu?
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || otp.length !== 6}
            className="h-11 rounded-full bg-white px-6 text-black hover:bg-white/85"
          >
            {isSubmitting ? "Đang xác minh..." : view.primaryActionLabel}
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
};

export default OtpVerifyScreen;
