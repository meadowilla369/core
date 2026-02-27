import type { RawFigmaDataset } from "../types.js";

export const rawFigmaFixture: RawFigmaDataset = {
  events: [
    {
      id: "evt-001",
      title: "My Tam Live in Concert 2026",
      description: "Special live concert",
      venue: "My Dinh Stadium, Ha Noi",
      date: "2026-04-15T19:00:00.000Z",
      imageUrl: "https://example.com/event-1.jpg",
      category: "Music",
      organizerId: "org-001",
      organizerName: "VMG Entertainment",
      tickets: [
        { id: "tier-001", name: "VIP", price: 3500000, available: 45, total: 200 },
        { id: "tier-002", name: "Standard", price: 2000000, available: 180, total: 500 }
      ]
    },
    {
      id: "evt-002",
      title: "Street Food Festival",
      description: "Food and culture",
      venue: "Thong Nhat Park, Ha Noi",
      date: "2026-04-01T10:00:00.000Z",
      imageUrl: "https://example.com/event-2.jpg",
      category: "Festival",
      organizerId: "org-002",
      organizerName: "Hanoi Events",
      tickets: [{ id: "tier-003", name: "Day Pass", price: 200000, available: 450, total: 1000 }]
    }
  ],
  tickets: [
    {
      id: "tkt-001",
      eventId: "evt-001",
      eventTitle: "My Tam Live in Concert 2026",
      eventDate: "2026-04-15T19:00:00.000Z",
      eventVenue: "My Dinh Stadium, Ha Noi",
      tierName: "Standard",
      faceValue: 2000000,
      purchaseDate: "2026-02-10T14:30:00.000Z",
      qrCode: "TKT001-QR",
      status: "active"
    },
    {
      id: "tkt-002",
      eventId: "evt-002",
      eventTitle: "Street Food Festival",
      eventDate: "2026-04-01T10:00:00.000Z",
      eventVenue: "Thong Nhat Park, Ha Noi",
      tierName: "Day Pass",
      faceValue: 200000,
      purchaseDate: "2026-02-11T10:20:00.000Z",
      qrCode: "TKT002-QR",
      status: "resale",
      resaleListingId: "rsl-001"
    }
  ],
  resaleListings: [
    {
      id: "rsl-001",
      ticketId: "tkt-002",
      sellerId: "user-001",
      askPrice: 220000,
      status: "active",
      createdAt: "2026-02-25T09:00:00.000Z",
      expiresAt: "2026-04-01T09:30:00.000Z"
    },
    {
      id: "rsl-404",
      ticketId: "missing-ticket",
      sellerId: "user-404",
      askPrice: 999,
      status: "active",
      createdAt: "2026-02-25T09:00:00.000Z",
      expiresAt: "2026-04-01T09:30:00.000Z"
    }
  ],
  disputes: [
    {
      id: "dsp-001",
      ticketId: "tkt-001",
      reporterId: "user-010",
      reporterType: "buyer",
      type: "technical",
      description: "QR cannot be loaded",
      status: "investigating",
      priority: "high",
      createdAt: "2026-02-26T14:30:00.000Z",
      updatedAt: "2026-02-27T09:15:00.000Z",
      eventTitle: "My Tam Live in Concert 2026",
      amount: 2000000
    }
  ]
};
