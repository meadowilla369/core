import { CalendarPlus } from "lucide-react";
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { buildOverviewModel } from "@/domain/overview";
import { formatDateTime, formatPercent, formatVnd } from "@/lib/format";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function EventsPage() {
  const { data } = useOrganizerSnapshot();
  const overview = data ? buildOverviewModel(data) : null;

  return (
    <DataPanel
      title="Events"
      description="Create, edit, cancel, and monitor organizer-owned events."
      action={
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <CalendarPlus className="h-4 w-4" />
          Create event
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-[--op-border] text-xs uppercase text-[--op-muted]">
            <tr>
              <th className="py-2 pr-3">Event</th>
              <th className="py-2 pr-3">Schedule</th>
              <th className="py-2 pr-3">Sales</th>
              <th className="py-2 pr-3">Sell-through</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {overview?.events.map((event) => (
              <tr key={event.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-3">
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-xs text-[--op-muted]">{event.venue}</p>
                </td>
                <td className="py-3 pr-3">{formatDateTime(event.startAt)}</td>
                <td className="py-3 pr-3">{formatVnd(event.grossSalesVnd)}</td>
                <td className="py-3 pr-3">{formatPercent(event.sellThroughRate)}</td>
                <td className="py-3 pr-3">
                  <StatusBadge status={event.status} label={event.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataPanel>
  );
}
