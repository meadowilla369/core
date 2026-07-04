import assert from "node:assert/strict";
import test from "node:test";

import { resolveQrTicket } from "./qr-ownership.ts";

test("resolveQrTicket uses synced token ownership as QR source", () => {
  const result = resolveQrTicket({
    tokenId: "2",
    ownerWalletAddress: "0xc7b33c679277fb538205e13e832c1fa354c7f462",
    ticketingTicket: null,
    syncedToken: {
      tokenId: "2",
      eventId: "1",
      onchainEventId: "44",
      ownerWalletAddress: "0xC7B33C679277fb538205e13e832c1Fa354c7F462",
      ownerUserId: null,
      isRefunded: false
    }
  });

  assert.deepEqual(result, {
    tokenId: "2",
    onchainEventId: "44",
    walletAddress: "0xC7B33C679277fb538205e13e832c1Fa354c7F462"
  });
});

test("resolveQrTicket rejects ticketing-only ownership", () => {
  const result = resolveQrTicket({
    tokenId: "db_only",
    ownerWalletAddress: "0xc7b33c679277fb538205e13e832c1fa354c7f462",
    ticketingTicket: {
      tokenId: "db_only",
      eventId: "evt_rockfest_2026",
      ownerUserId: "buyer_1"
    },
    syncedToken: null
  });

  assert.equal(result, null);
});

test("resolveQrTicket rejects wallet mismatches", () => {
  const result = resolveQrTicket({
    tokenId: "2",
    ownerWalletAddress: "0xother",
    ticketingTicket: null,
    syncedToken: {
      tokenId: "2",
      eventId: "1",
      onchainEventId: "44",
      ownerWalletAddress: "0xC7B33C679277fb538205e13e832c1Fa354c7F462",
      ownerUserId: null,
      isRefunded: false
    }
  });

  assert.equal(result, null);
});
