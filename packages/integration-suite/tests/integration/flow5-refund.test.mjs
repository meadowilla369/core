import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { flow5HarnessDefaults, runFlow5RefundHarness } from "../utils/flow5-harness.mjs";
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

test("flow 5 end-to-end: purchase ticket (flow 1), request refund via refund-service, async cancelTicket via Forge harness", async () => {
  const { createPaymentOrchestratorServer } = await importFromRepo(
    "services/payment-orchestrator/dist/server.js"
  );
  const { createRefundServer } = await importFromRepo("services/refund-service/dist/server.js");

  const flow5 = flow5HarnessDefaults();
  const buyerAddress = flow5.buyerAddress;

  // ── Spin up payment-orchestrator ──────────────────────────────────────────
  const paymentServer = createPaymentOrchestratorServer({
    serviceName: "payment-orchestrator",
    host: "127.0.0.1",
    port: 3020,
    allowedGateways: ["momo", "vnpay"],
    momoWebhookSecret: "momo_dev_secret_f5",
    vnpayWebhookSecret: "vnpay_dev_secret_f5",
    webhookMaxSkewSec: 300,
    webhookNonceTtlSec: 1800,
    maxWebhookRetries: 5,
    retryBaseDelaySec: 1,
    backendSignerPrivateKey: flow5.adminPrivateKey,
    ticketLedgerChainId: flow5.chainId,
    ticketLedgerAddress: flow5.ledgerAddress
  });

  // ── Spin up refund-service ────────────────────────────────────────────────
  const refundServer = createRefundServer({
    serviceName: "refund-service",
    host: "127.0.0.1",
    port: 3021,
    payoutSyncPollMs: 100,
    maxRetryCount: 3,
    retryBaseDelaySec: 1,
    payoutFailureRate: 0
  });

  try {
    // ── Flow 1: Buyer registers wallet and purchases ticket ───────────────────

    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/wallet/register",
        headers: { "x-user-id": "usr_flow5_buyer" },
        body: { walletAddress: buyerAddress }
      })
    );

    const paymentIntent = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/payment/initiate",
        headers: { "x-user-id": "usr_flow5_buyer" },
        body: {
          orderId: "ord_flow5_purchase_001",
          reservationId: "res_flow5_001",
          amount: 1500000,
          currency: "VND",
          gateway: "momo",
          eventId: 1,
          ticketTypeId: 1,
          quantity: 1,
          ticketIds: ["res_flow5_001:1"],
          buyerWalletAddress: buyerAddress
        }
      })
    );

    // Simulate payment webhook confirmation
    const webhookBody = {
      eventId: "evt_flow5_purchase_001",
      orderId: paymentIntent.orderId,
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: paymentIntent.amount,
      currency: "VND",
      gatewayTransactionId: "momo_txn_flow5_001"
    };
    const rawBody = JSON.stringify(webhookBody);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce_flow5_001";
    const webhookSignature = createWebhookSignature({
      timestamp,
      nonce,
      rawBody,
      secret: "momo_dev_secret_f5"
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

    // Retrieve EIP-712 purchase authorization
    const purchaseHashPayload = assertSuccess(
      await invokeJson(paymentServer, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    assert.equal(purchaseHashPayload.status, "ready");
    assert.equal(purchaseHashPayload.paymentStatus, "confirmed");
    assert.ok(purchaseHashPayload.paymentHash, "paymentHash must be present");
    assert.ok(purchaseHashPayload.signature, "signature must be present");

    // ── Flow 5: Request refund via refund-service ────────────────────────────

    // Event has been cancelled — refund should be allowed
    const refundData = assertSuccess(
      await invokeJson(refundServer, {
        method: "POST",
        path: "/refunds/requests",
        headers: {
          "x-user-id": "usr_flow5_buyer",
          "idempotency-key": "idem_flow5_refund_001"
        },
        body: {
          ticketId: "1",
          eventId: String(purchaseHashPayload.eventId),
          paymentId: paymentIntent.paymentId,
          refundMethod: "momo",
          eventStatus: "cancelled",
          originalPurchasePrice: paymentIntent.amount
        }
      })
    );

    assert.equal(refundData.status, "pending");
    assert.equal(refundData.ticketId, "1");
    assert.equal(refundData.refundAmount, paymentIntent.amount);
    assert.equal(refundData.refundMethod, "momo");

    const refundId = refundData.refundId;
    assert.ok(refundId, "refundId must be present");

    // Duplicate request with same idempotency key should return the same result
    const idempotentRepeat = assertSuccess(
      await invokeJson(refundServer, {
        method: "POST",
        path: "/refunds/requests",
        headers: {
          "x-user-id": "usr_flow5_buyer",
          "idempotency-key": "idem_flow5_refund_001"
        },
        body: {
          ticketId: "1",
          eventId: String(purchaseHashPayload.eventId),
          paymentId: paymentIntent.paymentId,
          refundMethod: "momo",
          eventStatus: "cancelled",
          originalPurchasePrice: paymentIntent.amount
        }
      })
    );
    assert.equal(
      idempotentRepeat.refundId,
      refundId,
      "idempotent repeat should return same refundId"
    );

    // Verify the refund request is retrievable
    const fetchedRefund = assertSuccess(
      await invokeJson(refundServer, {
        method: "GET",
        path: `/refunds/${refundId}`
      })
    );
    assert.equal(fetchedRefund.refundId, refundId);
    assert.equal(fetchedRefund.userId, "usr_flow5_buyer");

    // Verify duplicate ticket refund attempt is rejected (different idempotency key)
    const duplicateResult = await invokeJson(refundServer, {
      method: "POST",
      path: "/refunds/requests",
      headers: {
        "x-user-id": "usr_flow5_buyer",
        "idempotency-key": "idem_flow5_refund_002"
      },
      body: {
        ticketId: "1",
        eventId: String(purchaseHashPayload.eventId),
        paymentId: paymentIntent.paymentId,
        refundMethod: "momo",
        eventStatus: "cancelled",
        originalPurchasePrice: paymentIntent.amount
      }
    });
    assert.equal(duplicateResult.status, 409);
    assert.equal(duplicateResult.payload.error.code, "REFUND_ALREADY_REQUESTED");

    // Verify non-eligible refund is rejected (active event)
    const ineligibleResult = await invokeJson(refundServer, {
      method: "POST",
      path: "/refunds/requests",
      headers: { "x-user-id": "usr_flow5_buyer2" },
      body: {
        ticketId: "2",
        eventId: "2",
        paymentId: "pay_ineligible_001",
        refundMethod: "momo",
        eventStatus: "active",
        originalPurchasePrice: 500000
      }
    });
    assert.equal(ineligibleResult.status, 400);
    assert.equal(ineligibleResult.payload.error.code, "EVENT_NOT_REFUNDABLE");

    // Trigger payout sync (payoutFailureRate = 0, so it should complete)
    const syncResult = assertSuccess(
      await invokeJson(refundServer, {
        method: "POST",
        path: "/refunds/sync"
      })
    );
    assert.ok(syncResult.processed >= 1, "at least one refund should be processed");
    assert.ok(syncResult.completed >= 1, "at least one refund should complete");

    // Verify final status
    const completedRefund = assertSuccess(
      await invokeJson(refundServer, {
        method: "GET",
        path: `/refunds/${refundId}`
      })
    );
    assert.equal(completedRefund.status, "completed");
    assert.ok(completedRefund.payoutReference, "payoutReference must be set after completion");
    assert.ok(completedRefund.completedAt, "completedAt must be set after completion");

    // Verify user's refund list
    const myRefunds = assertSuccess(
      await invokeJson(refundServer, {
        method: "GET",
        path: "/refunds/me",
        headers: { "x-user-id": "usr_flow5_buyer" }
      })
    );
    assert.ok(myRefunds.length >= 1, "user should have at least one refund");
    assert.equal(myRefunds[0].refundId, refundId);

    // ── Run Flow5RefundHarness (forge script): purchase + cancelTicket ────────

    const harnessOutput = runFlow5RefundHarness({
      eventId: purchaseHashPayload.eventId,
      ticketTypeId: purchaseHashPayload.ticketTypeId,
      paymentHash: purchaseHashPayload.paymentHash,
      signature: purchaseHashPayload.signature
    });

    assert.match(harnessOutput, /FLOW5_HARNESS_OK/);
  } finally {
    disposeServer(paymentServer);
    disposeServer(refundServer);
  }
});
