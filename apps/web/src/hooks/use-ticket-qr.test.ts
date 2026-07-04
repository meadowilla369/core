import assert from "node:assert/strict";
import test from "node:test";

import { getTicketQrErrorDetails } from "../lib/ticket-qr-errors.ts";

test("getTicketQrErrorDetails surfaces wallet mismatch clearly", () => {
  const result = getTicketQrErrorDetails(
    new Error("Session wallet private key khong khop voi wallet address hien tai")
  );

  assert.equal(result.code, "WALLET_MISMATCH");
  assert.match(result.userMessage, /khong khop/i);
});

test("getTicketQrErrorDetails surfaces missing private key clearly", () => {
  const result = getTicketQrErrorDetails(
    new Error("Session wallet khong co private key. Hay chay lai onboarding.")
  );

  assert.equal(result.code, "MISSING_PRIVATE_KEY");
  assert.match(result.userMessage, /private key/i);
});
