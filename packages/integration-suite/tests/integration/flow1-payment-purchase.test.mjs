import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { flow1HarnessDefaults, runFlow1PurchaseHarness } from "../utils/flow1-harness.mjs";
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

test("flow 1 end-to-end: issued payment authorization is consumed by Handler -> TicketLedger -> Paymaster", async () => {
  const { createPaymentOrchestratorServer } = await importFromRepo(
    "services/payment-orchestrator/dist/server.js"
  );
  const flow1 = flow1HarnessDefaults();
  const runId = randomUUID().replace(/-/g, "").slice(0, 12);
  const orderId = `ord_flow1_${runId}`;
  const reservationId = `res_flow1_${runId}`;

  const paymentServer = createPaymentOrchestratorServer({
    serviceName: "payment-orchestrator",
    host: "127.0.0.1",
    port: 3006,
    allowedGateways: ["momo", "vnpay"],
    momoWebhookSecret: "momo_dev_secret",
    vnpayWebhookSecret: "vnpay_dev_secret",
    webhookMaxSkewSec: 300,
    webhookNonceTtlSec: 1800,
    maxWebhookRetries: 5,
    retryBaseDelaySec: 1,
    backendSignerPrivateKey: flow1.adminPrivateKey,
    ticketLedgerChainId: flow1.chainId,
    ticketLedgerAddress: flow1.ledgerAddress
  });

  try {
    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/wallet/register",
        headers: {
          "x-user-id": "usr_flow1_001"
        },
        body: {
          walletAddress: flow1.buyerAddress
        }
      })
    );

    const paymentIntent = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/payment/initiate",
        headers: {
          "x-user-id": "usr_flow1_001"
        },
        body: {
          orderId,
          reservationId,
          amount: 1800000,
          currency: "VND",
          gateway: "momo",
          eventId: 1,
          ticketTypeId: 2,
          quantity: 2,
          ticketIds: [`${reservationId}:1`, `${reservationId}:2`],
          buyerWalletAddress: flow1.buyerAddress
        }
      })
    );

    const webhookBody = {
      eventId: `evt_flow1_${runId}`,
      orderId: paymentIntent.orderId,
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: paymentIntent.amount,
      currency: "VND",
      gatewayTransactionId: `momo_txn_flow1_${runId}`
    };
    const rawBody = JSON.stringify(webhookBody);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = `nonce_flow1_${runId}`;
    const signature = createWebhookSignature({
      timestamp,
      nonce,
      rawBody,
      secret: "momo_dev_secret"
    });

    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/webhook/payment?gateway=momo",
        headers: {
          "x-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
          "x-webhook-nonce": nonce
        },
        body: webhookBody
      })
    );

    const paymentHashPayload = assertSuccess(
      await invokeJson(paymentServer, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    assert.equal(paymentHashPayload.status, "ready");
    assert.equal(paymentHashPayload.paymentStatus, "confirmed");
    assert.equal(paymentHashPayload.domain.verifyingContract, flow1.ledgerAddress);

    const harnessOutput = runFlow1PurchaseHarness({
      ledgerAddress: paymentHashPayload.domain.verifyingContract,
      eventId: paymentHashPayload.eventId,
      ticketTypeId: paymentHashPayload.ticketTypeId,
      quantity: paymentHashPayload.quantity,
      paymentHash: paymentHashPayload.paymentHash,
      signature: paymentHashPayload.signature
    });

    assert.match(harnessOutput, /FLOW1_HARNESS_OK/);
  } finally {
    disposeServer(paymentServer);
  }
});
