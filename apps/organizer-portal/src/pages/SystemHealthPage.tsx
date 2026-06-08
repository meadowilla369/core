import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";

const services = [
  { name: "event-service", status: "active" as const, note: "Postgres ready" },
  { name: "ticketing-service", status: "active" as const, note: "Inventory sync available" },
  { name: "checkin-service", status: "pending" as const, note: "1 mark-as-used retry" },
  { name: "refund-service", status: "failed" as const, note: "1 payout retry failed" },
  { name: "dispute-service", status: "active" as const, note: "Moderation reachable" },
  { name: "marketplace-service", status: "reconciling" as const, note: "Settlement review pending" }
];

export function SystemHealthPage() {
  return (
    <DataPanel
      title="System health"
      description="Product-level service readiness for organizer operations."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between gap-4 rounded-lg border border-[--op-border] p-4"
          >
            <div>
              <p className="font-semibold">{service.name}</p>
              <p className="text-sm text-[--op-muted]">{service.note}</p>
            </div>
            <StatusBadge status={service.status} label={service.status} />
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
