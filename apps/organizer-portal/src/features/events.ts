export interface OrganizerEventInput {
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
}

export interface OrganizerTicketTypeInput {
  name: string;
  price: number;
  quantity: number;
}

export interface OrganizerEvent extends OrganizerEventInput {
  id: string;
  status: "draft" | "published" | "cancelled";
  ticketTypes: OrganizerTicketTypeInput[];
}

export function createOrganizerEvent(input: OrganizerEventInput): OrganizerEvent {
  return {
    id: `evt_${Date.now()}`,
    ...input,
    status: "draft",
    ticketTypes: []
  };
}

export function setTicketTypes(event: OrganizerEvent, ticketTypes: OrganizerTicketTypeInput[]): OrganizerEvent {
  return {
    ...event,
    ticketTypes
  };
}

export function cancelEvent(event: OrganizerEvent): OrganizerEvent {
  return {
    ...event,
    status: "cancelled"
  };
}
