import { useMemo, useState } from "react";
import { Ban, Eye, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DataPanel } from "@/components/DataPanel";
import { EventDetailPreview } from "@/components/EventDetailPreview";
import { StatusBadge } from "@/components/StatusBadge";
import {
  buildEventPreview,
  createEmptyEventDraft,
  type EventCreateDraft
} from "@/domain/event-create";
import { buildOverviewModel } from "@/domain/overview";
import { formatDateTime, formatPercent, formatVnd } from "@/lib/format";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";
import { defaultOrganizerApi, type OrganizerEventDetail } from "@/lib/organizer-api";

export function EventsPage() {
  const { data, refresh } = useOrganizerSnapshot();
  const overview = data ? buildOverviewModel(data) : null;
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<{
    id: string;
    title: string;
    ticketsSold: number;
    status: string;
  } | null>(null);
  const [preview, setPreview] = useState<OrganizerEventDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("desktop");

  const previewModel = useMemo(() => {
    if (!preview) return null;
    const draft: EventCreateDraft = {
      ...createEmptyEventDraft(),
      title: preview.title,
      category: preview.metadata?.category ?? "",
      city: preview.city,
      venue: preview.venue,
      address: preview.metadata?.address ?? "",
      startAt: preview.startAt,
      endAt: preview.endAt,
      description: preview.metadata?.description ?? "",
      lineup: preview.metadata?.lineup ?? [],
      heroImageDataUrl: preview.metadata?.heroImageDataUrl ?? "",
      posterImageDataUrl: preview.metadata?.posterImageDataUrl ?? "",
      ticketTypes: preview.ticketTypes.map((tier) => ({
        id: tier.id,
        name: tier.name,
        price: tier.price,
        quantity: tier.quantity,
        perks: Array.isArray(tier.perks) ? tier.perks : []
      }))
    };
    return buildEventPreview(draft);
  }, [preview]);

  async function handlePreview(eventId: string) {
    setPreviewLoading(eventId);
    try {
      const detail = await defaultOrganizerApi.getEvent(eventId);
      setPreview(detail);
    } catch {
      alert("Failed to load event details");
    } finally {
      setPreviewLoading(null);
    }
  }

  async function handleDelete(eventId: string) {
    try {
      await defaultOrganizerApi.deleteEvent(eventId);
      setDeleting(null);
      await refresh();
    } catch {
      alert("Failed to delete event");
    }
  }

  async function handleCancel() {
    if (!cancelling) return;
    try {
      await defaultOrganizerApi.cancelEvent(cancelling.id);
      setCancelling(null);
      await refresh();
    } catch {
      alert("Failed to cancel event");
    }
  }

  return (
    <DataPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-[--op-border] text-xs uppercase text-[--op-muted]">
            <tr>
              <th className="py-2">Event</th>
              <th className="py-2">Schedule</th>
              <th className="py-2">Sales</th>
              <th className="py-2">Sell-through</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
              <th className="py-2"></th>
              <th className="py-2"></th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {overview?.events.map((event) => (
              <tr key={event.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3">
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-xs text-[--op-muted]">{event.venue}</p>
                </td>
                <td className="py-3">{formatDateTime(event.startAt)}</td>
                <td className="py-3">{formatVnd(event.grossSalesVnd)}</td>
                <td className="py-3">{formatPercent(event.sellThroughRate)}</td>
                <td className="py-3">
                  <StatusBadge status={event.status} label={event.status} />
                </td>
                <td className="py-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => void handlePreview(event.id)}
                    disabled={previewLoading === event.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-40"
                    title="Preview event"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
                <td className="py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1">
                    {event.status === "draft" || event.status === "in_review" ? (
                      <Link
                        to={`/events/${event.id}/edit`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="Edit event"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 cursor-not-allowed"
                        title="Event cannot be edited"
                      >
                        <Pencil className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-center align-middle">
                  <div className="flex items-center justify-center gap-1">
                    {event.status !== "cancelled" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCancelling({
                            id: event.id,
                            title: event.title,
                            ticketsSold: event.ticketsSold,
                            status: event.status
                          })
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        title="Cancel event"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    ) : (
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 cursor-not-allowed"
                        title="Event already cancelled"
                      >
                        <Ban className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => setDeleting(event.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Delete event"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Confirm delete</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this event? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="inline-flex min-h-9 items-center rounded-md border border-[--op-border] bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleting)}
                className="inline-flex min-h-9 items-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelling ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Cancel event</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to cancel <strong>{cancelling.title}</strong>?
            </p>
            {cancelling.ticketsSold > 0 ? (
              <p className="mt-2 text-sm text-amber-600">
                This event has <strong>{cancelling.ticketsSold}</strong> tickets sold. Cancelling
                may require refunds.
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelling(null)}
                className="inline-flex min-h-9 items-center rounded-md border border-[--op-border] bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                className="inline-flex min-h-9 items-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-10">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-950">{preview.title}</h3>
                <StatusBadge status={preview.status} label={preview.status} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-md border border-[--op-border] p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={`min-h-7 rounded px-2 text-xs font-semibold ${
                      previewMode === "mobile" ? "bg-blue-50 text-blue-700" : "text-slate-500"
                    }`}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={`min-h-7 rounded px-2 text-xs font-semibold ${
                      previewMode === "desktop" ? "bg-blue-50 text-blue-700" : "text-slate-500"
                    }`}
                  >
                    Desktop
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="inline-flex min-h-9 items-center rounded-md border border-[--op-border] bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-6">
              {previewModel ? (
                <div className={previewMode === "mobile" ? "mx-auto max-w-[375px]" : ""}>
                  <EventDetailPreview preview={previewModel} />
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-sm text-[--op-muted]">
                  Loading...
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DataPanel>
  );
}
