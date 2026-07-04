import assert from "node:assert/strict";
import test from "node:test";

import { privateKeyToAccount } from "viem/accounts";

import { buildSignedCheckInPayload, verifySignedCheckInPayload } from "./checkin-typed-data.ts";

const ownerPrivateKey = "0x59c6995e998f97a5a0044976f7d7b5d0f9d4c59b1c7a6f5f5d5d7f3a7b6c1234";
const ownerAccount = privateKeyToAccount(ownerPrivateKey);

async function createSignedPayload(overrides = {}) {
  const base = {
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
      tokenId: "42",
      eventId: "1001",
      ownerWallet: ownerAccount.address,
      gateScope: "event",
      nonce: "0x" + "11".repeat(32),
      issuedAt: 1782910000,
      expiresAt: 1782910030
    },
    ...overrides
  };

  const signature = await ownerAccount.signTypedData({
    domain: base.domain,
    types: base.types,
    primaryType: "CheckInChallenge",
    message: base.message
  });

  return buildSignedCheckInPayload(base, signature);
}

test("verifySignedCheckInPayload accepts a valid owner-signed challenge", async () => {
  const payload = await createSignedPayload();
  const result = await verifySignedCheckInPayload(
    {
      chainId: 31337,
      ticketLedgerAddress: "0x00000000000000000000000000000000000000aa",
      maxClockSkewSec: 10
    },
    payload,
    1782910010_000
  );

  assert.equal(result.valid, true);
  assert.equal(result.message.tokenId, "42");
});

test("verifySignedCheckInPayload rejects signature/domain mismatch", async () => {
  const payload = await createSignedPayload();
  const result = await verifySignedCheckInPayload(
    {
      chainId: 84532,
      ticketLedgerAddress: "0x00000000000000000000000000000000000000aa",
      maxClockSkewSec: 10
    },
    payload,
    1782910010_000
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "SIGNATURE_INVALID");
});

test("verifySignedCheckInPayload rejects expired challenges", async () => {
  const payload = await createSignedPayload();
  const result = await verifySignedCheckInPayload(
    {
      chainId: 31337,
      ticketLedgerAddress: "0x00000000000000000000000000000000000000aa",
      maxClockSkewSec: 10
    },
    payload,
    1782910045_000
  );

  assert.equal(result.valid, false);
  assert.equal(result.reason, "QR_EXPIRED");
});
