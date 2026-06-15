import { demoOrganizerSnapshot, type OrganizerSnapshot } from "./demo-data";
import type { EventCreatePayload } from "../domain/event-create";

export interface OrganizerApi {
  getSnapshot(): Promise<OrganizerSnapshot>;
  listEvents(query?: { status?: string }): Promise<OrganizerEventDetail[]>;
  createEvent(input: EventCreatePayload): Promise<OrganizerEventDetail>;
  getEvent(eventId: string): Promise<OrganizerEventDetail>;
  listEventGates(eventId: string): Promise<CheckinGate[]>;
  updateEvent(eventId: string, input: Partial<EventCreatePayload>): Promise<OrganizerEventDetail>;
  deleteEvent(eventId: string): Promise<void>;
  cancelEvent(eventId: string): Promise<OrganizerEventDetail>;
  submitEventForReview(eventId: string): Promise<OrganizerEventDetail>;
  devPublishEvent(eventId: string): Promise<OrganizerEventDetail>;
}

export interface OrganizerEventMetadata {
  category: string;
  address: string;
  description: string;
  lineup: string[];
  heroImageDataUrl: string;
  posterImageDataUrl: string;
}

export interface OrganizerTicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
  perks: string[];
}

export interface CheckinGate {
  id: string;
  eventId: string;
  name: string;
  location?: string | null;
  status: "active" | "disabled";
  createdAt: string;
}

export interface OrganizerEventDetail {
  id: string;
  organizerId: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "draft" | "in_review" | "active" | "cancelled";
  metadata: OrganizerEventMetadata | null;
  ticketTypes: OrganizerTicketType[];
}

export class DemoOrganizerApi implements OrganizerApi {
  private readonly events = new Map<string, OrganizerEventDetail>();
  private readonly gates = new Map<string, CheckinGate[]>();

  async getSnapshot(): Promise<OrganizerSnapshot> {
    const demoEvents: OrganizerSnapshot["events"] = demoOrganizerSnapshot.events.map((e) => ({
      ...e,
      grossSalesVnd: 0,
      ticketsSold: 0,
      ticketsLocked: 0,
      ticketCapacity: 0,
      checkinRate: 0
    }));

    for (const event of this.events.values()) {
      const ticketCapacity = event.ticketTypes.reduce((sum, t) => sum + t.quantity, 0);
      const ticketsSold = event.ticketTypes.reduce((sum, t) => sum + t.soldCount, 0);
      const grossSalesVnd = event.ticketTypes.reduce((sum, t) => sum + t.price * t.soldCount, 0);

      demoEvents.push({
        id: event.id,
        title: event.title,
        city: event.city,
        venue: event.venue,
        startAt: event.startAt,
        endAt: event.endAt,
        status: event.status,
        grossSalesVnd,
        ticketsSold,
        ticketsLocked: 0,
        ticketCapacity,
        checkinRate: 0
      });
    }

    return {
      organizerId: "org_rockfest",
      generatedAt: new Date().toISOString(),
      events: demoEvents,
      gates: demoOrganizerSnapshot.gates,
      queues: demoOrganizerSnapshot.queues
    };
  }

