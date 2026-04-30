import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { buildOverviewModel } from "@/domain/overview";
import { formatPercent } from "@/lib/format";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function InventoryPage() {
  const { data } = useOrganizerSnapshot();
  const overview = data ? buildOverviewModel(data) : null;

  return (
    <DataPanel
      title="Ticket inventory"
      description="Sold, locked, and available capacity by event."
    >
      <div className="grid gap-3">
        {overview?.events.map((event) => {
          const lowInventory = event.availableTickets / event.ticketCapacity < 0.15;

          return (
            <div
              key={event.id}
              className="grid gap-3 rounded-lg border border-[--op-border] p-4 md:grid-cols-[1fr_140px_140px_140px_120px]"
            >
              <div>
                <p className="font-semibold">{event.title}</p>
                <p className="text-sm text-[--op-muted]">
                  {event.ticketCapacity.toLocaleString("en")} total capacity
                </p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Sold</p>
                <p className="font-semibold">{event.ticketsSold.toLocaleString("en")}</p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Locked</p>
                <p className="font-semibold">{event.ticketsLocked.toLocaleString("en")}</p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Available</p>
                <p className="font-semibold">{event.availableTickets.toLocaleString("en")}</p>
              </div>
              <div>
                <p className="text-xs text-[--op-muted]">Health</p>
                <StatusBadge
                  status={lowInventory ? "pending" : "active"}
                  label={lowInventory ? "Low inventory" : formatPercent(event.sellThroughRate)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DataPanel>
  );
}
