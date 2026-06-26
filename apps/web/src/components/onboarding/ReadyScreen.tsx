import { ArrowRight, WalletCards } from "lucide-react";

import OnboardingShell from "./OnboardingShell";
import { Button } from "@/components/ui/button";
import type { OnboardingViewModel } from "@/features/onboarding/view-model";

interface ReadyScreenProps {
  view: OnboardingViewModel;
  userId: string;
  walletAddress: string;
  onContinue?: () => void;
}

const ReadyScreen = ({ view, userId, walletAddress, onContinue }: ReadyScreenProps) => {
  return (
    <OnboardingShell
      eyebrow={view.eyebrow}
      title={view.title}
      description={view.description}
      stageLabel={view.stageLabel}
      progressValue={view.progressValue}
      trustBadges={view.trustBadges}
      timeline={view.timeline}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-300/12">
              <WalletCards className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <p className="text-base font-medium text-white">Session và wallet đã sẵn sàng</p>
              <p className="mt-1 text-sm leading-6 text-white/62">
                Đây là điểm bạn có thể đi vào Home, Discover và transaction flow.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
              User ID
            </p>
            <p className="mt-2 break-all text-sm text-white">{userId}</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
              Wallet
            </p>
            <p className="mt-2 break-all text-sm text-white">{walletAddress}</p>
          </div>
        </div>

        <Button
          type="button"
          onClick={onContinue}
          className="h-12 w-full rounded-full bg-white text-black hover:bg-white/85"
        >
          {view.primaryActionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </OnboardingShell>
  );
};

export default ReadyScreen;
