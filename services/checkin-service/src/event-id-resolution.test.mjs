import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOnchainEventId } from "./event-id-resolution.ts";

test("normalizeOnchainEventId keeps numeric onchain ids as-is", () => {
  assert.equal(normalizeOnchainEventId("151127899789448"), "151127899789448");
});

test("normalizeOnchainEventId rejects non-numeric offchain event ids", () => {
  assert.throws(() => normalizeOnchainEventId("evt_jazz_night_2026"), /onchain event id/i);
});
