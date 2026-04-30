import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

const disputes = [
  {
    id: "dsp_2040",
    category: "check-in",
    event: "Rock Fest 2026",
    sla: "2h left",
    status: "in_review" as const
  },
  {
    id: "dsp_2041",
    category: "refund",
    event: "Jazz Night 2026",
    sla: "1d left",
    status: "awaiting_evidence" as const
  },
  {
    id: "dsp_2042",
    category: "resale",
    event: "Rock Fest 2026",
    sla: "resolved",
    status: "resolved" as const
  }
];

export function DisputesPage() {
  return (
    <DataPanel title="Disputes" description="SLA-oriented moderation and support queue.">
      <div className="space-y-3">
        {disputes.map((dispute) => (
          <div
            key={dispute.id}
            className="grid gap-3 rounded-lg border border-[--op-border] p-4 md:grid-cols-[140px_1fr_120px_160px]"
          >
            <p className="font-mono text-sm">{dispute.id}</p>
            <div>
              <p className="font-semibold">{dispute.event}</p>
              <p className="text-sm text-[--op-muted]">{dispute.category}</p>
            </div>
            <p>{dispute.sla}</p>
            <StatusBadge status={dispute.status} label={dispute.status.replace(/_/g, " ")} />
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
