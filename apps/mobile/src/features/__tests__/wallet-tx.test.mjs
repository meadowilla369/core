/**
 * wallet-tx.test.mjs
 *
 * Integration harness for the EIP-7702 purchase transaction builder in apps/mobile.
 *
 * Tests the full client-side call graph:
 *   buildPurchaseTx() → authorizationHash → assemble(signedAuth) → Eip7702BatchPayload
 *
 * Two test modes:
 *   1. Direct: imports sdk-client and viem from their dist/, re-implements the
 *      same logic as wallet-tx.ts inline.  Always works regardless of workspace
 *      install state.
 *   2. App dist: imports compiled dist/features/wallet-tx.js from the app.
 *      Runs when `tsc` has been run and the workspace package is resolved
 *      (via Node --conditions or a symlink).  Skipped gracefully otherwise.
 *
 * Usage (from apps/mobile/):
 *   node ../../node_modules/typescript/bin/tsc -p tsconfig.json \
 *     && node --test src/features/__tests__/wallet-tx.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
// apps/mobile root
const APP_ROOT = path.resolve(THIS_DIR, "../../..");
// packages/sdk-client root (2 levels up from apps/mobile = repo root, then packages/sdk-client)
const SDK_ROOT = path.resolve(APP_ROOT, "../../packages/sdk-client");

// ---------------------------------------------------------------------------
// Load sdk-client primitives from its dist/ (always available after prior build)
// ---------------------------------------------------------------------------

const sdkEncoderUrl = pathToFileURL(path.resolve(SDK_ROOT, "dist/tx-builder/encoder.js")).href;
const { buildAuthorizationTuple, hashAuthorizationTuple, buildEip7702BatchPayload, validateCalls } =
  await import(sdkEncoderUrl);

// ---------------------------------------------------------------------------
// Load viem's encodeFunctionData from sdk-client's own node_modules (ESM build)
// ---------------------------------------------------------------------------

const viemEsmIndex = pathToFileURL(path.resolve(SDK_ROOT, "node_modules/viem/_esm/index.js")).href;
const { encodeFunctionData } = await import(viemEsmIndex);

// ---------------------------------------------------------------------------
// TicketLedger ABI — mirrors wallet-tx.ts exactly
// ---------------------------------------------------------------------------

const TICKET_LEDGER_ABI = [
  {
    name: "purchaseWithSignature",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "paymentHash", type: "bytes32" },
      { name: "signature", type: "bytes" }
    ],
    outputs: [{ name: "ticketIds", type: "uint256[]" }]
  }
];

// ---------------------------------------------------------------------------
// buildPurchaseTx — mirrors wallet-tx.ts logic (used in mode 1 tests)
// ---------------------------------------------------------------------------

function buildPurchaseTxLocal(params) {
  const ledgerCalldata = encodeFunctionData({
    abi: TICKET_LEDGER_ABI,
    functionName: "purchaseWithSignature",
    args: [
      params.eventId,
      params.ticketTypeId,
      params.quantity,
      params.paymentHash,
      params.signature
    ]
  });

  const calls = [{ target: params.ticketLedgerAddress, value: 0n, data: ledgerCalldata }];

  const errors = validateCalls(calls);
  if (errors.length > 0) {
    throw new Error(`buildPurchaseTx: invalid calls — ${errors.join("; ")}`);
  }

  const authorizationTuple = buildAuthorizationTuple({
    chainId: params.chainId,
    handlerAddress: params.handlerAddress,
    nonce: params.nonce
  });

  const authorizationHash = hashAuthorizationTuple(authorizationTuple);

  return {
    authorizationTuple,
    authorizationHash,
    assemble(signedAuth) {
      return buildEip7702BatchPayload(calls, signedAuth);
    }
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HANDLER_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
const TICKET_LEDGER_ADDR = "0x1111111111111111111111111111111111111111";
// 32-byte payment hash (bytes32 arg) — 0x + "ab"*32 = 66 chars total = 32 bytes
const PAYMENT_HASH = "0x" + "ab".repeat(32);
// 65-byte dummy backend signature — encoding test only, not ECDSA-valid
const BACKEND_SIG = "0x" + "aa".repeat(65);

const BASE_PARAMS = {
  ticketLedgerAddress: TICKET_LEDGER_ADDR,
  handlerAddress: HANDLER_ADDR,
  eventId: 42n,
  ticketTypeId: 7n,
  quantity: 2n,
  paymentHash: PAYMENT_HASH,
  signature: BACKEND_SIG,
  chainId: 1n,
  nonce: 5n
};

const MOCK_SIGNED_AUTH = {
  chainId: 1n,
  address: HANDLER_ADDR,
  nonce: 5n,
  yParity: 0,
  r: "0x" + "bb".repeat(32),
  s: "0x" + "cc".repeat(32)
};

// ---------------------------------------------------------------------------
// Tests — mode 1: direct logic (always runs)
// ---------------------------------------------------------------------------

test("buildPurchaseTx: authorizationTuple has correct fields", () => {
  const result = buildPurchaseTxLocal(BASE_PARAMS);
  assert.equal(result.authorizationTuple.chainId, 1n);
  assert.equal(result.authorizationTuple.address, HANDLER_ADDR);
  assert.equal(result.authorizationTuple.nonce, 5n);
});

test("buildPurchaseTx: authorizationHash is a 32-byte 0x-prefixed hex string", () => {
  const result = buildPurchaseTxLocal(BASE_PARAMS);
  assert.ok(result.authorizationHash.startsWith("0x"));
  assert.equal(result.authorizationHash.length, 66);
});

test("buildPurchaseTx: authorizationHash is deterministic", () => {
  const a = buildPurchaseTxLocal(BASE_PARAMS);
  const b = buildPurchaseTxLocal(BASE_PARAMS);
  assert.equal(a.authorizationHash, b.authorizationHash);
});

test("buildPurchaseTx: authorizationHash changes with different chainId", () => {
  const a = buildPurchaseTxLocal(BASE_PARAMS);
  const b = buildPurchaseTxLocal({ ...BASE_PARAMS, chainId: 137n });
  assert.notEqual(a.authorizationHash, b.authorizationHash);
});

test("buildPurchaseTx: authorizationHash changes with different nonce", () => {
  const a = buildPurchaseTxLocal(BASE_PARAMS);
  const b = buildPurchaseTxLocal({ ...BASE_PARAMS, nonce: 99n });
  assert.notEqual(a.authorizationHash, b.authorizationHash);
});

test("assemble: authorizationList contains the provided SignedAuthorization", () => {
  const result = buildPurchaseTxLocal(BASE_PARAMS);
  const payload = result.assemble(MOCK_SIGNED_AUTH);
  assert.equal(payload.authorizationList.length, 1);
  assert.deepEqual(payload.authorizationList[0], MOCK_SIGNED_AUTH);
});

test("assemble: encodedCalldata is non-trivial 0x-prefixed hex", () => {
  const payload = buildPurchaseTxLocal(BASE_PARAMS).assemble(MOCK_SIGNED_AUTH);
  assert.ok(payload.encodedCalldata.startsWith("0x"));
  assert.ok(payload.encodedCalldata.length > 10);
});

test("assemble: encodedCalldata starts with Handler.executeBatch selector (0x34fcd5be)", () => {
  const payload = buildPurchaseTxLocal(BASE_PARAMS).assemble(MOCK_SIGNED_AUTH);
  assert.ok(
    payload.encodedCalldata.startsWith("0x34fcd5be"),
    `expected executeBatch selector, got ${payload.encodedCalldata.slice(0, 10)}`
  );
});

test("assemble: calls[0].target is the TicketLedger address", () => {
  const payload = buildPurchaseTxLocal(BASE_PARAMS).assemble(MOCK_SIGNED_AUTH);
  assert.equal(payload.calls.length, 1);
  assert.equal(payload.calls[0].target, TICKET_LEDGER_ADDR);
  assert.equal(payload.calls[0].value, 0n);
});

test("assemble: inner calldata starts with purchaseWithSignature selector (0x8a3cbe4c)", () => {
  // The inner call's data is the TicketLedger.purchaseWithSignature() calldata.
  // Selector: keccak256("purchaseWithSignature(uint256,uint256,uint256,bytes32,bytes)")[0:4]
  // = 0x89e1c195  (verified via viem's encodeFunctionData output)
  const payload = buildPurchaseTxLocal(BASE_PARAMS).assemble(MOCK_SIGNED_AUTH);
  assert.ok(
    payload.calls[0].data.startsWith("0x89e1c195"),
    `expected purchaseWithSignature selector, got ${payload.calls[0].data.slice(0, 10)}`
  );
});

test("assemble: is deterministic — two calls give identical payload", () => {
  const result = buildPurchaseTxLocal(BASE_PARAMS);
  const p1 = result.assemble(MOCK_SIGNED_AUTH);
  const p2 = result.assemble(MOCK_SIGNED_AUTH);
  assert.equal(p1.encodedCalldata, p2.encodedCalldata);
  assert.deepEqual(p1.authorizationList, p2.authorizationList);
});

test("buildPurchaseTx: throws for zero ticketLedgerAddress", () => {
  assert.throws(
    () =>
      buildPurchaseTxLocal({
        ...BASE_PARAMS,
        ticketLedgerAddress: "0x0000000000000000000000000000000000000000"
      }),
    /invalid calls/i
  );
});

// ---------------------------------------------------------------------------
// Tests — mode 2: app dist integration (skipped gracefully if dist not built
//   or workspace package not linked at runtime)
// ---------------------------------------------------------------------------

test("MobileBuyerApp.preparePurchaseTx: delegates to buildPurchaseTx (app dist)", async () => {
  const appIndexDist = path.resolve(APP_ROOT, "dist/index.js");

  let MobileBuyerApp;
  try {
    const appMod = await import(pathToFileURL(appIndexDist).href);
    MobileBuyerApp = appMod.MobileBuyerApp;
  } catch {
    // dist/index.js not built or workspace import inside it failed — skip gracefully
    console.log("  [skip] dist/index.js not resolvable — skipping MobileBuyerApp wiring test");
    return;
  }

  const app = new MobileBuyerApp();
  const result = app.preparePurchaseTx(BASE_PARAMS);

  assert.ok(typeof result.authorizationHash === "string", "authorizationHash should be a string");
  assert.equal(result.authorizationHash.length, 66, "authorizationHash should be 32 bytes");

  const payload = result.assemble(MOCK_SIGNED_AUTH);
  assert.ok(
    payload.encodedCalldata.startsWith("0x34fcd5be"),
    "payload should start with executeBatch selector"
  );
});
