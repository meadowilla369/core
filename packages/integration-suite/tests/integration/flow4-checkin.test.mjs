import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { flow4HarnessDefaults, runFlow4CheckinHarness } from "../utils/flow4-harness.mjs";
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

function computeQrSignature(secret, { tokenId, eventId, timestamp, nonce, walletAddress }) {
  const payload = `${tokenId}.${eventId}.${timestamp}.${nonce}.${walletAddress}`;
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

test("flow 4 end-to-end: purchase ticket (flow 1), QR check-in via checkin-service, async markUsedBatch via Forge harness", async () => {
  const { createPaymentOrchestratorServer } = await importFromRepo(
    "services/payment-orchestrator/dist/server.js"
  );
  const { createCheckinServer } = await importFromRepo("services/checkin-service/dist/server.js");

  const flow4 = flow4HarnessDefaults();
  const buyerAddress = flow4.buyerAddress;

  const qrSecret = "checkin_dev_secret_f4";

  // ── Spin up payment-orchestrator ──────────────────────────────────────────
  const paymentServer = createPaymentOrchestratorServer({
    serviceName: "payment-orchestrator",
    host: "127.0.0.1",
    port: 3018,
    allowedGateways: ["momo", "vnpay"],
    momoWebhookSecret: "momo_dev_secret_f4",
    vnpayWebhookSecret: "vnpay_dev_secret_f4",
    webhookMaxSkewSec: 300,
    webhookNonceTtlSec: 1800,
    maxWebhookRetries: 5,
    retryBaseDelaySec: 1,
    backendSignerPrivateKey: flow4.adminPrivateKey,
    ticketLedgerChainId: flow4.chainId,
    ticketLedgerAddress: flow4.ledgerAddress
  });

  // ── Spin up checkin-service ───────────────────────────────────────────────
  const checkinServer = createCheckinServer({
    serviceName: "checkin-service",
    host: "127.0.0.1",
    port: 3019,
    qrSignatureSecret: qrSecret,
    maxQrAgeSec: 30,
    maxClockSkewSec: 10,
    markAsUsedPollMs: 100,
    markAsUsedMaxRetries: 3,
    markAsUsedFailureRate: 0
  });

  try {
    // ── Flow 1: Buyer registers wallet and purchases ticket ───────────────────

    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/wallet/register",
        headers: { "x-user-id": "usr_flow4_buyer" },
        body: { walletAddress: buyerAddress }
      })
    );

    const paymentIntent = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/payment/initiate",
        headers: { "x-user-id": "usr_flow4_buyer" },
        body: {
          orderId: "ord_flow4_purchase_001",
          reservationId: "res_flow4_001",
          amount: 1500000,
          currency: "VND",
          gateway: "momo",
          eventId: 1,
          ticketTypeId: 1,
          quantity: 1,
          ticketIds: ["res_flow4_001:1"],
          buyerWalletAddress: buyerAddress
        }
      })
    );

    // Simulate payment webhook confirmation
    const webhookBody = {
      eventId: "evt_flow4_purchase_001",
      orderId: paymentIntent.orderId,
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: paymentIntent.amount,
      currency: "VND",
      gatewayTransactionId: "momo_txn_flow4_001"
    };
    const rawBody = JSON.stringify(webhookBody);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce_flow4_001";
    const webhookSignature = createWebhookSignature({
      timestamp,
      nonce,
      rawBody,
      secret: "momo_dev_secret_f4"
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

    // ── Flow 4: QR Check-in via checkin-service ───────────────────────────────

    // Staff scanner presents QR; tokenId is "1" (first ticket after on-chain purchase)
    const tokenId = "1";
    const eventId = String(purchaseHashPayload.eventId);
    const qrTimestamp = Date.now();
    const qrNonce = "qr_nonce_flow4_001";

    const qrSignature = computeQrSignature(qrSecret, {
      tokenId,
      eventId,
      timestamp: qrTimestamp,
      nonce: qrNonce,
      walletAddress: buyerAddress
    });

    const checkinData = assertSuccess(
      await invokeJson(checkinServer, {
        method: "POST",
        path: "/checkin/verify",
        body: {
          gateId: "gate_A",
          qrData: {
            tokenId,
            eventId,
            timestamp: qrTimestamp,
            nonce: qrNonce,
            walletAddress: buyerAddress,
            signature: qrSignature
          }
        }
      })
    );

    assert.equal(checkinData.valid, true, "QR check-in should succeed");
    assert.equal(checkinData.ticketId, tokenId);
    assert.equal(checkinData.gateId, "gate_A");
    assert.ok(checkinData.markAsUsedJobId, "markAsUsedJobId must be returned");

    // Verify event stats reflect the scan
    const stats = assertSuccess(
      await invokeJson(checkinServer, {
        method: "GET",
        path: `/checkin/events/${eventId}/stats`
      })
    );
    assert.equal(stats.totalScans, 1);
    assert.equal(stats.validScans, 1);
    assert.equal(stats.invalidScans, 0);

    // Verify duplicate scan is rejected
    const duplicateScan = assertSuccess(
      await invokeJson(checkinServer, {
        method: "POST",
        path: "/checkin/verify",
        body: {
          gateId: "gate_B",
          qrData: {
            tokenId,
            eventId,
            timestamp: Date.now(),
            nonce: "qr_nonce_flow4_002",
            walletAddress: buyerAddress,
            signature: computeQrSignature(qrSecret, {
              tokenId,
              eventId,
              timestamp: Date.now(),
              nonce: "qr_nonce_flow4_002",
              walletAddress: buyerAddress
            })
          }
        }
      })
    );
    assert.equal(duplicateScan.valid, false);
    assert.equal(duplicateScan.reason, "ALREADY_USED");

    // Wait for background markAsUsed job to complete (failureRate = 0, poll = 100ms)
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Verify job status via job list endpoint
    const jobs = assertSuccess(
      await invokeJson(checkinServer, {
        method: "GET",
        path: "/checkin/mark-as-used/jobs"
      })
    );
    assert.ok(jobs.length >= 1, "at least one markAsUsed job expected");
    const ourJob = jobs.find((j) => j.jobId === checkinData.markAsUsedJobId);
    assert.ok(ourJob, "our specific job should appear in the list");
    assert.equal(ourJob.status, "processed", `job should be processed, got ${ourJob.status}`);

    // ── Run Flow4CheckinHarness (forge script): purchase + markUsedBatch ─────

    const harnessOutput = runFlow4CheckinHarness({
      eventId: purchaseHashPayload.eventId,
      ticketTypeId: purchaseHashPayload.ticketTypeId,
      paymentHash: purchaseHashPayload.paymentHash,
      signature: purchaseHashPayload.signature
    });

    assert.match(harnessOutput, /FLOW4_HARNESS_OK/);
  } finally {
    disposeServer(paymentServer);
    disposeServer(checkinServer);
  }
});