  async createEvent(input: EventCreatePayload): Promise<OrganizerEventDetail> {
    const eventId = `evt_demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const event: OrganizerEventDetail = {
      id: eventId,
      organizerId: "org_rockfest",
      title: input.title,
      city: input.city,
      venue: input.venue,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "draft",
      metadata: input.metadata,
      ticketTypes: input.ticketTypes.map((tier, index) => ({
        id: tier.id ?? `${eventId}_tier_${index + 1}`,
        name: tier.name,
        price: tier.price,
        quantity: tier.quantity,
        soldCount: 0,
        perks: tier.perks
      }))
    };
    this.events.set(event.id, event);
    return event;
  }

  async listEvents(query: { status?: string } = {}): Promise<OrganizerEventDetail[]> {
    const events = Array.from(this.events.values());
    return query.status ? events.filter((event) => event.status === query.status) : events;
  }

  async getEvent(eventId: string): Promise<OrganizerEventDetail> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    return event;
  }

  async updateEvent(
    eventId: string,
    input: Partial<EventCreatePayload>
  ): Promise<OrganizerEventDetail> {
    const existing = await this.getEvent(eventId);
    const updated: OrganizerEventDetail = {
      ...existing,
      title: input.title ?? existing.title,
      city: input.city ?? existing.city,
      venue: input.venue ?? existing.venue,
      startAt: input.startAt ?? existing.startAt,
      endAt: input.endAt ?? existing.endAt,
      metadata: input.metadata ?? existing.metadata,
      ticketTypes:
        input.ticketTypes?.map((tier, index) => ({
          id: tier.id ?? `${eventId}_tier_${index + 1}`,
          name: tier.name,
          price: tier.price,
          quantity: tier.quantity,
          soldCount: existing.ticketTypes[index]?.soldCount ?? 0,
          perks: tier.perks
        })) ?? existing.ticketTypes
    };
    this.events.set(eventId, updated);
    return updated;
  }

  async deleteEvent(eventId: string): Promise<void> {
    this.events.delete(eventId);
    this.gates.delete(eventId);
  }

  async cancelEvent(eventId: string): Promise<OrganizerEventDetail> {
    const event = await this.getEvent(eventId);
    const updated: OrganizerEventDetail = { ...event, status: "cancelled" };
    this.events.set(eventId, updated);
    this.gates.set(
      eventId,
      (this.gates.get(eventId) ?? []).map((gate) => ({ ...gate, status: "disabled" }))
    );
    return updated;
  }

  async submitEventForReview(eventId: string): Promise<OrganizerEventDetail> {
    const event = await this.getEvent(eventId);
    const updated: OrganizerEventDetail = { ...event, status: "in_review" };
    this.events.set(eventId, updated);
    return updated;
  }

  async devPublishEvent(eventId: string): Promise<OrganizerEventDetail> {
    const event = await this.getEvent(eventId);
    const updated: OrganizerEventDetail = { ...event, status: "active" };
    this.events.set(eventId, updated);
    if (!this.gates.has(eventId)) {
      this.gates.set(eventId, [
        {
          id: `${eventId}_gate_main`,
          eventId,
          name: "Main gate",
          location: "Main entrance",
          status: "active",
          createdAt: new Date().toISOString()
        },
        {
          id: `${eventId}_gate_vip`,
          eventId,
          name: "VIP gate",
          location: "VIP entrance",
          status: "active",
          createdAt: new Date().toISOString()
        },
        {
          id: `${eventId}_gate_backstage`,
          eventId,
          name: "Backstage gate",
          location: "Staff entrance",
          status: "active",
          createdAt: new Date().toISOString()
        }
      ]);
    }
    return updated;
  }

  async listEventGates(eventId: string): Promise<CheckinGate[]> {
    return this.gates.get(eventId) ?? [];
  }
}

export class HttpOrganizerApi implements OrganizerApi {
  constructor(private readonly organizerId = "org_rockfest") {}

  async getSnapshot(): Promise<OrganizerSnapshot> {
    const body = await requestJson<{ success: true; data: OrganizerSnapshot }>("/v1/events/snapshot", {
      organizerId: this.organizerId
    });
    return body.data;
  }

  async createEvent(input: EventCreatePayload): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>("/v1/events", {
      method: "POST",
      organizerId: this.organizerId,
      body: JSON.stringify(input)
    });
    return body.data;
  }

  async listEvents(query: { status?: string } = {}): Promise<OrganizerEventDetail[]> {
    const search = new URLSearchParams();
    if (query.status) {
      search.set("status", query.status);
    }
    const suffix = search.toString();
    const body = await requestJson<{ success: true; data: OrganizerEventDetail[] }>(
      `/v1/events${suffix ? `?${suffix}` : ""}`,
      { organizerId: this.organizerId }
    );
    return body.data;
  }

  async getEvent(eventId: string): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}`
    );
    return body.data;
  }

  async listEventGates(eventId: string): Promise<CheckinGate[]> {
    const body = await requestJson<{ success: true; data: CheckinGate[] }>(
      `/v1/events/${eventId}/gates`
    );
    return body.data;
  }

  async updateEvent(
    eventId: string,
    input: Partial<EventCreatePayload>
  ): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}`,
      {
        method: "PUT",
        organizerId: this.organizerId,
        body: JSON.stringify(input)
      }
    );
    return body.data;
  }

  async deleteEvent(eventId: string): Promise<void> {
    await requestJson<{ success: true; data: { id: string; deleted: boolean } }>(
      `/v1/events/${eventId}`,
      {
        method: "DELETE",
        organizerId: this.organizerId
      }
    );
  }

  async cancelEvent(eventId: string): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}/cancel`,
      {
        method: "POST",
        organizerId: this.organizerId
      }
    );
    return body.data;
  }

  async submitEventForReview(eventId: string): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}/submit-review`,
      {
        method: "POST",
        organizerId: this.organizerId
      }
    );
    return body.data;
  }

  async devPublishEvent(eventId: string): Promise<OrganizerEventDetail> {
    const body = await requestJson<{ success: true; data: OrganizerEventDetail }>(
      `/v1/events/${eventId}/dev-publish`,
      {
        method: "POST",
        organizerId: this.organizerId
      }
    );
    return body.data;
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestInit & { organizerId?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (options.organizerId) {
    headers.set("x-organizer-id", options.organizerId);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

const organizerEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
  .env;

export const defaultOrganizerApi: OrganizerApi =
  organizerEnv?.VITE_USE_DEMO_ORGANIZER_API === "1" ? new DemoOrganizerApi() : new HttpOrganizerApi();
