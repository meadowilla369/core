import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPurchasedTokenIds,
  getBufferedGasLimit,
  getLocalchainGasLimit,
  selectNewTokenIds,
  selectNewlySyncedTokens
} from "./localchain.ts";

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

test("getLocalchainGasLimit uses a buffered estimate when tx gas is missing", () => {
  assert.equal(
    getLocalchainGasLimit(
      {
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
      },
      500_000n
    ),
    600_000n
  );
});

test("getBufferedGasLimit adds a 20 percent buffer and rounds up", () => {
  assert.equal(getBufferedGasLimit(500_001n), 600_002n);
});

test("extractPurchasedTokenIds returns every purchased ticket id from a receipt", () => {
  const tokenIds = extractPurchasedTokenIds(
    {
      transactionHash: "0xabc",
      logs: [
        {
          address: "0x0000000000000000000000000000000000000009",
          topics: [
            "0xdb9bb3f84ac1ee7db57c4b8993fdc604c65ef51a09847bf3fe5eae09c7cbd26a",
            "0x0000000000000000000000000000000000000000000000000000000000000001"
          ]
        },
        {
          address: "0x0000000000000000000000000000000000000009",
          topics: [
            "0xdb9bb3f84ac1ee7db57c4b8993fdc604c65ef51a09847bf3fe5eae09c7cbd26a",
            "0x0000000000000000000000000000000000000000000000000000000000000002"
          ]
        },
        {
          address: "0x0000000000000000000000000000000000000008",
          topics: [
            "0xdb9bb3f84ac1ee7db57c4b8993fdc604c65ef51a09847bf3fe5eae09c7cbd26a",
            "0x0000000000000000000000000000000000000000000000000000000000000003"
          ]
        }
      ]
    },
    "0x0000000000000000000000000000000000000009"
  );

  assert.deepEqual(tokenIds, ["1", "2"]);
});

test("selectNewlySyncedTokens returns all tokens absent from the previous owner snapshot", () => {
  const tokens = selectNewlySyncedTokens(
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

  assert.deepEqual(tokens, [{ tokenId: "3" }]);
});

test("selectNewlySyncedTokens returns an empty array when sync data has no new token", () => {
  const tokens = selectNewlySyncedTokens(new Set(["1", "2"]), [{ tokenId: "2" }]);

  assert.deepEqual(tokens, []);
});

test("selectNewTokenIds returns all on-chain token ids absent from the previous snapshot", () => {
  const tokenIds = selectNewTokenIds(new Set(["1", "2"]), ["2", "3", "4"]);

  assert.deepEqual(tokenIds, ["3", "4"]);
});

test("selectNewTokenIds returns an empty array when on-chain owner tickets do not change", () => {
  const tokenIds = selectNewTokenIds(new Set(["1", "2"]), ["1", "2"]);

  assert.deepEqual(tokenIds, []);
});
