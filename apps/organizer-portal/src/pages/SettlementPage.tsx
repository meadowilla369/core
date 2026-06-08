import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

export function SettlementPage() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
      <DataPanel
        title="Settlement"
        description="Primary sales, resale royalties, and payout readiness."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[--op-border] p-4">
            <p className="text-sm text-[--op-muted]">Primary sales</p>
            <p className="text-xl font-semibold">1.82B VND</p>
          </div>
          <div className="rounded-lg border border-[--op-border] p-4">
            <p className="text-sm text-[--op-muted]">Resale royalty</p>
            <p className="text-xl font-semibold">42M VND</p>
          </div>
          <div className="rounded-lg border border-[--op-border] p-4">
            <p className="text-sm text-[--op-muted]">Ready payout</p>
            <p className="text-xl font-semibold">318M VND</p>
          </div>
        </div>
      </DataPanel>
      <DataPanel title="Reconciliation state">
        <StatusBadge status="reconciling" label="Reconciling" />
        <p className="mt-3 text-sm text-[--op-muted]">
          Finalization stays disabled until payment and ticket ledgers match.
        </p>
      </DataPanel>
    </div>
  );
}
