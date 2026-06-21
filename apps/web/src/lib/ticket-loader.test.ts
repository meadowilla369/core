import assert from "node:assert/strict";
import test from "node:test";

import { findTicketByTokenId, loadMyTicketCards } from "./ticket-loader.ts";

test("loadMyTicketCards returns synced tickets when ticketing DB and event lookup are unavailable", async () => {
  const result = await loadMyTicketCards({
    client: {
      listSyncedTokens: async () => ({
        success: true,
        data: [
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
        ]
      }),
      getEvent: async () => {
        throw new Error("event not found");
      }
    },
    userId: "buyer_1",
    walletAddress: "0xBuyer",
    cachedTickets: [
      {
        tokenId: "42",
        eventId: "evt_rockfest_2026",
        ticketTypeId: "tt_vip",
        ownerUserId: "buyer_1",
        ownerWalletAddress: "0xbuyer",
        createdAt: "2026-04-29T00:00:00.000Z"
      }
    ]
  });

  assert.equal(result.status, "partial");
  assert.equal(result.tickets[0].source, "contract-sync");
  assert.equal(result.tickets[0].tokenId, "42");
  assert.equal(result.tickets[0].ownerWalletAddress, "0xbuyer");
  assert.equal(result.tickets[0].syncStatus, "partial");
  assert.equal(result.tickets[0].transactionHash, "0xabc");
  assert.deepEqual(result.upcoming, [
    {
      id: "42",
      tokenId: "42",
      eventId: "evt_rockfest_2026",
      eventName: "evt_rockfest_2026",
      date: "Dang cap nhat",
      time: "--:--",
      location: "Primary purchase",
      ticketType: "tt_vip",
      qrCode: "42",
      ownerUserId: "buyer_1",
      ownerWalletAddress: "0xbuyer",
      seatInfo: "Primary purchase",
      reservationId: "sync_42",
      createdAt: "2026-04-29T00:00:00.000Z",
      source: "contract-sync",
      syncStatus: "partial",
      transactionHash: "0xabc",
      listingStatus: "none",
      isUsed: false,
      originalPrice: undefined
    }
  ]);
  assert.deepEqual(result.past, []);
  assert.deepEqual(result.tickets, result.upcoming);
  assert.equal(findTicketByTokenId(result.tickets, "42")?.eventId, "evt_rockfest_2026");
  assert.equal(findTicketByTokenId(result.tickets, "missing"), null);
});
