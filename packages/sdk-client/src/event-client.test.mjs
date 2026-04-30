import assert from "node:assert/strict";
import test from "node:test";

import { TicketPlatformClient } from "../dist/index.js";

function withMockFetch(assertRequest) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    assertRequest?.({ url: String(url), init });
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: "evt_created",
          organizerId: "org_create",
          title: "Cyber Symphony",
          city: "Ho Chi Minh",
          venue: "Riverside Arena",
          startAt: "2026-08-14T19:00:00.000Z",
          endAt: "2026-08-14T23:00:00.000Z",
          status: "draft",
          metadata: {
            category: "Hòa nhạc",
            address: "Riverside Arena",
            description: "Description",
            lineup: ["Artist"],
            heroImageDataUrl: "data:image/png;base64,aA==",
            posterImageDataUrl: "data:image/png;base64,cA=="
          },
          ticketTypes: [
            {
              id: "tt_ga",
              name: "GA",
              price: 900000,
              quantity: 100,
              soldCount: 0,
              perks: ["Vào cổng"]
            }
          ]
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  return { fetchImpl, calls };
}

const draftPayload = {
  title: "Cyber Symphony",
  city: "Ho Chi Minh",
  venue: "Riverside Arena",
  startAt: "2026-08-14T19:00:00.000Z",
  endAt: "2026-08-14T23:00:00.000Z",
  metadata: {
    category: "Hòa nhạc",
    address: "Riverside Arena",
    description: "Description",
    lineup: ["Artist"],
    heroImageDataUrl: "data:image/png;base64,aA==",
    posterImageDataUrl: "data:image/png;base64,cA=="
  },
  ticketTypes: [{ name: "GA", price: 900000, quantity: 100, perks: ["Vào cổng"] }]
};

test("createEvent posts metadata and organizer header", async () => {
  const { fetchImpl, calls } = withMockFetch();
  const client = new TicketPlatformClient({ baseUrl: "https://api.example.test", fetchImpl });

  const response = await client.createEvent(draftPayload, { organizerId: "org_create" });

  assert.equal(response.data.metadata.category, "Hòa nhạc");
  assert.deepEqual(response.data.ticketTypes[0].perks, ["Vào cổng"]);
  assert.equal(calls[0].url, "https://api.example.test/v1/events");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["x-organizer-id"], "org_create");
  assert.equal(JSON.parse(calls[0].init.body).metadata.category, "Hòa nhạc");
});

test("submitEventForReview and devPublishEvent call dedicated endpoints", async () => {
  const { fetchImpl, calls } = withMockFetch();
  const client = new TicketPlatformClient({ baseUrl: "https://api.example.test", fetchImpl });

  await client.submitEventForReview("evt_created", { organizerId: "org_create" });
  await client.devPublishEvent("evt_created", { organizerId: "org_create" });

  assert.equal(calls[0].url, "https://api.example.test/v1/events/evt_created/submit-review");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[1].url, "https://api.example.test/v1/events/evt_created/dev-publish");
  assert.equal(calls[1].init.method, "POST");
});
