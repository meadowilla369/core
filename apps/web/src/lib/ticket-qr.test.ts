import assert from "node:assert/strict";
import test from "node:test";

import {
  getTicketQrAgeMs,
  getTicketQrRefreshDelayMs,
  serializeTicketQrPayload
} from "./ticket-qr.ts";

const challengeMessage = {
  tokenId: "42",
  eventId: "1001",
  ownerWallet: "0x00000000000000000000000000000000000000bb" as `0x${string}`,
  gateScope: "event",
  nonce: ("0x" + "11".repeat(32)) as `0x${string}`,
  issuedAt: 1782910000,
  expiresAt: 1782910030
};

test("serializeTicketQrPayload includes the owner-signed typed challenge payload", () => {
  const value = serializeTicketQrPayload({
    domain: {
      name: "EntrCheckIn",
      version: "1",
      chainId: 31337,
      verifyingContract: "0x00000000000000000000000000000000000000aa"
    },
    types: {
      CheckInChallenge: [
        { name: "tokenId", type: "uint256" },
        { name: "eventId", type: "uint256" },
        { name: "ownerWallet", type: "address" },
        { name: "gateScope", type: "string" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
        { name: "expiresAt", type: "uint256" }
      ]
    },
    primaryType: "CheckInChallenge",
    message: {
      ...challengeMessage
    },
    signature: ("0x" + "22".repeat(65)) as `0x${string}`
  });

  assert.deepEqual(JSON.parse(value), {
    type: "entr.ticket.qr.v1",
    domain: {
      name: "EntrCheckIn",
      version: "1",
      chainId: 31337,
      verifyingContract: "0x00000000000000000000000000000000000000aa"
    },
    types: {
      CheckInChallenge: [
        { name: "tokenId", type: "uint256" },
        { name: "eventId", type: "uint256" },
        { name: "ownerWallet", type: "address" },
        { name: "gateScope", type: "string" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
        { name: "expiresAt", type: "uint256" }
      ]
    },
    primaryType: "CheckInChallenge",
    message: {
      ...challengeMessage
    },
    signature: ("0x" + "22".repeat(65)) as `0x${string}`
  });
});

test("getTicketQrRefreshDelayMs refreshes before expiry", () => {
  assert.equal(getTicketQrAgeMs({ message: challengeMessage }, 1782910004_000), 4000);
  assert.equal(
    getTicketQrRefreshDelayMs({ message: challengeMessage }, 1782910004_000),
    21000
  );
});
