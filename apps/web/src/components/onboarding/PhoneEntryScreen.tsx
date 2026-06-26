import type { FormEvent } from "react";
import { PhoneCall, ShieldCheck } from "lucide-react";

import OnboardingShell from "./OnboardingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingViewModel } from "@/features/onboarding/view-model";

interface PhoneEntryScreenProps {
  view: OnboardingViewModel;
  phone: string;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onWhyPhoneOpen?: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

const PhoneEntryScreen = ({
  view,
  phone,
  onPhoneChange,
  onSubmit,
  onWhyPhoneOpen,
  isSubmitting = false,
  errorMessage
}: PhoneEntryScreenProps) => {
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
      helpActionLabel="Vì sao cần phone"
      onHelpAction={onWhyPhoneOpen}
      footer={
        <p className="px-2 text-center text-xs leading-5 text-white/45">
          Số điện thoại sẽ được dùng để tạo session và giảm gian lận onboarding.
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/8 p-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-300/12">
              <PhoneCall className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Nhận OTP từ backend dev</p>
              <p className="text-xs text-white/56">Không cần SMS vendor trong local demo.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/52">
            Số điện thoại
          </label>
          <Input
            inputMode="tel"
            autoComplete="tel"
            placeholder="+84901234567"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            className="h-12 border-white/10 bg-white/6 text-base text-white placeholder:text-white/28"
          />
        </div>

        {errorMessage && (
          <div className="border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/68">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Recovery và giảm duplicate sẽ bắt đầu từ số điện thoại này.
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || phone.trim().length === 0}
          className="h-12 w-full rounded-full bg-white text-black hover:bg-white/85"
        >
          {isSubmitting ? "Đang gửi OTP..." : view.primaryActionLabel}
        </Button>
      </form>
    </OnboardingShell>
  );
};

export default PhoneEntryScreen;
