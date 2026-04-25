import assert from "node:assert/strict";
import test from "node:test";

import { computePrefundShortfall, extractTransactionHash, sendNativePrefund } from "./ethereum.js";

test("computePrefundShortfall returns the missing wei when balance is below target", () => {
  assert.equal(computePrefundShortfall("1000", 250n), 750n);
});

test("computePrefundShortfall returns zero when balance already satisfies target", () => {
  assert.equal(computePrefundShortfall("1000", 1500n), 0n);
});

test("extractTransactionHash accepts cast --async output", () => {
  assert.equal(
    extractTransactionHash("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  );
});

test("sendNativePrefund uses cast send and returns the transaction hash", () => {
  const calls: string[][] = [];
  const txHash = sendNativePrefund(
    {
      rpcUrl: "http://127.0.0.1:8545",
      privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      walletAddress: "0x000000000000000000000000000000000000dead",
      amountWei: "10000000000000000"
    },
    ({ args }) => {
      calls.push(args);
      return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    }
  );

  assert.equal(txHash, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.deepEqual(calls[0], [
    "send",
    "--async",
    "--rpc-url",
    "http://127.0.0.1:8545",
    "--private-key",
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "--value",
    "10000000000000000",
    "0x000000000000000000000000000000000000dead"
  ]);
});
