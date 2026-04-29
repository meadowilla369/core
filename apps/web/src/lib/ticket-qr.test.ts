import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalTicketQrPayload,
  getTicketQrAgeMs,
  getTicketQrRefreshDelayMs,
  serializeTicketQrPayload
} from "./ticket-qr.ts";

test("serializeTicketQrPayload includes all scanner fields", () => {
  const value = serializeTicketQrPayload({
    tokenId: "42",
    eventId: "evt_1",
    timestamp: 1000,
    nonce: "nonce_1",
    walletAddress: "0xabc",
    signature: "sig",
    source: "backend"
  });

  assert.deepEqual(JSON.parse(value), {
    type: "entr.ticket.qr.v1",
    tokenId: "42",
    eventId: "evt_1",
    timestamp: 1000,
    nonce: "nonce_1",
    walletAddress: "0xabc",
    signature: "sig",
    source: "backend"
  });
});

test("buildLocalTicketQrPayload marks local QR clearly", () => {
  const payload = buildLocalTicketQrPayload({
    tokenId: "42",
    eventId: "evt_1",
    walletAddress: "0xabc",
    nowMs: 1000
  });

  assert.equal(payload.source, "local");
  assert.equal(payload.nonce, "local:42:1000");
  assert.equal(payload.signature.startsWith("local:"), true);
});

test("getTicketQrRefreshDelayMs refreshes before expiry", () => {
  assert.equal(getTicketQrAgeMs({ timestamp: 1000 }, 4000), 3000);
  assert.equal(getTicketQrRefreshDelayMs({ timestamp: 1000 }, 4000, 30000), 22000);
});
