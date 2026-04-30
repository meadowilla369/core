import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "default" | "success" | "attention" | "critical";
}

const toneClass = {
  default: "text-slate-900",
  success: "text-green-700",
  attention: "text-amber-700",
  critical: "text-red-700"
};

export function MetricCard({ label, value, detail, icon, tone = "default" }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-[--op-border] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[--op-muted]">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${toneClass[tone]}`}>{value}</p>
          <p className="mt-1 text-xs text-[--op-muted]">{detail}</p>
        </div>
        <div className="rounded-md border border-blue-100 bg-blue-50 p-2 text-blue-700">{icon}</div>
      </div>
    </section>
  );
}
