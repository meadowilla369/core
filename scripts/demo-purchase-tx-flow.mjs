#!/usr/bin/env node
/**
 * demo-purchase-tx-flow.mjs
 *
 * Prints a full trace of the client-side EIP-7702 purchase transaction flow:
 *
 *   1. buildPurchaseTx   — encode calldata + build unsigned AuthorizationTuple
 *   2. MockEOASigner     — sign the authorization hash (stub ECDSA)
 *   3. assemble          — merge signature → Eip7702BatchPayload
 *   4. assembleTx4       — wrap into broadcast-ready Tx4Request
 *
 * Shows exactly which Tx4Request fields are populated vs. which require RPC
 * context before broadcasting.
 *
 * Usage (from repo root, after building):
 *   node scripts/demo-purchase-tx-flow.mjs
 *
 * Build first:
 *   (cd packages/sdk-client && node ../../node_modules/typescript/bin/tsc -p tsconfig.json)
 */

import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SDK_ROOT = path.resolve(REPO_ROOT, "packages/sdk-client");

// ---------------------------------------------------------------------------
// Load modules from sdk-client dist/
// ---------------------------------------------------------------------------

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
// TicketLedger ABI (same as wallet-tx.ts)
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
// Demo fixtures
// ---------------------------------------------------------------------------

const HANDLER_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
const LEDGER_ADDR = "0x1111111111111111111111111111111111111111";
const EOA_ADDR = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
// Simulate backend-provided payment hash + signature
const PAYMENT_HASH = "0x" + "ab".repeat(32);
const BACKEND_SIG = "0x" + "aa".repeat(65);

const PARAMS = {
  ticketLedgerAddress: LEDGER_ADDR,
  handlerAddress: HANDLER_ADDR,
  eventId: 42n,
  ticketTypeId: 7n,
  quantity: 2n,
  paymentHash: PAYMENT_HASH,
  signature: BACKEND_SIG,
  chainId: 1n, // Ethereum mainnet
  nonce: 5n
};

// ---------------------------------------------------------------------------
// Run the flow
// ---------------------------------------------------------------------------

const sep = "─".repeat(72);

console.log("\n" + sep);
console.log("  EIP-7702 Purchase Tx Flow Demo");
console.log(sep);

// Step 1: Encode calldata + build authorization tuple
console.log("\n[1] buildPurchaseTx — encode calldata + build unsigned AuthorizationTuple");

const ledgerCalldata = encodeFunctionData({
  abi: TICKET_LEDGER_ABI,
  functionName: "purchaseWithSignature",
  args: [PARAMS.eventId, PARAMS.ticketTypeId, PARAMS.quantity, PARAMS.paymentHash, PARAMS.signature]
});

const calls = [{ target: PARAMS.ticketLedgerAddress, value: 0n, data: ledgerCalldata }];
validateCalls(calls); // throws if invalid

const authorizationTuple = buildAuthorizationTuple({
  chainId: PARAMS.chainId,
  handlerAddress: PARAMS.handlerAddress,
  nonce: PARAMS.nonce
});
const authorizationHash = hashAuthorizationTuple(authorizationTuple);

console.log("  authorizationTuple:");
console.log("    chainId :", authorizationTuple.chainId.toString());
console.log("    address :", authorizationTuple.address);
console.log("    nonce   :", authorizationTuple.nonce.toString());
console.log("  authorizationHash:", authorizationHash);
console.log("  inner calldata selector:", ledgerCalldata.slice(0, 10), "(= purchaseWithSignature)");

// Step 2: Sign with MockEOASigner
console.log("\n[2] MockEOASigner.signAuthorization — stub ECDSA sign (test only)");
const signer = new MockEOASigner(EOA_ADDR);
const signedAuth = await signer.signAuthorization(authorizationTuple, authorizationHash);

console.log("  signer.address:", signer.address);
console.log("  yParity:", signedAuth.yParity);
console.log("  r      :", signedAuth.r);
console.log("  s      :", signedAuth.s);

// Step 3: Assemble payload
console.log("\n[3] assemble — merge signature → Eip7702BatchPayload");
const payload = buildEip7702BatchPayload(calls, signedAuth);

console.log("  authorizationList.length:", payload.authorizationList.length);
console.log(
  "  encodedCalldata selector :",
  payload.encodedCalldata.slice(0, 10),
  "(= executeBatch)"
);
console.log("  calls[0].target          :", payload.calls[0].target);
console.log("  calls[0].value           :", payload.calls[0].value.toString());

// Step 4: assembleTx4
console.log("\n[4] assembleTx4 — wrap into broadcast-ready Tx4Request");
const tx4 = assembleTx4(payload, signer.address);

console.log("  tx4.type              :", tx4.type);
console.log("  tx4.from              :", tx4.from);
console.log("  tx4.to                :", tx4.to, "(= Handler)");
console.log("  tx4.value             :", tx4.value.toString(), "wei");
console.log("  tx4.chainId           :", tx4.chainId.toString());
console.log("  tx4.data              :", tx4.data.slice(0, 10) + "..." + tx4.data.slice(-8));
console.log("  tx4.authorizationList.length:", tx4.authorizationList.length);

console.log("\n  ⚠  RPC-dependent fields (must fill before broadcast):");
console.log("     tx4.nonce               :", tx4.nonce, "← eth_getTransactionCount");
console.log("     tx4.gas                 :", tx4.gas, "← eth_estimateGas");
console.log("     tx4.maxFeePerGas        :", tx4.maxFeePerGas, "← eth_feeHistory");
console.log("     tx4.maxPriorityFeePerGas:", tx4.maxPriorityFeePerGas, "← eth_feeHistory");

console.log("\n" + sep);
console.log("  REMAINING GAP:");
console.log("  Fill the 4 undefined fields from a live RPC (eth_estimateGas /");
console.log("  eth_feeHistory), then call:");
console.log("    walletClient.sendTransaction(tx4) — viem PublicClient on Pectra node");
console.log(sep + "\n");
