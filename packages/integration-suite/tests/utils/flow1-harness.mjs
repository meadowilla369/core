import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FLOW1_ADMIN_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const FLOW1_BUYER_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044976f5f0e7cf9874a3f5f6b0dd8f04fbfdbb6c42fbaa";
export const FLOW1_CHAIN_ID = 31337;

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");
const CONTRACTS_ROOT = path.resolve(REPO_ROOT, "contracts");
const FOUNDRY_CACHE_PATH = "/tmp/foundry-cache";

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env
    }
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }

  return result.stdout.trim();
}

export function deriveAddressFromPrivateKey(privateKey) {
  return runCommand("cast", ["wallet", "address", "--private-key", privateKey]).toLowerCase();
}

export function computePredictedLedgerAddress(adminAddress) {
  const output = runCommand("cast", ["compute-address", adminAddress, "--nonce", "2"]);
  const normalized = output.replace("Computed Address:", "").trim();
  return normalized.toLowerCase();
}

export function flow1HarnessDefaults() {
  const adminAddress = deriveAddressFromPrivateKey(FLOW1_ADMIN_PRIVATE_KEY);
  const buyerAddress = deriveAddressFromPrivateKey(FLOW1_BUYER_PRIVATE_KEY);

  return {
    adminPrivateKey: FLOW1_ADMIN_PRIVATE_KEY,
    adminAddress,
    buyerPrivateKey: FLOW1_BUYER_PRIVATE_KEY,
    buyerAddress,
    chainId: FLOW1_CHAIN_ID,
    ledgerAddress: computePredictedLedgerAddress(adminAddress)
  };
}

export function runFlow1PurchaseHarness({
  ledgerAddress,
  eventId,
  ticketTypeId,
  quantity,
  paymentHash,
  signature
}) {
  assert.ok(ledgerAddress, "ledgerAddress is required");
  assert.ok(paymentHash, "paymentHash is required");
  assert.ok(signature, "signature is required");

  const defaults = flow1HarnessDefaults();
  const output = runCommand(
    "forge",
    [
      "script",
      "script/Flow1PurchaseHarness.s.sol:Flow1PurchaseHarness",
      "--sig",
      "run()",
      "--offline",
      "--cache-path",
      FOUNDRY_CACHE_PATH
    ],
    {
      cwd: CONTRACTS_ROOT,
      env: {
        FLOW1_ADMIN_PRIVATE_KEY: defaults.adminPrivateKey,
        FLOW1_BUYER_PRIVATE_KEY: defaults.buyerPrivateKey,
        FLOW1_TICKET_LEDGER_ADDRESS: ledgerAddress,
        FLOW1_EVENT_ID: String(eventId),
        FLOW1_TICKET_TYPE_ID: String(ticketTypeId),
        FLOW1_QUANTITY: String(quantity),
        FLOW1_PAYMENT_HASH: paymentHash,
        FLOW1_SIGNATURE: signature
      }
    }
  );

  if (!output.includes("FLOW1_HARNESS_OK")) {
    throw new Error(`Flow1 harness did not report success\n${output}`);
  }

  return output;
}
