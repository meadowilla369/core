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

// Re-use the anvil test private keys; seller = Flow1 buyer, buyer = a new key
export const FLOW2_ADMIN_PRIVATE_KEY = FLOW1_ADMIN_PRIVATE_KEY;
export const FLOW2_SELLER_PRIVATE_KEY = FLOW1_BUYER_PRIVATE_KEY;
export const FLOW2_BUYER_PRIVATE_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
export const FLOW2_CHAIN_ID = FLOW1_CHAIN_ID;

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

export function computePredictedAddresses(adminAddress) {
  // Deployment order in Flow2ResaleHarness:
  //   nonce 0: TicketPaymaster
  //   nonce 1: Handler
  //   nonce 2: TicketLedger
  //   nonce 3: MarketplaceV2
  const ledger = runCommand("cast", ["compute-address", adminAddress, "--nonce", "2"])
    .replace("Computed Address:", "")
    .trim()
    .toLowerCase();
  const marketplace = runCommand("cast", ["compute-address", adminAddress, "--nonce", "3"])
    .replace("Computed Address:", "")
    .trim()
    .toLowerCase();
  return { ledgerAddress: ledger, marketplaceAddress: marketplace };
}

export function flow2HarnessDefaults() {
  const adminAddress = deriveAddressFromPrivateKey(FLOW2_ADMIN_PRIVATE_KEY);
  const sellerAddress = deriveAddressFromPrivateKey(FLOW2_SELLER_PRIVATE_KEY);
  const buyerAddress = deriveAddressFromPrivateKey(FLOW2_BUYER_PRIVATE_KEY);
  const { ledgerAddress, marketplaceAddress } = computePredictedAddresses(adminAddress);

  return {
    adminPrivateKey: FLOW2_ADMIN_PRIVATE_KEY,
    adminAddress,
    sellerPrivateKey: FLOW2_SELLER_PRIVATE_KEY,
    sellerAddress,
    buyerPrivateKey: FLOW2_BUYER_PRIVATE_KEY,
    buyerAddress,
    chainId: FLOW2_CHAIN_ID,
    ledgerAddress,
    marketplaceAddress
  };
}

export function runFlow2ResaleHarness({
  eventId,
  ticketTypeId,
  purchasePaymentHash,
  purchaseSignature,
  resalePrice,
  buyPaymentHash,
  buySignature
}) {
  assert.ok(purchasePaymentHash, "purchasePaymentHash is required");
  assert.ok(purchaseSignature, "purchaseSignature is required");
  assert.ok(buyPaymentHash, "buyPaymentHash is required");
  assert.ok(buySignature, "buySignature is required");

  const defaults = flow2HarnessDefaults();
  const output = runCommand(
    "forge",
    [
      "script",
      "script/Flow2ResaleHarness.s.sol:Flow2ResaleHarness",
      "--sig",
      "run()",
      "--offline",
      "--cache-path",
      FOUNDRY_CACHE_PATH
    ],
    {
      cwd: CONTRACTS_ROOT,
      env: {
        FLOW2_ADMIN_PRIVATE_KEY: defaults.adminPrivateKey,
        FLOW2_SELLER_PRIVATE_KEY: defaults.sellerPrivateKey,
        FLOW2_BUYER_PRIVATE_KEY: defaults.buyerPrivateKey,
        FLOW2_EVENT_ID: String(eventId),
        FLOW2_TICKET_TYPE_ID: String(ticketTypeId),
        FLOW2_PURCHASE_PAYMENT_HASH: purchasePaymentHash,
        FLOW2_PURCHASE_SIGNATURE: purchaseSignature,
        FLOW2_RESALE_PRICE: String(resalePrice),
        FLOW2_BUY_PAYMENT_HASH: buyPaymentHash,
        FLOW2_BUY_SIGNATURE: buySignature
      }
    }
  );

  if (!output.includes("FLOW2_HARNESS_OK")) {
    throw new Error(`Flow2 harness did not report success\n${output}`);
  }

  return output;
}
