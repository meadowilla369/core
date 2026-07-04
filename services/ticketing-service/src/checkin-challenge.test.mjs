import assert from "node:assert/strict";
import test from "node:test";

import { createCheckInChallenge } from "./checkin-challenge.ts";

test("createCheckInChallenge builds EntrCheckIn typed data for a resolved ticket", () => {
  const result = createCheckInChallenge(
    {
      checkinChainId: 31337,
      ticketLedgerAddress: "0x00000000000000000000000000000000000000aa"
    },
    {
      tokenId: "42",
      onchainEventId: "1001",
      walletAddress: "0x00000000000000000000000000000000000000bb"
    },
    {
      nonce: "0x" + "11".repeat(32),
      issuedAt: 1782910000,
      expiresAt: 1782910030
    }
  );

  assert.equal(result.domain.name, "EntrCheckIn");
  assert.equal(result.domain.version, "1");
  assert.equal(result.domain.chainId, 31337);
  assert.equal(result.domain.verifyingContract, "0x00000000000000000000000000000000000000aa");
  assert.equal(result.primaryType, "CheckInChallenge");
  assert.equal(result.message.tokenId, "42");
  assert.equal(result.message.eventId, "1001");
  assert.equal(result.message.ownerWallet, "0x00000000000000000000000000000000000000bb");
  assert.equal(result.message.gateScope, "event");
  assert.equal(result.message.nonce, "0x" + "11".repeat(32));
  assert.equal(result.message.issuedAt, 1782910000);
  assert.equal(result.message.expiresAt, 1782910030);
});

test("createCheckInChallenge requires onchain event id for uint256 eventId field", () => {
  assert.throws(
    () =>
      createCheckInChallenge(
        {
          checkinChainId: 31337,
          ticketLedgerAddress: "0x00000000000000000000000000000000000000aa"
        },
        {
          tokenId: "42",
          onchainEventId: "evt_jazz_night_2026",
          walletAddress: "0x00000000000000000000000000000000000000bb"
        },
        {
          nonce: "0x" + "11".repeat(32),
          issuedAt: 1782910000,
          expiresAt: 1782910030
        }
      ),
    /onchain event id/i
  );
});
