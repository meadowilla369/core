import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

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

test("chaos: RPC outage, webhook delay, and KYC provider outage", async () => {
  const { createWorkerMintServer } = await importFromRepo("services/worker-mint/dist/server.js");
  const { createPaymentOrchestratorServer } = await importFromRepo("services/payment-orchestrator/dist/server.js");
  const { createKycServer } = await importFromRepo("services/kyc-service/dist/server.js");

  const mintServer = createWorkerMintServer({
    serviceName: "worker-mint",
    host: "127.0.0.1",
    port: 3010,
    maxAttempts: 2,
    maxBatchSize: 10,
    retryBaseDelaySec: 1,
    tokenIdSeed: 100000
  });
  const paymentServer = createPaymentOrchestratorServer({
    serviceName: "payment-orchestrator",
    host: "127.0.0.1",
    port: 3006,
    allowedGateways: ["momo", "vnpay"],
    momoWebhookSecret: "momo_dev_secret",
    vnpayWebhookSecret: "vnpay_dev_secret",
    webhookMaxSkewSec: 300,
    webhookNonceTtlSec: 1800,
    maxWebhookRetries: 2,
    retryBaseDelaySec: 1
  });
  const kycServer = createKycServer({
    serviceName: "kyc-service",
    host: "127.0.0.1",
    port: 3003,
    provider: "fpt",
    fallbackProvider: "vnpt",
    internalApiKey: "internal_dev_key",
    minLivenessScore: 0.8,
    minFaceMatchScore: 0.7
  });

  try {
    const failingJob = assertSuccess(
      await invokeJson(mintServer, {
        method: "POST",
        path: "/mint/jobs",
        body: {
          paymentId: "pay_outage_001",
          reservationId: "res_outage_001",
          userId: "usr_outage_001",
          walletAddress: "0xwallet_outage",
          eventId: "evt_outage",
          ticketTypeId: "tt_outage",
          quantity: 1,
          forceFailures: 3
        }
      })
    );

    assertSuccess(
      await invokeJson(mintServer, {
        method: "POST",
        path: "/mint/run",
        body: { limit: 10 }
      })
    );
    await delay(1_100);
    assertSuccess(
      await invokeJson(mintServer, {
        method: "POST",
        path: "/mint/run",
        body: { limit: 10 }
      })
    );

    const failedJob = assertSuccess(
      await invokeJson(mintServer, {
        method: "GET",
        path: `/mint/jobs/${failingJob.jobId}`
      })
    );
    assert.equal(failedJob.status, "failed");

    const paymentIntent = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/payments/intents",
        headers: {
          "x-user-id": "usr_delay_001"
        },
        body: {
          reservationId: "res_delay_001",
          amount: 500000,
          currency: "VND",
          gateway: "momo"
        }
      })
    );

    const delayedPayload = {
      eventId: "delay_event_001",
      paymentId: "pay_missing_001",
      status: "success",
      amount: 500000,
      currency: "VND"
    };
    const delayedRaw = JSON.stringify(delayedPayload);
    const delayedSignature = createWebhookSignature({
      timestamp: String(Math.floor(Date.now() / 1000)),
      nonce: "delay_nonce_001",
      rawBody: delayedRaw,
      secret: "momo_dev_secret"
    });

    const queued = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/webhooks/momo",
        headers: {
          "x-webhook-signature": delayedSignature,
          "x-webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "x-webhook-nonce": "delay_nonce_001"
        },
        body: delayedPayload
      }),
      202
    );
    assert.equal(queued.status, "queued_retry");

    const onTimePayload = {
      eventId: "delay_event_002",
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: 500000,
      currency: "VND",
      gatewayTransactionId: "tx_delay_002"
    };
    const onTimeRaw = JSON.stringify(onTimePayload);
    const onTimeSignature = createWebhookSignature({
      timestamp: String(Math.floor(Date.now() / 1000)),
      nonce: "delay_nonce_002",
      rawBody: onTimeRaw,
      secret: "momo_dev_secret"
    });

    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/webhooks/momo",
        headers: {
          "x-webhook-signature": onTimeSignature,
          "x-webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "x-webhook-nonce": "delay_nonce_002"
        },
        body: onTimePayload
      })
    );

    const payment = assertSuccess(
      await invokeJson(paymentServer, {
        method: "GET",
        path: `/payments/${paymentIntent.paymentId}`
      })
    );
    assert.equal(payment.status, "confirmed");

    assertSuccess(
      await invokeJson(kycServer, {
        method: "POST",
        path: "/kyc/providers/status",
        headers: {
          "x-internal-api-key": "internal_dev_key"
        },
        body: {
          provider: "fpt",
          status: "down"
        }
      })
    );
    assertSuccess(
      await invokeJson(kycServer, {
        method: "POST",
        path: "/kyc/providers/status",
        headers: {
          "x-internal-api-key": "internal_dev_key"
        },
        body: {
          provider: "vnpt",
          status: "down"
        }
      })
    );

    const outage = await invokeJson(kycServer, {
      method: "POST",
      path: "/kyc/initiate",
      headers: {
        "x-user-id": "usr_kyc_outage"
      },
      body: {
        provider: "fpt"
      }
    });

    assert.equal(outage.status, 503);
    assert.equal(outage.payload.error.code, "KYC_PROVIDER_UNAVAILABLE");
  } finally {
    disposeServer(kycServer);
    disposeServer(paymentServer);
    disposeServer(mintServer);
  }
});
