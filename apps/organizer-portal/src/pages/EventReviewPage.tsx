import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Rocket, Send } from "lucide-react";
import { DataPanel } from "@/components/DataPanel";
import { EventDetailPreview } from "@/components/EventDetailPreview";
import { StatusBadge } from "@/components/StatusBadge";
import {
  buildEventPreview,
  createEmptyEventDraft,
  validateEventDraft,
  type EventCreateDraft
} from "@/domain/event-create";
import { defaultOrganizerApi, type OrganizerEventDetail } from "@/lib/organizer-api";

const api = defaultOrganizerApi;

function eventToDraft(event: OrganizerEventDetail): EventCreateDraft {
  return {
    ...createEmptyEventDraft(),
    title: event.title,
    city: event.city,
    venue: event.venue,
    startAt: event.startAt,
    endAt: event.endAt,
    category: event.metadata?.category ?? "",
    address: event.metadata?.address ?? "",
    description: event.metadata?.description ?? "",
    lineup: event.metadata?.lineup ?? [],
    heroImageDataUrl: event.metadata?.heroImageDataUrl ?? "",
    posterImageDataUrl: event.metadata?.posterImageDataUrl ?? "",
    ticketTypes: event.ticketTypes.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: tier.price,
      quantity: tier.quantity,
      perks: tier.perks
    }))
  };
}

export function EventReviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<OrganizerEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    void api
      .getEvent(eventId)
      .then(setEvent)
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Unable to load event");
      });
  }, [eventId]);

  const draft = useMemo(() => (event ? eventToDraft(event) : createEmptyEventDraft()), [event]);
  const preview = useMemo(() => buildEventPreview(draft), [draft]);
  const validation = useMemo(() => validateEventDraft(draft), [draft]);

  async function runAction(action: "submit" | "publish") {
    if (!eventId) return;
    setIsSaving(true);
    setError(null);
    try {
      const next =
        action === "submit"
          ? await api.submitEventForReview(eventId)
          : await api.devPublishEvent(eventId);
      setEvent(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update event");
    } finally {
      setIsSaving(false);
    }
  }

  if (!event && !error) {
    return (
      <div className="rounded-lg border border-[--op-border] bg-white p-6">
        Loading event review...
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : null}
        {event ? (
          <DataPanel
            title={event.title}
            description="Review attendee-facing detail before submitting or dev publishing."
            action={<StatusBadge status={event.status} label={event.status} />}
          >
            <div className="grid gap-3">
              {validation.missingFields.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready for review or dev publish.
                </div>
              ) : null}
              {validation.missingFields.map((field) => (
                <div
                  key={field}
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {field} is required before review.
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isSaving || !validation.isPublishReady}
                onClick={() => void runAction("submit")}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Submit for review
              </button>
              <button
                type="button"
                disabled={isSaving || !validation.isPublishReady}
                onClick={() => void runAction("publish")}
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" />
                Dev publish
              </button>
              {event.status === "draft" ? (
                <Link
                  to={`/events/${event.id}/edit`}
                  className="inline-flex min-h-10 items-center rounded-md border border-[--op-border] px-3 text-sm font-semibold"
                >
                  Back to edit
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="inline-flex min-h-10 items-center rounded-md border border-[--op-border] px-3 text-sm font-semibold"
              >
                Back to events
              </button>
            </div>
          </DataPanel>
        ) : null}
      </div>
      <EventDetailPreview preview={preview} />
    </div>
  );
}
