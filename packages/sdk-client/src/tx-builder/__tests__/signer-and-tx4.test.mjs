/**
 * signer-and-tx4.test.mjs
 *
 * Unit tests for:
 *  - MockEOASigner (WalletSigner stub)
 *  - assembleTx4()
 *
 * Usage (from packages/sdk-client/):
 *   node --test src/tx-builder/__tests__/signer-and-tx4.test.mjs
 *
 * The test file imports directly from the compiled dist/ so it always works
 * after the package has been built once (tsc -p tsconfig.json).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.resolve(THIS_DIR, "../../..");

const encoderUrl = pathToFileURL(path.resolve(SDK_ROOT, "dist/tx-builder/encoder.js")).href;
const signerUrl = pathToFileURL(path.resolve(SDK_ROOT, "dist/tx-builder/signer.js")).href;

const { buildAuthorizationTuple, buildEip7702BatchPayload, hashAuthorizationTuple, assembleTx4 } =
  await import(encoderUrl);
const { MockEOASigner } = await import(signerUrl);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HANDLER_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
const EOA_ADDR = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const LEDGER_ADDR = "0x1111111111111111111111111111111111111111";

const tuple = buildAuthorizationTuple({
  chainId: 1n,
  handlerAddress: HANDLER_ADDR,
  nonce: 5n
});
const authHash = hashAuthorizationTuple(tuple);

const MOCK_CALL = {
  target: LEDGER_ADDR,
  value: 0n,
  data: "0x89e1c195" + "aa".repeat(32)
};

// ---------------------------------------------------------------------------
// MockEOASigner
// ---------------------------------------------------------------------------

test("MockEOASigner: returns address set in constructor", () => {
  const signer = new MockEOASigner(EOA_ADDR);
  assert.equal(signer.address, EOA_ADDR);
});

test("MockEOASigner: defaults to mock address when none provided", () => {
  const signer = new MockEOASigner();
  assert.ok(signer.address.startsWith("0x"), "address should be 0x-prefixed");
});

test("MockEOASigner: signAuthorization resolves to a SignedAuthorization", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const signed = await signer.signAuthorization(tuple, authHash);

  assert.equal(signed.chainId, Number(tuple.chainId));
  assert.equal(signed.address, tuple.address);
  assert.equal(signed.nonce, Number(tuple.nonce));
  assert.ok(signed.yParity === 0 || signed.yParity === 1, "yParity must be 0 or 1");
  assert.ok(signed.r.startsWith("0x") && signed.r.length === 66, "r must be 32-byte hex");
  assert.ok(signed.s.startsWith("0x") && signed.s.length === 66, "s must be 32-byte hex");
});

test("MockEOASigner: signAuthorization is deterministic", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const a = await signer.signAuthorization(tuple, authHash);
  const b = await signer.signAuthorization(tuple, authHash);
  assert.equal(a.r, b.r);
  assert.equal(a.s, b.s);
});

test("MockEOASigner: different authorizationHash produces different r", async () => {
  const signer = new MockEOASigner(EOA_ADDR);
  const hashA = hashAuthorizationTuple(
    buildAuthorizationTuple({ chainId: 1n, handlerAddress: HANDLER_ADDR, nonce: 1n })
  );
  const hashB = hashAuthorizationTuple(
    buildAuthorizationTuple({ chainId: 1n, handlerAddress: HANDLER_ADDR, nonce: 2n })
  );
  const a = await signer.signAuthorization(tuple, hashA);
  const b = await signer.signAuthorization(tuple, hashB);
  assert.notEqual(a.r, b.r);
});

// ---------------------------------------------------------------------------
// assembleTx4
// ---------------------------------------------------------------------------

async function makePayload() {
  const signer = new MockEOASigner(EOA_ADDR);
  const signed = await signer.signAuthorization(tuple, authHash);
  return buildEip7702BatchPayload([MOCK_CALL], signed);
}

test("assembleTx4: type is always 4", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.equal(tx4.type, 4);
});

test("assembleTx4: to equals delegated EOA address when from is provided", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.equal(tx4.to, EOA_ADDR);
});

test("assembleTx4: data equals encodedCalldata from payload", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.equal(tx4.data, payload.encodedCalldata);
});

test("assembleTx4: value is 0n", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.equal(tx4.value, 0n);
});

test("assembleTx4: authorizationList is forwarded verbatim", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.deepEqual(tx4.authorizationList, payload.authorizationList);
});

test("assembleTx4: chainId matches authorization tuple", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.equal(tx4.chainId, Number(tuple.chainId));
});

test("assembleTx4: from is set when provided", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.equal(tx4.from, EOA_ADDR);
});

test("assembleTx4: from is undefined when omitted", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload);
  assert.equal(tx4.from, undefined);
  assert.equal(tx4.to, undefined);
});

test("assembleTx4: RPC-dependent fields are undefined (gap is explicit)", async () => {
  const payload = await makePayload();
  const tx4 = assembleTx4(payload, EOA_ADDR);
  assert.equal(tx4.nonce, undefined, "nonce should be undefined until RPC fill");
  assert.equal(tx4.gas, undefined, "gas should be undefined until RPC fill");
  assert.equal(tx4.maxFeePerGas, undefined, "maxFeePerGas should be undefined until RPC fill");
  assert.equal(
    tx4.maxPriorityFeePerGas,
    undefined,
    "maxPriorityFeePerGas should be undefined until RPC fill"
  );
});

test("assembleTx4: throws when authorizationList is empty", () => {
  const emptyPayload = { authorizationList: [], encodedCalldata: "0x", calls: [] };
  assert.throws(() => assembleTx4(emptyPayload, EOA_ADDR), /authorizationList must not be empty/);
});

test("assembleTx4: is deterministic", async () => {
  const payload = await makePayload();
  const a = assembleTx4(payload, EOA_ADDR);
  const b = assembleTx4(payload, EOA_ADDR);
  assert.equal(a.data, b.data);
  assert.equal(a.to, b.to);
  assert.equal(a.chainId, b.chainId);
});
