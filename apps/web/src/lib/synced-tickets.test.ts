import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeTicketRecords,
  savePurchasedTicketMetadata,
  loadPurchasedTicketMetadata
} from "./synced-tickets.ts";

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    }
  };
};

test("savePurchasedTicketMetadata stores the app event and tier for a purchased token", () => {
  const localStorage = storage();

  savePurchasedTicketMetadata(
    {
      tokenId: "42",
      eventId: "evt_rockfest_2026",
      ticketTypeId: "tt_vip",
      ownerUserId: "buyer_1",
      ownerWalletAddress: "0xBuyer",
      transactionHash: "0xabc",
      source: "primary-purchase",
      createdAt: "2026-04-29T00:00:00.000Z"
    },
    localStorage
  );

  assert.deepEqual(loadPurchasedTicketMetadata(localStorage), [
    {
      tokenId: "42",
      eventId: "evt_rockfest_2026",
      ticketTypeId: "tt_vip",
      ownerUserId: "buyer_1",
      ownerWalletAddress: "0xbuyer",
      transactionHash: "0xabc",
      source: "primary-purchase",
      createdAt: "2026-04-29T00:00:00.000Z"
    }
  ]);
});

test("mergeTicketRecords uses local purchase metadata to map synced on-chain tokens to app event ids", () => {
  const tickets = mergeTicketRecords({
    syncedTokens: [
      {
        tokenId: "42",
        eventId: "1",
        sourceListingId: null,
        ownerWalletAddress: "0xBuyer",
        ownerUserId: null,
        listingStatus: "none",
        isUsed: false,
        isRefunded: false,
        usedAt: null,
        refundedAt: null,
        lastEventName: "Transfer",
        lastTransactionHash: "0xabc",
        lastLogIndex: 0,
        lastSyncedBlock: 1,
        updatedAt: "2026-04-29T00:00:00.000Z"
      }
    ],
    cachedTickets: [
      {
        tokenId: "42",
        eventId: "evt_rockfest_2026",
        ticketTypeId: "tt_vip",
        ownerUserId: "buyer_1",
        ownerWalletAddress: "0xbuyer",
        transactionHash: "0xabc",
        source: "primary-purchase",
        createdAt: "2026-04-29T00:00:00.000Z"
      }
    ],
    userId: "buyer_1",
    walletAddress: "0xBuyer"
  });

  assert.deepEqual(tickets, [
    {
      tokenId: "42",
      eventId: "evt_rockfest_2026",
      ticketTypeId: "tt_vip",
      ownerUserId: "buyer_1",
      ownerWalletAddress: "0xbuyer",
      seatInfo: "Primary purchase",
      reservationId: "sync_42",
      source: "contract-sync",
      transactionHash: "0xabc",
      createdAt: "2026-04-29T00:00:00.000Z",
      listingStatus: "none",
      isUsed: false,
      originalPrice: undefined
    }
  ]);
});

test("mergeTicketRecords does not treat local cache as ticket ownership", () => {
  const tickets = mergeTicketRecords({
    syncedTokens: [],
    cachedTickets: [
      {
        tokenId: "stale",
        eventId: "evt_rockfest_2026",
        ticketTypeId: "tt_vip",
        ownerUserId: "buyer_1",
        ownerWalletAddress: "0xbuyer",
        transactionHash: "0xabc",
        source: "primary-purchase",
        createdAt: "2026-04-29T00:00:00.000Z"
      }
    ],
    userId: "buyer_1",
    walletAddress: "0xBuyer"
  });

  assert.deepEqual(tickets, []);
});

