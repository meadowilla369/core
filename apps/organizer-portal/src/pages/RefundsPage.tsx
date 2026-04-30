import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

const refunds = [
  {
    id: "ref_1024",
    event: "Rock Fest 2026",
    amount: "900,000 VND",
    status: "pending" as const,
    note: "Pending payout"
  },
  {
    id: "ref_1025",
    event: "Rock Fest 2026",
    amount: "2,200,000 VND",
    status: "failed" as const,
    note: "Gateway retry required"
  },
  {
    id: "ref_1026",
    event: "Jazz Night 2026",
    amount: "650,000 VND",
    status: "completed" as const,
    note: "Paid through original method"
  }
];

export function RefundsPage() {
  return (
    <DataPanel
      title="Refunds"
      description="Refund requests, payout retries, and cancellation impact."
    >
      <div className="space-y-3">
        {refunds.map((refund) => (
          <div
            key={refund.id}
            className="grid gap-3 rounded-lg border border-[--op-border] p-4 md:grid-cols-[140px_1fr_140px_140px]"
          >
            <p className="font-mono text-sm">{refund.id}</p>
            <div>
              <p className="font-semibold">{refund.event}</p>
              <p className="text-sm text-[--op-muted]">{refund.note}</p>
            </div>
            <p className="font-semibold">{refund.amount}</p>
            <StatusBadge status={refund.status} label={refund.status} />
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
