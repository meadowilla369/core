import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { EventDetailPreview } from "@/components/EventDetailPreview";
import {
  buildEventCreatePayload,
  buildEventPreview,
  createEmptyEventDraft,
  validateEventDraft,
  type EventCreateDraft
} from "@/domain/event-create";
import { fileToDataUrl } from "@/lib/media";
import { defaultOrganizerApi, type OrganizerEventDetail } from "@/lib/organizer-api";

const api = defaultOrganizerApi;
const steps = ["Basic info", "Story & media", "Tickets", "Review gates"];
const inputClass = "min-h-10 rounded-md border border-[--op-border] px-3 text-sm";

function toIsoFromLocalDateTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function toLocalDateTimeValue(value: string) {
  return value ? value.slice(0, 16) : "";
}

function eventToDraft(event: OrganizerEventDetail): EventCreateDraft {
  return {
    ...createEmptyEventDraft(),
    title: event.title,
    category: event.metadata?.category ?? "",
    city: event.city,
    venue: event.venue,
    address: event.metadata?.address ?? "",
    startAt: event.startAt,
    endAt: event.endAt,
    description: event.metadata?.description ?? "",
    lineup: event.metadata?.lineup ?? [],
    heroImageDataUrl: event.metadata?.heroImageDataUrl ?? "",
    posterImageDataUrl: event.metadata?.posterImageDataUrl ?? "",
    ticketTypes: event.ticketTypes.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: tier.price,
      quantity: tier.quantity,
      perks: Array.isArray(tier.perks) ? tier.perks : []
    }))
  };
}

export function EventCreatePage() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<EventCreateDraft>(() => createEmptyEventDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = useMemo(() => validateEventDraft(draft), [draft]);
  const preview = useMemo(() => buildEventPreview(draft), [draft]);

  function updateDraft(next: Partial<EventCreateDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    setError(null);
    void api
      .getEvent(eventId)
      .then((event) => {
        if (isMounted) {
          setDraft(eventToDraft(event));
        }
      })
      .catch((nextError) => {
        if (isMounted) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load draft event");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  async function saveDraft() {
    setIsSaving(true);
    setError(null);
    try {
      const payload = buildEventCreatePayload(draft);
      const saved = eventId
        ? await api.updateEvent(eventId, payload)
        : await api.createEvent(payload);
      navigate(`/events/${saved.id}/review`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save draft event");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImage(field: "heroImageDataUrl" | "posterImageDataUrl", file?: File) {
    if (!file) return;
    updateDraft({ [field]: await fileToDataUrl(file) });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[220px_1fr_360px]">
      <aside className="rounded-lg border border-[--op-border] bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase text-[--op-muted]">
          {eventId ? "Edit event" : "Create event"}
        </p>
        <nav className="mt-4 space-y-2">
          {steps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setStepIndex(index)}
              className={`flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm font-semibold ${
                stepIndex === index
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {index + 1}. {step}
            </button>
          ))}
        </nav>
        <div className="mt-5 rounded-md border border-[--op-border] bg-slate-50 p-3 text-xs text-[--op-muted]">
          <p className="font-semibold text-slate-700">Draft health</p>
          <p>{validation.missingFields.length} missing fields</p>
          <p>{validation.warnings.length} warnings</p>
        </div>
      </aside>

      <section className="rounded-lg border border-[--op-border] bg-white p-5 shadow-sm">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {stepIndex === 0 ? (
          <div className="grid gap-4">
            <input
              className={inputClass}
              placeholder="Event title"
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Category"
              value={draft.category}
              onChange={(event) => updateDraft({ category: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className={inputClass}
                placeholder="City"
                value={draft.city}
                onChange={(event) => updateDraft({ city: event.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Venue"
                value={draft.venue}
                onChange={(event) => updateDraft({ venue: event.target.value })}
              />
            </div>
            <input
              className={inputClass}
              placeholder="Address"
              value={draft.address}
              onChange={(event) => updateDraft({ address: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className={inputClass}
                type="datetime-local"
                value={toLocalDateTimeValue(draft.startAt)}
                onChange={(event) =>
                  updateDraft({ startAt: toIsoFromLocalDateTime(event.target.value) })
                }
              />
              <input
                className={inputClass}
                type="datetime-local"
                value={toLocalDateTimeValue(draft.endAt)}
                onChange={(event) =>
                  updateDraft({ endAt: toIsoFromLocalDateTime(event.target.value) })
                }
              />
            </div>
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="grid gap-4">
            <textarea
              className="min-h-32 rounded-md border border-[--op-border] p-3 text-sm"
              placeholder="Description"
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Lineup, comma separated"
              value={draft.lineup.join(", ")}
              onChange={(event) =>
                updateDraft({
                  lineup: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                })
              }
            />
            <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700">
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload hero image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleImage("heroImageDataUrl", event.target.files?.[0])}
              />
            </label>
            <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700">
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload poster image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  void handleImage("posterImageDataUrl", event.target.files?.[0])
                }
              />
            </label>
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <div className="space-y-4">
            {draft.ticketTypes.map((tier, index) => (
              <div key={index} className="rounded-lg border border-[--op-border] p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    className={inputClass}
                    placeholder="Tier name"
                    value={tier.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: event.target.value } : item
                        )
                      }))
                    }
                  />
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Price"
                    value={tier.price}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, price: Number(event.target.value) }
                            : item
                        )
                      }))
                    }
                  />
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Quantity"
                    value={tier.quantity}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, quantity: Number(event.target.value) }
                            : item
                        )
                      }))
                    }
                  />
                </div>
                <input
                  className="mt-3 min-h-10 w-full rounded-md border border-[--op-border] px-3 text-sm"
                  placeholder="Perks, comma separated"
                  value={tier.perks.join(", ")}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ticketTypes: current.ticketTypes.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              perks: event.target.value
                                .split(",")
                                .map((perk) => perk.trim())
                                .filter(Boolean)
                            }
                          : item
                      )
                    }))
                  }
                />
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-red-700"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      ticketTypes: current.ticketTypes.filter((_, itemIndex) => itemIndex !== index)
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Remove tier
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] px-3 text-sm font-semibold"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  ticketTypes: [
                    ...current.ticketTypes,
                    { name: "", price: 0, quantity: 1, perks: [] }
                  ]
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add tier
            </button>
          </div>
        ) : null}

        {stepIndex === 3 ? (
          <div>
            <h2 className="text-lg font-semibold">Review gates</h2>
            <div className="mt-4 grid gap-3">
              {validation.missingFields.length === 0 ? (
                <p className="rounded-md border border-green-200 bg-green-50 p-3 text-green-700">
                  Ready to continue to review.
                </p>
              ) : null}
              {validation.missingFields.map((field) => (
                <p
                  key={field}
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {field} is required before publish.
                </p>
              ))}
              {validation.warnings.map((field) => (
                <p
                  key={field}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                >
                  {field} has no perks.
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[--op-border] pt-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[--op-border] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void saveDraft()}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            Save draft
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() =>
              stepIndex < steps.length - 1 ? setStepIndex(stepIndex + 1) : void saveDraft()
            }
            disabled={isSaving}
          >
            {stepIndex < steps.length - 1 ? "Next" : "Continue to review"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <aside className="xl:sticky xl:top-5 xl:self-start">
        <EventDetailPreview preview={preview} />
      </aside>
    </div>
  );
}
