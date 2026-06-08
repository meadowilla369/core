import assert from "node:assert/strict";
import test from "node:test";

import { toEventCardView, toEventDetailView, toTicketTierViews } from "./adapters.ts";
import { toPosterEventViews } from "../features/discover/event-posters.ts";
import type { EventDetail } from "@ticket-platform/sdk-client";

const event: EventDetail = {
  id: "evt_created",
  organizerId: "org_create",
  title: "Cyber Symphony 2026",
  city: "Ho Chi Minh",
  venue: "Riverside Arena",
  startAt: "2026-08-14T19:00:00.000Z",
  endAt: "2026-08-14T23:00:00.000Z",
  status: "active",
  metadata: {
    category: "Hòa nhạc",
    address: "Riverside Arena, Thu Duc, Ho Chi Minh",
    description: "A metadata-backed event detail description.",
    lineup: ["Neural Beats", "Quantum Strings"],
    heroImageDataUrl: "data:image/png;base64,aGVybw==",
    posterImageDataUrl: "data:image/png;base64,cG9zdGVy"
  },
  ticketTypes: [
    {
      id: "tt_ga",
      name: "General Admission",
      price: 900000,
      quantity: 5000,
      soldCount: 125,
      perks: ["Vào cổng", "Khu vực đứng"]
    }
  ]
};

test("event detail adapter uses event metadata fields", () => {
  const view = toEventDetailView(event);

  assert.equal(view.category, "Hòa nhạc");
  assert.equal(view.address, "Riverside Arena, Thu Duc, Ho Chi Minh");
  assert.equal(view.description, "A metadata-backed event detail description.");
  assert.deepEqual(view.lineup, ["Neural Beats", "Quantum Strings"]);
  assert.equal(view.heroImageDataUrl, "data:image/png;base64,aGVybw==");
});

test("ticket tier adapter prefers backend perks", () => {
  const [tier] = toTicketTierViews(event);

  assert.equal(tier.name, "General Admission");
  assert.deepEqual(tier.perks, ["Vào cổng", "Khu vực đứng"]);
});

test("discover poster conversion uses poster image metadata", () => {
  const card = toEventCardView(event, event);
  const [poster] = toPosterEventViews([card]);

  assert.equal(card.posterImageDataUrl, "data:image/png;base64,cG9zdGVy");
  assert.equal(poster.imageUrl, "data:image/png;base64,cG9zdGVy");
  assert.equal(poster.heroImageUrl, "data:image/png;base64,cG9zdGVy");
});
