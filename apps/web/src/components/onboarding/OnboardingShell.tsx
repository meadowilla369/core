import type { ReactNode } from "react";
import { CheckCircle2, CircleDotDashed, Clock3, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { OnboardingTimelineItem } from "@/features/onboarding/view-model";

interface OnboardingShellProps {
  eyebrow: string;
  title: string;
  description: string;
  stageLabel: string;
  progressValue: number;
  trustBadges?: string[];
  timeline?: OnboardingTimelineItem[];
  helpActionLabel?: string;
  onHelpAction?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

function getTimelineIcon(status: OnboardingTimelineItem["status"]) {
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  }

  if (status === "current") {
    return <CircleDotDashed className="h-4 w-4 text-amber-300" />;
  }

  return <Clock3 className="h-4 w-4 text-white/35" />;
}

const OnboardingShell = ({
  eyebrow,
  title,
  description,
  stageLabel,
  progressValue,
  trustBadges = [],
  timeline = [],
  helpActionLabel,
  onHelpAction,
  children,
  footer
}: OnboardingShellProps) => {
  return (
    <div className="min-h-screen bg-[#061019] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <div className="overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_30%),linear-gradient(180deg,_rgba(8,15,23,0.98),_rgba(6,16,25,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="space-y-6 px-5 py-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/48">
                  {eyebrow}
                </p>
                <h1 className="mt-3 text-[2rem] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
                  {title}
                </h1>
              </div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                <ShieldCheck className="h-5 w-5 text-emerald-200" />
              </div>
            </div>

            <p className="max-w-sm text-sm leading-6 text-white/68">{description}</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/48">
                <span>{stageLabel}</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-2 bg-white/10" />
            </div>

            {trustBadges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {trustBadges.map((badge) => (
                  <Badge
                    key={badge}
                    variant="outline"
                    className="rounded-full border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/78"
                  >
                    {badge}
                  </Badge>
                ))}
              </div>
            )}

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 backdrop-blur">
              {children}
            </div>

            {timeline.length > 0 && (
              <>
                <Separator className="bg-white/10" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/48">
                      Trust timeline
                    </p>
                    {helpActionLabel && onHelpAction && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onHelpAction}
                        className="h-8 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/72 hover:bg-white/8 hover:text-white"
                      >
                        {helpActionLabel}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {timeline.map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          "flex items-start gap-3 border border-white/8 px-3 py-3",
                          item.status === "current" && "bg-white/[0.04]"
                        )}
                      >
                        <div className="mt-0.5">{getTimelineIcon(item.status)}</div>
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          {item.detail && (
                            <p className="mt-1 break-all font-mono text-[11px] text-white/50">
                              {item.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
};

export default OnboardingShell;
