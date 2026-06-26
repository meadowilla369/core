import { KeyRound, ShieldCheck } from "lucide-react";

import OnboardingShell from "./OnboardingShell";
import { Button } from "@/components/ui/button";
import type { OnboardingViewModel } from "@/features/onboarding/view-model";

interface WalletBootstrapScreenProps {
  view: OnboardingViewModel;
  walletAddress?: string | null;
  isWorking?: boolean;
  onExplainWallet?: () => void;
  onContinue?: () => void;
}

const WalletBootstrapScreen = ({
  view,
  walletAddress,
  isWorking = false,
  onExplainWallet,
  onContinue
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
      helpActionLabel="Wallet là gì"
      onHelpAction={onExplainWallet}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/12">
              <KeyRound className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <p className="text-base font-medium text-white">Wallet được tạo tự động</p>
              <p className="mt-1 text-sm leading-6 text-white/62">
                Hệ thống tạo local EOA, đăng ký với backend và chuẩn bị cho giao dịch ticket mà
                không bắt người dùng cấu hình thủ công.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/16 bg-emerald-400/8 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100/70">
            Wallet draft
          </p>
          <p className="mt-2 break-all text-sm text-white">
            {walletAddress ?? "Private key sẽ được tạo bên trong app Entr sau handoff."}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/68">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Wallet này dùng cho ticket ownership và các thao tác on-chain sau này.
        </div>

        <Button
          type="button"
          disabled={!onContinue || isWorking}
          onClick={onContinue}
          className="h-11 w-full rounded-full bg-white text-black hover:bg-white/85"
        >
          {isWorking ? "Đang bootstrap wallet..." : view.primaryActionLabel}
        </Button>
      </div>
    </OnboardingShell>
  );
};

export default WalletBootstrapScreen;
