import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCheckInTypedData,
  CHECKIN_EIP712_DOMAIN_NAME,
  CHECKIN_EIP712_DOMAIN_VERSION
} from "../dist/checkin-typed-data.js";

test("buildCheckInTypedData returns EntrCheckIn typed data with TicketLedger domain", () => {
  const typed = buildCheckInTypedData({
    chainId: 31337,
    verifyingContract: "0x00000000000000000000000000000000000000aa",
    tokenId: "42",
    eventId: "1001",
    ownerWallet: "0x00000000000000000000000000000000000000bb",
    gateScope: "event",
    nonce: "0x" + "11".repeat(32),
    issuedAt: 1782910000,
    expiresAt: 1782910030
  });

  assert.equal(typed.domain.name, CHECKIN_EIP712_DOMAIN_NAME);
  assert.equal(typed.domain.version, CHECKIN_EIP712_DOMAIN_VERSION);
  assert.equal(typed.domain.chainId, 31337);
  assert.equal(typed.domain.verifyingContract, "0x00000000000000000000000000000000000000aa");
  assert.equal(typed.primaryType, "CheckInChallenge");
  assert.equal(typed.message.tokenId, "42");
  assert.equal(typed.message.eventId, "1001");
});
