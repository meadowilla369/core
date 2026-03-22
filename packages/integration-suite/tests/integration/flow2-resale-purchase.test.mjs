import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { flow1HarnessDefaults } from "../utils/flow1-harness.mjs";
import {
  flow2HarnessDefaults,
  runFlow2ResaleHarness,
  FLOW2_SELLER_PRIVATE_KEY,
  FLOW2_BUYER_PRIVATE_KEY
} from "../utils/flow2-harness.mjs";
import { createWebhookSignature } from "../utils/signatures.mjs";
import { disposeServer, invokeJson } from "../utils/server-harness.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

function assertSuccess(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.payload));
  assert.equal(result.payload.success, true, JSON.stringify(result.payload));
  return result.payload.data;
}

test("flow 2 end-to-end: buy ticket (flow 1) then resell via MarketplaceV2.buyWithSignature", async () => {
  const { createPaymentOrchestratorServer } = await importFromRepo(
    "services/payment-orchestrator/dist/server.js"
  );
  const { createMarketplaceServer } = await importFromRepo(
    "services/marketplace-service/dist/server.js"
  );

  const flow1 = flow1HarnessDefaults();
  const flow2 = flow2HarnessDefaults();

  // Seller in Flow 2 = buyer in Flow 1 (same key)
  const sellerAddress = flow2.sellerAddress; // == flow1.buyerAddress
  const buyerAddress = flow2.buyerAddress;

  // ── Spin up payment-orchestrator (for Flow 1: initial purchase) ──────────
  const paymentServer = createPaymentOrchestratorServer({
    serviceName: "payment-orchestrator",
    host: "127.0.0.1",
    port: 3016,
    allowedGateways: ["momo", "vnpay"],
    momoWebhookSecret: "momo_dev_secret_f2",
    vnpayWebhookSecret: "vnpay_dev_secret_f2",
    webhookMaxSkewSec: 300,
    webhookNonceTtlSec: 1800,
    maxWebhookRetries: 5,
    retryBaseDelaySec: 1,
    backendSignerPrivateKey: flow2.adminPrivateKey,
    ticketLedgerChainId: flow2.chainId,
    ticketLedgerAddress: flow2.ledgerAddress
  });

  // ── Spin up marketplace-service (for Flow 2: listing + buy-hash) ─────────
  const marketplaceServer = createMarketplaceServer({
    serviceName: "marketplace-service",
    host: "127.0.0.1",
    port: 3017,
    maxMarkupBps: 12000,
    platformFeeBps: 500,
    organizerRoyaltyBps: 200,
    internalApiKey: "internal_dev_key_f2",
    backendSignerPrivateKey: flow2.adminPrivateKey,
    marketplaceChainId: flow2.chainId,
    marketplaceAddress: flow2.marketplaceAddress,
    buyHashTtlSec: 900
  });

  try {
    // ── Flow 1: Seller (future reseller) registers wallet and buys ticket ────

    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/wallet/register",
        headers: { "x-user-id": "usr_flow2_seller" },
        body: { walletAddress: sellerAddress }
      })
    );

    const paymentIntent = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/payment/initiate",
        headers: { "x-user-id": "usr_flow2_seller" },
        body: {
          orderId: "ord_flow2_purchase_001",
          reservationId: "res_flow2_001",
          amount: 1500000,
          currency: "VND",
          gateway: "momo",
          eventId: 1,
          ticketTypeId: 1,
          quantity: 1,
          ticketIds: ["res_flow2_001:1"],
          buyerWalletAddress: sellerAddress
        }
      })
    );

    // Simulate payment webhook confirmation
    const webhookBody = {
      eventId: "evt_flow2_purchase_001",
      orderId: paymentIntent.orderId,
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: paymentIntent.amount,
      currency: "VND",
      gatewayTransactionId: "momo_txn_flow2_001"
    };
    const rawBody = JSON.stringify(webhookBody);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce_flow2_001";
    const webhookSignature = createWebhookSignature({
      timestamp,
      nonce,
      rawBody,
      secret: "momo_dev_secret_f2"
    });

    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/webhook/payment?gateway=momo",
        headers: {
          "x-webhook-signature": webhookSignature,
          "x-webhook-timestamp": timestamp,
          "x-webhook-nonce": nonce
        },
        body: webhookBody
      })
    );

    // Retrieve purchase hash (EIP-712 signed for TicketLedger)
    const purchaseHashPayload = assertSuccess(
      await invokeJson(paymentServer, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    assert.equal(purchaseHashPayload.status, "ready");
    assert.equal(purchaseHashPayload.paymentStatus, "confirmed");
    assert.ok(purchaseHashPayload.paymentHash, "purchase paymentHash must be present");
    assert.ok(purchaseHashPayload.signature, "purchase signature must be present");
    assert.equal(purchaseHashPayload.domain.verifyingContract, flow2.ledgerAddress);

    // ── Flow 2a: Seller creates listing in marketplace-service ───────────────

    const listing = assertSuccess(
      await invokeJson(marketplaceServer, {
        method: "POST",
        path: "/marketplace/listings",
        headers: {
          "x-user-id": "usr_flow2_seller",
          "x-kyc-status": "approved"
        },
        body: {
          tokenId: "ticket_1",
          eventId: "1",
          originalPrice: 1500000,
          askPrice: 1600000,
          sellerWalletAddress: sellerAddress
        }
      })
    );

    assert.equal(listing.status, "active");
    assert.equal(listing.askPrice, 1600000);

    // ── Flow 2b: Buyer initiates buy and gets buy-hash ────────────────────────

    // On-chain listing id = 1 (first listing in MarketplaceV2 contract)
    const onChainListingId = 1;

    const buyHashPayload = assertSuccess(
      await invokeJson(marketplaceServer, {
        method: "POST",
        path: `/marketplace/listings/${listing.id}/initiate-buy`,
        headers: { "x-user-id": "usr_flow2_buyer" },
        body: {
          orderId: "ord_flow2_buy_001",
          amount: listing.askPrice,
          buyerWalletAddress: buyerAddress,
          onChainListingId
        }
      })
    );

    assert.equal(buyHashPayload.status, "issued");
    assert.ok(buyHashPayload.paymentHash, "buy paymentHash must be present");
    assert.ok(buyHashPayload.signature, "buy signature must be present");
    assert.equal(buyHashPayload.domain.verifyingContract, flow2.marketplaceAddress);
    assert.equal(buyHashPayload.domain.chainId, flow2.chainId);

    // Also verify the GET endpoint works
    const buyHashGet = assertSuccess(
      await invokeJson(marketplaceServer, {
        method: "GET",
        path: `/marketplace/listings/${listing.id}/buy-hash`,
        headers: { "x-user-id": "usr_flow2_buyer" }
      })
    );
    assert.equal(buyHashGet.paymentHash, buyHashPayload.paymentHash);

    // ── Run Flow2ResaleHarness (forge script) end-to-end ─────────────────────

    const harnessOutput = runFlow2ResaleHarness({
      eventId: purchaseHashPayload.eventId,
      ticketTypeId: purchaseHashPayload.ticketTypeId,
      purchasePaymentHash: purchaseHashPayload.paymentHash,
      purchaseSignature: purchaseHashPayload.signature,
      resalePrice: listing.askPrice,
      buyPaymentHash: buyHashPayload.paymentHash,
      buySignature: buyHashPayload.signature
    });

    assert.match(harnessOutput, /FLOW2_HARNESS_OK/);
  } finally {
    disposeServer(paymentServer);
    disposeServer(marketplaceServer);
  }
});
