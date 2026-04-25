import { KeyRound, ShieldCheck } from "lucide-react";

import OnboardingShell from "./OnboardingShell";
import { Button } from "@/components/ui/button";
import type { OnboardingViewModel } from "@/features/onboarding/view-model";

interface WalletBootstrapScreenProps {
  view: OnboardingViewModel;
  walletAddress?: string | null;
  isWorking?: boolean;
  onExplainWallet?: () => void;
}

const WalletBootstrapScreen = ({
  view,
  walletAddress,
  isWorking = false,
  onExplainWallet
}: WalletBootstrapScreenProps) => {
  return (
    <OnboardingShell
      eyebrow={view.eyebrow}
      title={view.title}
      description={view.description}
      stageLabel={view.stageLabel}
      progressValue={view.progressValue}
      trustBadges={view.trustBadges}
      timeline={view.timeline}
      helpActionLabel="Wallet la gi"
      onHelpAction={onExplainWallet}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/12">
              <KeyRound className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <p className="text-base font-medium text-white">Wallet duoc tao tu dong</p>
              <p className="mt-1 text-sm leading-6 text-white/62">
                He thong tao local EOA, dang ky voi backend va chuan bi cho giao dich ticket ma
                khong bat nguoi dung cau hinh thu cong.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/16 bg-emerald-400/8 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100/70">
            Wallet draft
          </p>
          <p className="mt-2 break-all text-sm text-white">
            {walletAddress ?? "Dang tao private key va wallet address..."}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Wallet nay dung cho ticket ownership va cac thao tac on-chain sau nay.
        </div>

        <Button
          type="button"
          disabled
          className="h-11 w-full rounded-full bg-white text-black hover:bg-white/85"
        >
          {isWorking ? "Dang bootstrap wallet..." : view.primaryActionLabel}
        </Button>
      </div>
    </OnboardingShell>
  );
};

export default WalletBootstrapScreen;
