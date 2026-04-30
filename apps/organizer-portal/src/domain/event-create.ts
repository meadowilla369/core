import { formatDateTime, formatVnd } from "../lib/format.ts";

export interface EventTicketTypeDraft {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  perks: string[];
}

export interface EventCreateDraft {
  title: string;
  category: string;
  city: string;
  venue: string;
  address: string;
  startAt: string;
  endAt: string;
  description: string;
  lineup: string[];
  heroImageDataUrl: string;
  posterImageDataUrl: string;
  ticketTypes: EventTicketTypeDraft[];
}

export interface EventCreateValidation {
  isPublishReady: boolean;
  missingFields: string[];
  warnings: string[];
}

export interface EventCreatePayload {
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "draft";
  metadata: {
    category: string;
    address: string;
    description: string;
    lineup: string[];
    heroImageDataUrl: string;
    posterImageDataUrl: string;
  };
  ticketTypes: EventTicketTypeDraft[];
}

export interface EventPreviewModel {
  event: {
    id: string;
    name: string;
    category: string;
    date: string;
    time: string;
    location: string;
    address: string;
    price: { min: number; max: number };
    description: string;
    lineup: string[];
    attendees: number;
    heroImageDataUrl?: string;
  };
  tiers: Array<{ name: string; price: string; perks: string[] }>;
}

export function createEmptyEventDraft(): EventCreateDraft {
  return {
    title: "",
    category: "",
    city: "",
    venue: "",
    address: "",
    startAt: "",
    endAt: "",
    description: "",
    lineup: [],
    heroImageDataUrl: "",
    posterImageDataUrl: "",
    ticketTypes: []
  };
}

export function validateEventDraft(draft: EventCreateDraft): EventCreateValidation {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!draft.title.trim()) missingFields.push("title");
  if (!draft.category.trim()) missingFields.push("category");
  if (!draft.city.trim()) missingFields.push("city");
  if (!draft.venue.trim()) missingFields.push("venue");
  if (!draft.address.trim()) missingFields.push("address");
  if (!draft.startAt.trim()) missingFields.push("startAt");
  if (!draft.endAt.trim()) missingFields.push("endAt");
  if (draft.startAt && draft.endAt && new Date(draft.endAt) <= new Date(draft.startAt)) {
    missingFields.push("endAfterStart");
  }
  if (!draft.description.trim()) missingFields.push("description");
  if (!draft.heroImageDataUrl.trim()) missingFields.push("heroImageDataUrl");
  if (!draft.posterImageDataUrl.trim()) missingFields.push("posterImageDataUrl");
  if (draft.ticketTypes.length === 0) missingFields.push("ticketTypes");

  draft.ticketTypes.forEach((tier, index) => {
    if (!tier.name.trim()) missingFields.push(`ticketTypes.${index}.name`);
    if (tier.price < 0) missingFields.push(`ticketTypes.${index}.price`);
    if (tier.quantity <= 0) missingFields.push(`ticketTypes.${index}.quantity`);
    if (tier.perks.length === 0) warnings.push(`ticketTypes.${index}.perks`);
  });

  return {
    isPublishReady: missingFields.length === 0,
    missingFields,
    warnings
  };
}

export function buildEventCreatePayload(draft: EventCreateDraft): EventCreatePayload {
  return {
    title: draft.title.trim(),
    city: draft.city.trim(),
    venue: draft.venue.trim(),
    startAt: draft.startAt,
    endAt: draft.endAt,
    status: "draft",
    metadata: {
      category: draft.category.trim(),
      address: draft.address.trim(),
      description: draft.description.trim(),
      lineup: draft.lineup.map((item) => item.trim()).filter(Boolean),
      heroImageDataUrl: draft.heroImageDataUrl,
      posterImageDataUrl: draft.posterImageDataUrl
    },
    ticketTypes: draft.ticketTypes.map((tier) => ({
      id: tier.id,
      name: tier.name.trim(),
      price: tier.price,
      quantity: tier.quantity,
      perks: tier.perks.map((item) => item.trim()).filter(Boolean)
    }))
  };
}

export function buildEventPreview(draft: EventCreateDraft): EventPreviewModel {
  const prices = draft.ticketTypes.map((tier) => tier.price);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const max = prices.length > 0 ? Math.max(...prices) : 0;

  return {
    event: {
      id: "draft",
      name: draft.title || "Untitled event",
      category: draft.category || "Sự kiện",
      date: draft.startAt ? formatDateTime(draft.startAt) : "Chưa chọn ngày",
      time:
        draft.startAt && draft.endAt
          ? `${formatDateTime(draft.startAt)} - ${formatDateTime(draft.endAt)}`
          : "Chưa chọn giờ",
      location: draft.venue || "Chưa chọn địa điểm",
      address: draft.address || `${draft.venue}, ${draft.city}`,
      price: { min, max },
      description: draft.description || "Chưa có mô tả.",
      lineup: draft.lineup,
      attendees: 0,
      heroImageDataUrl: draft.heroImageDataUrl || undefined
    },
    tiers: draft.ticketTypes.map((tier) => ({
      name: tier.name || "Unnamed tier",
      price: formatVnd(tier.price),
      perks: tier.perks
    }))
  };
}
