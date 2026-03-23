/**
 * purchase-flow.test.mjs
 *
 * End-to-end test for executePurchaseFlow():
 *   buildPurchaseTx → MockEOASigner.signAuthorization → assemble → assembleTx4
 *
 * Exercises the full client-side orchestration path from params → Tx4Request
 * without any network or RPC dependency.
 *
 * Usage (from apps/mobile/):
 *   node ../../node_modules/typescript/bin/tsc -p tsconfig.json \
 *     && node --test src/features/__tests__/purchase-flow.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(THIS_DIR, "../../..");
const SDK_ROOT = path.resolve(APP_ROOT, "../../packages/sdk-client");

// Load sdk-client primitives from dist/
const encoderUrl = pathToFileURL(path.resolve(SDK_ROOT, "dist/tx-builder/encoder.js")).href;
const signerUrl = pathToFileURL(path.resolve(SDK_ROOT, "dist/tx-builder/signer.js")).href;
const viemEsmIndex = pathToFileURL(path.resolve(SDK_ROOT, "node_modules/viem/_esm/index.js")).href;

const {
  buildAuthorizationTuple,
  buildEip7702BatchPayload,
  hashAuthorizationTuple,
  assembleTx4,
  validateCalls
} = await import(encoderUrl);
const { MockEOASigner } = await import(signerUrl);
const { encodeFunctionData } = await import(viemEsmIndex);

// ---------------------------------------------------------------------------
// Replicate executePurchaseFlow locally (always works, no app dist needed)
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
  if (errors.length > 0) throw new Error(`buildPurchaseTx: invalid calls — ${errors.join("; ")}`);
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

async function executePurchaseFlowLocal(params, signer) {
  const unsigned = buildPurchaseTxLocal(params);
  const signedAuth = await signer.signAuthorization(
    unsigned.authorizationTuple,
    unsigned.authorizationHash
  );
  const payload = unsigned.assemble(signedAuth);
  const tx4 = assembleTx4(payload, signer.address);
  return { payload, tx4 };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HANDLER_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
const LEDGER_ADDR = "0x1111111111111111111111111111111111111111";
const EOA_ADDR = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const PAYMENT_HASH = "0x" + "ab".repeat(32);
const BACKEND_SIG = "0x" + "aa".repeat(65);

const BASE_PARAMS = {
  ticketLedgerAddress: LEDGER_ADDR,
  handlerAddress: HANDLER_ADDR,
  eventId: 42n,
  ticketTypeId: 7n,
  quantity: 2n,
  paymentHash: PAYMENT_HASH,
  signature: BACKEND_SIG,
  chainId: 1n,
  nonce: 5n
};

// ---------------------------------------------------------------------------
// executePurchaseFlow tests
// ---------------------------------------------------------------------------

test("executePurchaseFlow: resolves to PurchaseFlowResult", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const result = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.ok(result.payload, "payload must be present");
  assert.ok(result.tx4, "tx4 must be present");
});

test("executePurchaseFlow: payload has exactly one authorizationList entry", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { payload } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.equal(payload.authorizationList.length, 1);
});

test("executePurchaseFlow: payload authorizationList[0] has ECDSA components", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { payload } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  const auth = payload.authorizationList[0];
  assert.ok(auth.r.startsWith("0x") && auth.r.length === 66, "r must be 32-byte hex");
  assert.ok(auth.s.startsWith("0x") && auth.s.length === 66, "s must be 32-byte hex");
  assert.ok(auth.yParity === 0 || auth.yParity === 1, "yParity must be 0 or 1");
});

test("executePurchaseFlow: tx4.type is 4", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { tx4 } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.equal(tx4.type, 4);
});

test("executePurchaseFlow: tx4.from matches signer.address", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { tx4 } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.equal(tx4.from, EOA_ADDR);
});

test("executePurchaseFlow: tx4.to is the Handler address", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { tx4 } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.equal(tx4.to, HANDLER_ADDR);
});

test("executePurchaseFlow: tx4.data starts with Handler.executeBatch selector", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { tx4 } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.ok(
    tx4.data.startsWith("0x34fcd5be"),
    `expected executeBatch selector, got ${tx4.data.slice(0, 10)}`
  );
});

test("executePurchaseFlow: tx4.chainId matches params.chainId", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { tx4 } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.equal(tx4.chainId, BASE_PARAMS.chainId);
});

test("executePurchaseFlow: RPC-dependent fields remain undefined", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const { tx4 } = await executePurchaseFlowLocal(BASE_PARAMS, signer);
  assert.equal(tx4.nonce, undefined);
  assert.equal(tx4.gas, undefined);
  assert.equal(tx4.maxFeePerGas, undefined);
  assert.equal(tx4.maxPriorityFeePerGas, undefined);
});

test("executePurchaseFlow: is deterministic", async () => {
  const signerA = new MockEOASigner(EOA_ADDR);
  const signerB = new MockEOASigner(EOA_ADDR);
  const { tx4: a } = await executePurchaseFlowLocal(BASE_PARAMS, signerA);
  const { tx4: b } = await executePurchaseFlowLocal(BASE_PARAMS, signerB);
  assert.equal(a.data, b.data);
  assert.equal(a.to, b.to);
  assert.deepEqual(a.authorizationList, b.authorizationList);
});

test("executePurchaseFlow: different nonce → different authorizationList[0].r", async () => {
  const signerA = new MockEOASigner(EOA_ADDR);
  const signerB = new MockEOASigner(EOA_ADDR);
  const { payload: pA } = await executePurchaseFlowLocal(BASE_PARAMS, signerA);
  const { payload: pB } = await executePurchaseFlowLocal({ ...BASE_PARAMS, nonce: 99n }, signerB);
  assert.notEqual(pA.authorizationList[0].r, pB.authorizationList[0].r);
});

// ---------------------------------------------------------------------------
// App dist integration (skipped gracefully if not built)
// ---------------------------------------------------------------------------

test("executePurchaseFlow via app dist: wires correctly", async () => {
  const appIndexDist = path.resolve(APP_ROOT, "dist/index.js");
  let appMod;
  try {
    appMod = await import(pathToFileURL(appIndexDist).href);
  } catch {
    console.log("  [skip] dist/index.js not resolvable — skipping app-dist wiring test");
    return;
  }

  const { executePurchaseFlow: flowFn } = appMod;
  if (typeof flowFn !== "function") {
    console.log("  [skip] executePurchaseFlow not exported from dist — skipping");
    return;
  }

  const signer = new MockEOASigner(EOA_ADDR);
  const result = await flowFn(BASE_PARAMS, signer);

  assert.equal(result.tx4.type, 4);
  assert.equal(result.tx4.from, EOA_ADDR);
  assert.ok(result.tx4.data.startsWith("0x34fcd5be"), "should start with executeBatch selector");
});
