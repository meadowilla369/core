/**
 * encoder.test.mjs
 *
 * Unit tests for the EIP-7702 tx-builder encoder.
 * Imports from compiled dist/ — run tsc first.
 *
 * Usage (from packages/sdk-client/):
 *   node ../../node_modules/typescript/bin/tsc -p tsconfig.json \
 *     && node --test src/tx-builder/__tests__/encoder.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(THIS_DIR, "../../..");

const {
  encodeExecuteBatch,
  hashAuthorizationTuple,
  buildAuthorizationTuple,
  buildEip7702BatchPayload,
  validateCalls
} = await import(pathToFileURL(path.resolve(PKG_ROOT, "dist/tx-builder/encoder.js")).href);

// ---------------------------------------------------------------------------
// Fixtures — addresses must be EIP-55 checksummed; viem rejects lowercase ones.
// ---------------------------------------------------------------------------

// keccak256-checksummed forms of the test addresses:
const HANDLER_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
const TARGET_ADDR = "0x1234567890123456789012345678901234567890"; // all-numeric, invariant
const PAYMASTER = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";

const singleCall = {
  target: TARGET_ADDR,
  value: 0n,
  data: "0xabcdef01"
};

const twoCallBatch = [
  { target: TARGET_ADDR, value: 0n, data: "0xabcdef01" },
  { target: PAYMASTER, value: 1000000000000000n, data: "0x" }
];

// ---------------------------------------------------------------------------
// encodeExecuteBatch
// ---------------------------------------------------------------------------

test("encodeExecuteBatch: returns 0x-prefixed hex string", () => {
  const result = encodeExecuteBatch([singleCall]);
  assert.ok(result.startsWith("0x"), `expected 0x prefix, got: ${result.slice(0, 10)}`);
});

test("encodeExecuteBatch: includes executeBatch 4-byte selector (0x34fcd5be)", () => {
  // keccak256("executeBatch((address,uint256,bytes)[])") = 0x34fcd5be
  const result = encodeExecuteBatch([singleCall]);
  assert.ok(
    result.toLowerCase().startsWith("0x34fcd5be"),
    `expected selector 0x34fcd5be, got: ${result.slice(0, 10)}`
  );
});

test("encodeExecuteBatch: deterministic — same calls produce same output", () => {
  const a = encodeExecuteBatch([singleCall]);
  const b = encodeExecuteBatch([singleCall]);
  assert.equal(a, b);
});

test("encodeExecuteBatch: two-call batch is longer than one-call batch", () => {
  const one = encodeExecuteBatch([singleCall]);
  const two = encodeExecuteBatch(twoCallBatch);
  assert.ok(two.length > one.length, "2-call batch should encode to more bytes");
});

test("encodeExecuteBatch: throws on empty calls array", () => {
  assert.throws(() => encodeExecuteBatch([]), /non-empty/i);
});

test("encodeExecuteBatch: encodes call with ETH value correctly (value > 0)", () => {
  const callWithValue = { target: TARGET_ADDR, value: 1_000_000_000_000_000n, data: "0x" };
  const result = encodeExecuteBatch([callWithValue]);
  assert.ok(result.startsWith("0x"));
  // 0x038D7EA4C68000 = 1_000_000_000_000_000 in hex
  assert.ok(result.toLowerCase().includes("38d7ea4c68000"), "expected ETH value in calldata");
});

// ---------------------------------------------------------------------------
// validateCalls
// ---------------------------------------------------------------------------

test("validateCalls: valid call returns empty errors", () => {
  const errors = validateCalls([singleCall]);
  assert.deepEqual(errors, []);
});

test("validateCalls: empty array returns error", () => {
  const errors = validateCalls([]);
  assert.ok(errors.length > 0);
  assert.ok(errors[0].includes("at least one"));
});

test("validateCalls: zero address target returns error", () => {
  const bad = { target: "0x0000000000000000000000000000000000000000", value: 0n, data: "0x" };
  const errors = validateCalls([bad]);
  assert.ok(errors.some((e) => e.includes("target")));
});

test("validateCalls: data without 0x prefix returns error", () => {
  const bad = { target: TARGET_ADDR, value: 0n, data: "abcdef" };
  const errors = validateCalls([bad]);
  assert.ok(errors.some((e) => e.includes("data")));
});

// ---------------------------------------------------------------------------
// buildAuthorizationTuple
// ---------------------------------------------------------------------------

test("buildAuthorizationTuple: converts number chainId to bigint", () => {
  const tuple = buildAuthorizationTuple({ chainId: 1, handlerAddress: HANDLER_ADDR, nonce: 5 });
  assert.equal(typeof tuple.chainId, "bigint");
  assert.equal(tuple.chainId, 1n);
});

test("buildAuthorizationTuple: converts number nonce to bigint", () => {
  const tuple = buildAuthorizationTuple({ chainId: 1n, handlerAddress: HANDLER_ADDR, nonce: 5 });
  assert.equal(typeof tuple.nonce, "bigint");
  assert.equal(tuple.nonce, 5n);
});

test("buildAuthorizationTuple: sets address field to handlerAddress", () => {
  const tuple = buildAuthorizationTuple({ chainId: 1n, handlerAddress: HANDLER_ADDR, nonce: 0n });
  assert.equal(tuple.address, HANDLER_ADDR);
});

// ---------------------------------------------------------------------------
// hashAuthorizationTuple
// ---------------------------------------------------------------------------

test("hashAuthorizationTuple: returns 32-byte hex hash", () => {
  const tuple = buildAuthorizationTuple({ chainId: 1n, handlerAddress: HANDLER_ADDR, nonce: 0n });
  const hash = hashAuthorizationTuple(tuple);
  assert.ok(hash.startsWith("0x"));
  assert.equal(hash.length, 66, "32 bytes = 64 hex chars + 0x prefix");
});

test("hashAuthorizationTuple: different nonces produce different hashes", () => {
  const h1 = hashAuthorizationTuple({ chainId: 1n, address: HANDLER_ADDR, nonce: 0n });
  const h2 = hashAuthorizationTuple({ chainId: 1n, address: HANDLER_ADDR, nonce: 1n });
  assert.notEqual(h1, h2);
});

test("hashAuthorizationTuple: different chainIds produce different hashes", () => {
  const h1 = hashAuthorizationTuple({ chainId: 1n, address: HANDLER_ADDR, nonce: 0n });
  const h2 = hashAuthorizationTuple({ chainId: 137n, address: HANDLER_ADDR, nonce: 0n });
  assert.notEqual(h1, h2);
});

test("hashAuthorizationTuple: deterministic", () => {
  const tuple = buildAuthorizationTuple({ chainId: 1n, handlerAddress: HANDLER_ADDR, nonce: 3n });
  assert.equal(hashAuthorizationTuple(tuple), hashAuthorizationTuple(tuple));
});

// ---------------------------------------------------------------------------
// buildEip7702BatchPayload
// ---------------------------------------------------------------------------

const mockSignedAuth = {
  chainId: 1n,
  address: HANDLER_ADDR,
  nonce: 0n,
  yParity: 0,
  r: "0x" + "a".repeat(64),
  s: "0x" + "b".repeat(64)
};

test("buildEip7702BatchPayload: encodedCalldata is non-empty hex", () => {
  const payload = buildEip7702BatchPayload([singleCall], mockSignedAuth);
  assert.ok(payload.encodedCalldata.startsWith("0x"));
  assert.ok(payload.encodedCalldata.length > 10);
});

test("buildEip7702BatchPayload: authorizationList contains the signed auth", () => {
  const payload = buildEip7702BatchPayload([singleCall], mockSignedAuth);
  assert.equal(payload.authorizationList.length, 1);
  assert.equal(payload.authorizationList[0].address, HANDLER_ADDR);
  assert.equal(payload.authorizationList[0].yParity, 0);
});

test("buildEip7702BatchPayload: calls field mirrors input", () => {
  const payload = buildEip7702BatchPayload([singleCall], mockSignedAuth);
  assert.equal(payload.calls.length, 1);
  assert.equal(payload.calls[0].target, TARGET_ADDR);
});

test("buildEip7702BatchPayload: two-call batch: calls field mirrors input", () => {
  const payload = buildEip7702BatchPayload(twoCallBatch, mockSignedAuth);
  assert.equal(payload.calls.length, 2);
  assert.equal(payload.calls[0].target, TARGET_ADDR);
  assert.equal(payload.calls[1].target, PAYMASTER);
});

test("buildEip7702BatchPayload: encodedCalldata matches standalone encodeExecuteBatch", () => {
  const standalone = encodeExecuteBatch([singleCall]);
  const payload = buildEip7702BatchPayload([singleCall], mockSignedAuth);
  assert.equal(payload.encodedCalldata, standalone);
});
