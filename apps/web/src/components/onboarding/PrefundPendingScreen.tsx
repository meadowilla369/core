import { ArrowUpRight, RefreshCcw, ShieldEllipsis } from "lucide-react";

import OnboardingShell from "./OnboardingShell";
import { Button } from "@/components/ui/button";
import type { OnboardingViewModel } from "@/features/onboarding/view-model";

interface PrefundPendingScreenProps {
  view: OnboardingViewModel;
  walletAddress?: string | null;
  statusLabel?: string;
  errorMessage?: string | null;
  onExplainGas?: () => void;
  onRetry?: () => void;
}

const PrefundPendingScreen = ({
  view,
  walletAddress,
  statusLabel,
  errorMessage,
  onExplainGas,
  onRetry
}: PrefundPendingScreenProps) => {
  return (
    <OnboardingShell
      eyebrow={view.eyebrow}
      title={view.title}
      description={view.description}
      stageLabel={view.stageLabel}
      progressValue={view.progressValue}
      trustBadges={view.trustBadges}
      timeline={view.timeline}
      helpActionLabel="Vi sao can gas"
      onHelpAction={onExplainGas}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-300/12">
              <ShieldEllipsis className="h-5 w-5 text-sky-200" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-white">Trang thai localchain</p>
              <p className="text-sm leading-6 text-white/62">
                {statusLabel ?? "Dang doi backend xac nhan giao dich prefund mot lan."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-300/18 bg-amber-300/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100/70">
            Wallet cho prefund
          </p>
          <p className="mt-2 break-all text-sm text-white">{walletAddress ?? "Dang dong bo..."}</p>
        </div>

        {errorMessage && (
          <div className="border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="h-11 flex-1 rounded-full border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
          <Button
            type="button"
            onClick={onExplainGas}
            className="h-11 flex-1 rounded-full bg-white text-black hover:bg-white/85"
          >
            <ArrowUpRight className="h-4 w-4" />
            Giai thich gas
          </Button>
        </div>
      </div>
    </OnboardingShell>
  );
};

export default PrefundPendingScreen;
