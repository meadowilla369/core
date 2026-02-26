import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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

test("backend integration suite with sandbox mocks for payment/KYC/wallet sessions", async () => {
  const { createAuthServer } = await importFromRepo("services/auth-service/dist/server.js");
  const { createKycServer } = await importFromRepo("services/kyc-service/dist/server.js");
  const { createPaymentOrchestratorServer } = await importFromRepo("services/payment-orchestrator/dist/server.js");

  const authServer = createAuthServer({
    serviceName: "auth-service",
    host: "127.0.0.1",
    port: 3001,
    otpLength: 6,
    otpTtlSec: 300,
    otpMaxRequestsPerWindow: 5,
    otpRateWindowSec: 900,
    accessTokenTtlSec: 900,
    refreshTokenTtlSec: 2_592_000,
    exposeOtpInResponse: true
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
    retryBaseDelaySec: 1
  });

  try {
    const phone = "+84909111222";
    const otp = assertSuccess(
      await invokeJson(authServer, {
        method: "POST",
        path: "/auth/otp/request",
        body: { phone }
      })
    );

    const session = assertSuccess(
      await invokeJson(authServer, {
        method: "POST",
        path: "/auth/otp/verify",
        body: {
          phone,
          requestId: otp.requestId,
          otp: otp.otpCode,
          deviceName: "Android test"
        }
      })
    );

    assert.ok(session.userId);
    assert.ok(session.refreshToken);

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

    const initiated = assertSuccess(
      await invokeJson(kycServer, {
        method: "POST",
        path: "/kyc/initiate",
        headers: {
          "x-user-id": session.userId
        },
        body: {
          provider: "fpt"
        }
      })
    );

    assert.equal(initiated.provider, "vnpt");
    assert.equal(initiated.fallbackUsed, true);

    const paymentIntent = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/payments/intents",
        headers: {
          "x-user-id": session.userId
        },
        body: {
          reservationId: "res_sandbox_001",
          amount: 900000,
          currency: "VND",
          gateway: "momo"
        }
      })
    );

    const webhookPayload = {
      eventId: "sandbox_event_001",
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: 900000,
      currency: "VND",
      gatewayTransactionId: "sandbox_tx_001"
    };
    const rawBody = JSON.stringify(webhookPayload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "sandbox_nonce_001";
    const signature = createWebhookSignature({
      timestamp,
      nonce,
      rawBody,
      secret: "momo_dev_secret"
    });

    assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/webhooks/momo",
        headers: {
          "x-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
          "x-webhook-nonce": nonce
        },
        body: webhookPayload
      })
    );

    const payment = assertSuccess(
      await invokeJson(paymentServer, {
        method: "GET",
        path: `/payments/${paymentIntent.paymentId}`
      })
    );

    assert.equal(payment.status, "confirmed");
  } finally {
    disposeServer(paymentServer);
    disposeServer(kycServer);
    disposeServer(authServer);
  }
});
