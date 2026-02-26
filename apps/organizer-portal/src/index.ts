import { cancelEvent, createOrganizerEvent, setTicketTypes, type OrganizerEvent, type OrganizerEventInput, type OrganizerTicketTypeInput } from "./features/events.js";
import { summarizeAnalytics, type EventSalesSnapshot, type OrganizerAnalytics } from "./features/analytics.js";

export class OrganizerPortalApp {
  private readonly events = new Map<string, OrganizerEvent>();

  createEvent(input: OrganizerEventInput): OrganizerEvent {
    const event = createOrganizerEvent(input);
    this.events.set(event.id, event);
    return event;
  }

  updateTicketTypes(eventId: string, ticketTypes: OrganizerTicketTypeInput[]): OrganizerEvent {
    const current = this.events.get(eventId);
    if (!current) {
      throw new Error("Event not found");
    }

    const updated = setTicketTypes(current, ticketTypes);
    this.events.set(eventId, updated);
    return updated;
  }

  cancelEvent(eventId: string): OrganizerEvent {
    const current = this.events.get(eventId);
    if (!current) {
      throw new Error("Event not found");
    }

    const updated = cancelEvent(current);
    this.events.set(eventId, updated);
    return updated;
  }

  analytics(snapshots: EventSalesSnapshot[]): OrganizerAnalytics {
    return summarizeAnalytics(snapshots);
  }
}

export function bootstrap(): OrganizerPortalApp {
  return new OrganizerPortalApp();
}
