export type Uuid = string;
export type CurrencyCode = "VND" | "USD" | "USDC";

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

export interface User {
  id: Uuid;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;
  role: "buyer" | "seller" | "organizer" | "admin";
}

export interface Venue {
  id: Uuid;
  name: string;
  city: string;
  address: string;
  country?: string;
}

export interface Event {
  id: Uuid;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  venueId: Uuid;
  organizerId: Uuid;
  category: string;
  status: "draft" | "published" | "active" | "cancelled" | "completed";
  coverImage?: string;
  maxCapacity?: number;
}

export interface TicketTier {
  id: Uuid;
  eventId: Uuid;
  name: string;
  price: number;
  currency: CurrencyCode;
  quantity: number;
  maxPerUser?: number;
  saleStart?: string;
  saleEnd?: string;
}

export interface Ticket {
  id: Uuid;
  eventId: Uuid;
  tierId: Uuid;
  ownerId: Uuid;
  status: "reserved" | "issued" | "checked_in" | "listed" | "used" | "cancelled" | "refunded";
  qrCodeHash?: string;
  mintTxHash?: string;
  tokenId?: string;
  seatInfo?: string;
}

export interface Listing {
  id: Uuid;
  ticketId: Uuid;
  sellerId: Uuid;
  price: number;
  currency: CurrencyCode;
  status: "active" | "cancelled" | "completed";
  listedAt: string;
  expiresAt?: string;
}

export interface Trade {
  id: Uuid;
  initiatorId: Uuid;
  responderId: Uuid;
  initiatorTicketId: Uuid;
  responderTicketId: Uuid;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
}

export interface EventCardView {
  id: Uuid;
  name: string;
  date: string;
  location: string;
  category: string;
  image?: string;
  price: string;
}

export interface TicketCardView {
  id: Uuid;
  eventName: string;
  date: string;
  time: string;
  location: string;
  ticketType: string;
  qrCode?: string;
}

export interface MarketplaceTicketListingView {
  id: Uuid;
  tier: string;
  price: string;
}

export interface MarketplaceEventView {
  id: Uuid;
  eventName: string;
  eventIcon?: string;
  dayVolume: string;
  dayChange: number;
  floorPrice: string;
  floorChange: number;
  listings: MarketplaceTicketListingView[];
}

export interface EventDetailView {
  id: Uuid;
  name: string;
  category: string;
  date: string;
  time: string;
  location: string;
  address: string;
  price: {
    min: number;
    max: number;
  };
  description: string;
  lineup: string[];
  attendees: number;
  image?: string;
  posterImage?: string;
}

export interface TicketTierView {
  name: string;
  price: string;
  perks: string[];
}

export interface ProfileSummaryView {
  displayName: string;
  email: string;
  avatarInitials: string;
  attendedEvents: number;
  upcomingEvents: number;
  spendSummary: string;
}

export * from "./error-codes.js";
