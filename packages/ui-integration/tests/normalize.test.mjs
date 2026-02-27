import test from "node:test";
import assert from "node:assert/strict";

import { rawFigmaFixture } from "../dist/fixtures/raw-fixture.js";
import { normalizeFigmaUiDataset } from "../dist/normalize.js";

test("normalizeFigmaUiDataset maps fixture into canonical bundle", () => {
  const normalized = normalizeFigmaUiDataset(rawFigmaFixture);

  assert.equal(normalized.events.length, 2);
  assert.equal(normalized.tickets.length, 2);
  assert.equal(normalized.marketplaceListings.length, 1);
  assert.equal(normalized.disputes.length, 1);
});

test("normalizeFigmaUiDataset derives city from venue suffix", () => {
  const normalized = normalizeFigmaUiDataset(rawFigmaFixture);
  const first = normalized.events[0];

  assert.equal(first.city, "Ha Noi");
  assert.equal(first.ticketTypes[0].soldCount, 155);
});

test("normalizeFigmaUiDataset converts listing status and keeps vnd currency", () => {
  const normalized = normalizeFigmaUiDataset(rawFigmaFixture);
  const listing = normalized.marketplaceListings[0];

  assert.equal(listing.status, "active");
  assert.equal(listing.currency, "VND");
  assert.equal(listing.originalPrice, 200000);
});
