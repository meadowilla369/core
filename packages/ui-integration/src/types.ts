export interface RawFigmaTicketTier {
  id: string;
  name: string;
  price: number;
  available: number;
  total: number;
}

export interface RawFigmaEvent {
  id: string;
  title: string;
  description: string;
  venue: string;
  date: string;
  imageUrl: string;
  category: string;
  organizerId: string;
  organizerName: string;
  tickets: RawFigmaTicketTier[];
}

export type RawFigmaTicketStatus = "active" | "used" | "resale" | "expired";

export interface RawFigmaTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  tierName: string;
  faceValue: number;
  purchaseDate: string;
  qrCode: string;
  status: RawFigmaTicketStatus;
  resaleListingId?: string;
}

export type RawFigmaResaleStatus = "active" | "sold" | "cancelled" | "expired";

export interface RawFigmaResaleListing {
  id: string;
  ticketId: string;
  sellerId: string;
  askPrice: number;
  status: RawFigmaResaleStatus;
  createdAt: string;
  expiresAt: string;
}

export type RawFigmaDisputeStatus = "open" | "investigating" | "resolved" | "closed";

export interface RawFigmaDispute {
  id: string;
  ticketId: string;
  reporterId: string;
  reporterType: "buyer" | "seller" | "organizer";
  type: "fraud" | "refund" | "technical" | "other";
  description: string;
  status: RawFigmaDisputeStatus;
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  eventTitle?: string;
  amount?: number;
}

export interface RawFigmaDataset {
  events: RawFigmaEvent[];
  tickets: RawFigmaTicket[];
  resaleListings: RawFigmaResaleListing[];
  disputes: RawFigmaDispute[];
}

export interface NormalizedTicketType {
  id: string;
  name: string;
  price: number;
  quantity: number;
  soldCount: number;
}

export interface NormalizedEventDetail {
  id: string;
  organizerId: string;
  title: string;
  city: string;
  venue: string;
  startAt: string;
  endAt: string;
  status: "active" | "cancelled";
  ticketTypes: NormalizedTicketType[];
}

export interface NormalizedTicketRecord {
  tokenId: string;
  eventId: string;
  ticketTypeId: string;
  ownerUserId: string;
  seatInfo: string;
  reservationId: string;
  createdAt: string;
  state: "active" | "used" | "resale" | "expired";
}

export interface NormalizedMarketplaceListing {
  id: string;
  tokenId: string;
  eventId: string;
  sellerUserId: string;
  sellerWalletAddress: string;
  originalPrice: number;
  askPrice: number;
  currency: "VND";
  status: "active" | "cancelled" | "completed";
  eventStartAt: string;
  expiresAt: string;
  resaleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedDisputeSummary {
  id: string;
  ticketTokenId: string;
  reporterId: string;
  reporterType: "buyer" | "seller" | "organizer";
  type: "fraud" | "refund" | "technical" | "other";
  status: "open" | "investigating" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  amount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedUiDataset {
  events: NormalizedEventDetail[];
  tickets: NormalizedTicketRecord[];
  marketplaceListings: NormalizedMarketplaceListing[];
  disputes: NormalizedDisputeSummary[];
}
