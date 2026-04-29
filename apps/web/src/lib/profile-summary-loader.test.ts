import assert from "node:assert/strict";
import test from "node:test";

import { loadProfileSummary } from "./profile-summary-loader.ts";

test("loadProfileSummary keeps real profile identity when ticketing and event lookup are partially unavailable", async () => {
  const result = await loadProfileSummary({
    client: {
      getMyProfile: async () => ({
        success: true,
        data: {
          id: "buyer_1",
          phoneNumber: "+84901234567",
          fullName: "Tran Minh",
          email: "minh@example.com",
          emailVerified: false,
          kycStatus: "pending",
          isFrozen: false,
          createdAt: "2026-04-29T00:00:00.000Z",
          updatedAt: "2026-04-29T00:00:00.000Z"
        }
      }),
      getMyTickets: async () => {
        throw new Error("ticketing unavailable");
      },
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
        throw new Error("event unavailable");
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
        transactionHash: "0xabc",
        source: "primary-purchase",
        createdAt: "2026-04-29T00:00:00.000Z"
      }
    ]
  });

  assert.equal(result.displayName, "Tran Minh");
  assert.equal(result.email, "minh@example.com");
  assert.equal(result.avatarInitials, "TM");
  assert.equal(result.attendedEvents, 1);
  assert.equal(result.upcomingEvents, 0);
  assert.equal(result.spendSummary, "0₫");
});
