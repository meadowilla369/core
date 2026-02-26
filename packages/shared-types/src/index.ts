export type Uuid = string;

export interface UserProfile {
  id: Uuid;
  phoneNumber: string;
  email?: string;
}

export interface Reservation {
  id: Uuid;
  eventId: Uuid;
  ticketTypeId: Uuid;
  quantity: number;
  expiresAt: string;
}

export * from "./error-codes.js";
