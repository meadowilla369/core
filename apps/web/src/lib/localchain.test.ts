import assert from "node:assert/strict";
import test from "node:test";

import { getLocalchainGasLimit, selectNewTokenId, selectNewlySyncedToken } from "./localchain.ts";

test("getLocalchainGasLimit falls back to a fixed gas limit when tx.gas is missing", () => {
  assert.equal(
    getLocalchainGasLimit({
      type: 4,
      from: "0x0000000000000000000000000000000000000001",
      to: "0x0000000000000000000000000000000000000002",
      data: "0x",
      value: 0n,
      authorizationList: [],
      nonce: undefined,
      gas: undefined,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
      chainId: 31337
    }),
    400_000n
  );
});

test("getLocalchainGasLimit preserves an explicit gas limit", () => {
  assert.equal(
    getLocalchainGasLimit({
      type: 4,
      from: "0x0000000000000000000000000000000000000001",
      to: "0x0000000000000000000000000000000000000002",
      data: "0x",
      value: 0n,
      authorizationList: [],
      nonce: undefined,
      gas: 420_000n,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
      chainId: 31337
    }),
    420_000n
  );
});

test("selectNewlySyncedToken returns the first token absent from the previous owner snapshot", () => {
  const token = selectNewlySyncedToken(
    new Set(["1", "2"]),
    [
      {
        tokenId: "2"
      },
      {
        tokenId: "3"
      }
    ]
  );

  assert.deepEqual(token, { tokenId: "3" });
});

test("selectNewlySyncedToken returns null when sync data has no new token", () => {
  const token = selectNewlySyncedToken(new Set(["1", "2"]), [{ tokenId: "2" }]);

  assert.equal(token, null);
});

test("selectNewTokenId returns the first on-chain token id absent from the previous snapshot", () => {
  const tokenId = selectNewTokenId(new Set(["1", "2"]), ["2", "3"]);

  assert.equal(tokenId, "3");
});

test("selectNewTokenId returns null when on-chain owner tickets do not change", () => {
  const tokenId = selectNewTokenId(new Set(["1", "2"]), ["1", "2"]);

  assert.equal(tokenId, null);
});
