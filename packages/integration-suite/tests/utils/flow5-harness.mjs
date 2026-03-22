import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FLOW1_ADMIN_PRIVATE_KEY,
  FLOW1_BUYER_PRIVATE_KEY,
  FLOW1_CHAIN_ID
} from "./flow1-harness.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");
const CONTRACTS_ROOT = path.resolve(REPO_ROOT, "contracts");
const FOUNDRY_CACHE_PATH = "/tmp/foundry-cache";

// Re-use Flow 1 keys: admin = backend signer (REFUND_ROLE), buyer = ticket holder
export const FLOW5_ADMIN_PRIVATE_KEY = FLOW1_ADMIN_PRIVATE_KEY;
export const FLOW5_BUYER_PRIVATE_KEY = FLOW1_BUYER_PRIVATE_KEY;
export const FLOW5_CHAIN_ID = FLOW1_CHAIN_ID;

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...options.env }
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
  // Deployment order in Flow5RefundHarness:
  //   nonce 0: TicketPaymaster
  //   nonce 1: Handler
  //   nonce 2: TicketLedger
  const output = runCommand("cast", ["compute-address", adminAddress, "--nonce", "2"]);
  return output.replace("Computed Address:", "").trim().toLowerCase();
}

export function flow5HarnessDefaults() {
  const adminAddress = deriveAddressFromPrivateKey(FLOW5_ADMIN_PRIVATE_KEY);
  const buyerAddress = deriveAddressFromPrivateKey(FLOW5_BUYER_PRIVATE_KEY);
  const ledgerAddress = computePredictedLedgerAddress(adminAddress);

  return {
    adminPrivateKey: FLOW5_ADMIN_PRIVATE_KEY,
    adminAddress,
    buyerPrivateKey: FLOW5_BUYER_PRIVATE_KEY,
    buyerAddress,
    chainId: FLOW5_CHAIN_ID,
    ledgerAddress
  };
}

export function runFlow5RefundHarness({ eventId, ticketTypeId, paymentHash, signature }) {
  assert.ok(paymentHash, "paymentHash is required");
  assert.ok(signature, "signature is required");

  const defaults = flow5HarnessDefaults();
  const output = runCommand(
    "forge",
    [
      "script",
      "script/Flow5RefundHarness.s.sol:Flow5RefundHarness",
      "--sig",
      "run()",
      "--offline",
      "--cache-path",
      FOUNDRY_CACHE_PATH
    ],
    {
      cwd: CONTRACTS_ROOT,
      env: {
        FLOW5_ADMIN_PRIVATE_KEY: defaults.adminPrivateKey,
        FLOW5_BUYER_PRIVATE_KEY: defaults.buyerPrivateKey,
        FLOW5_EVENT_ID: String(eventId),
        FLOW5_TICKET_TYPE_ID: String(ticketTypeId),
        FLOW5_PAYMENT_HASH: paymentHash,
        FLOW5_SIGNATURE: signature
      }
    }
  );

  if (!output.includes("FLOW5_HARNESS_OK")) {
    throw new Error(`Flow5 harness did not report success\n${output}`);
  }

  return output;
}
