import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEventCreatePayload,
  buildEventPreview,
  createEmptyEventDraft,
  validateEventDraft
} from "./event-create.ts";

test("empty draft reports publish readiness errors", () => {
  const draft = createEmptyEventDraft();
  const result = validateEventDraft(draft);

  assert.equal(result.isPublishReady, false);
  assert.deepEqual(result.missingFields.slice(0, 6), [
    "title",
    "category",
    "city",
    "venue",
    "address",
    "startAt"
  ]);
});

test("complete draft builds API payload and preview", () => {
  const draft = {
    ...createEmptyEventDraft(),
    title: "Cyber Symphony 2026",
    category: "Hòa nhạc",
    city: "Ho Chi Minh",
    venue: "Riverside Arena",
    address: "Riverside Arena, Thu Duc",
    startAt: "2026-08-14T19:00:00.000Z",
    endAt: "2026-08-14T23:00:00.000Z",
    description: "A metadata-backed description.",
    lineup: ["Neural Beats"],
    heroImageDataUrl: "data:image/png;base64,aGVybw==",
    posterImageDataUrl: "data:image/png;base64,cG9zdGVy",
    ticketTypes: [
      {
        name: "GA",
        price: 900000,
        quantity: 100,
        perks: ["Vào cổng"]
      }
    ]
  };

  const validation = validateEventDraft(draft);
  assert.equal(validation.isPublishReady, true);

  const payload = buildEventCreatePayload(draft);
  assert.equal(payload.metadata.category, "Hòa nhạc");
  assert.deepEqual(payload.ticketTypes[0].perks, ["Vào cổng"]);

  const preview = buildEventPreview(draft);
  assert.equal(preview.event.name, "Cyber Symphony 2026");
  assert.equal(preview.event.heroImageDataUrl, "data:image/png;base64,aGVybw==");
  assert.equal(preview.tiers[0].price, "900.000 ₫");
});
