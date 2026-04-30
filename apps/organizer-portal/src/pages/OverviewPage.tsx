import { AlertTriangle, Banknote, CheckCircle2, RefreshCw, Ticket } from "lucide-react";
import { DataPanel } from "@/components/DataPanel";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { buildOverviewModel } from "@/domain/overview";
import { formatDateTime, formatPercent, formatVnd } from "@/lib/format";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function OverviewPage() {
  const { data, isLoading, error, refresh } = useOrganizerSnapshot();
  const overview = data ? buildOverviewModel(data) : null;

  if (isLoading && !overview) {
    return (
      <div className="rounded-lg border border-[--op-border] bg-white p-6">
        Loading dashboard...
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        Unable to load organizer dashboard: {error}
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross sales"
          value={formatVnd(overview.kpis.grossSalesVnd)}
          detail={`Updated ${formatDateTime(overview.generatedAt)}`}
          icon={<Banknote className="h-4 w-4" />}
        />
        <MetricCard
          label="Tickets sold"
          value={overview.kpis.ticketsSold.toLocaleString("en")}
          detail="Across active organizer events"
          icon={<Ticket className="h-4 w-4" />}
        />
        <MetricCard
          label="Check-in rate"
          value={formatPercent(overview.kpis.checkinRate)}
          detail={`${overview.gates.length} active gate groups`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <MetricCard
          label="Open risk items"
          value={overview.kpis.openRiskItems.toString()}
          detail="Refunds, disputes, settlement, sync"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="attention"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <DataPanel title="Event operations" description="Active and upcoming organizer events">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[--op-border] text-xs uppercase text-[--op-muted]">
                <tr>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Sales</th>
                  <th className="py-2 pr-3">Inventory</th>
                  <th className="py-2 pr-3">Check-in</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.events.map((event) => (
                  <tr key={event.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-950">{event.title}</p>
                      <p className="text-xs text-[--op-muted]">
                        {event.venue} · {event.city}
                      </p>
                    </td>
                    <td className="py-3 pr-3">{formatVnd(event.grossSalesVnd)}</td>
                    <td className="py-3 pr-3">
                      {event.availableTickets.toLocaleString("en")} available
                    </td>
                    <td className="py-3 pr-3">{formatPercent(event.checkinRate)}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={event.status} label={event.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>

        <DataPanel title="Live check-in" description="Gate-level scan health">
          <div className="space-y-4">
            {overview.gates.map((gate) => (
              <div key={gate.gateId}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{gate.gateId}</span>
                  <span className="text-green-700">
                    {gate.checkedInCount.toLocaleString("en")} valid
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.min(gate.checkedInCount / 18, 100)}%` }}
                  />
                </div>
                {(gate.duplicateCount > 0 || gate.invalidCount > 0) && (
                  <p className="mt-1 text-xs text-amber-700">
                    {gate.duplicateCount} duplicate · {gate.invalidCount} invalid
                  </p>
                )}
              </div>
            ))}
          </div>
        </DataPanel>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.riskQueues.map((queue) => (
          <DataPanel key={queue.id} title={queue.label}>
            <p className="text-2xl font-semibold text-slate-950">{queue.count}</p>
            <p className="mt-1 text-sm text-[--op-muted]">{queue.description}</p>
            <div className="mt-3">
              <StatusBadge status={queue.status} label={queue.status.replace(/_/g, " ")} />
            </div>
          </DataPanel>
        ))}
      </section>
    </div>
  );
}
