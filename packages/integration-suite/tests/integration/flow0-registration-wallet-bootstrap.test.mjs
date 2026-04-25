import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { disposeServer, invokeJson } from "../utils/server-harness.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");
const WALLET_ADDRESS = "0x000000000000000000000000000000000000dead";

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

function assertSuccess(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.payload));
  assert.equal(result.payload.success, true, JSON.stringify(result.payload));
  return result.payload.data;
}

test("flow0: phone verify + wallet bootstrap + one-time prefund", async () => {
  const { createAuthServer } = await importFromRepo("services/auth-service/dist/server.js");
  const { createPaymentOrchestratorServer } = await importFromRepo(
    "services/payment-orchestrator/dist/server.js"
  );

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
    prefundAmountWei: "1000000000000000",
    backendSignerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    ticketLedgerChainId: 84532,
    ticketLedgerAddress: "0x1000000000000000000000000000000000000001"
  });

  try {
    const phone = "+84901234567";
    const otp = assertSuccess(
      await invokeJson(authServer, {
        method: "POST",
        path: "/auth/otp/request",
        body: { phone }
      })
    );

    assert.ok(otp.requestId);
    assert.ok(otp.otpCode);

    const verified = assertSuccess(
      await invokeJson(authServer, {
        method: "POST",
        path: "/auth/otp/verify",
        body: {
          phone,
          requestId: otp.requestId,
          otp: otp.otpCode,
          deviceId: "web-chrome",
          platform: "web"
        }
      })
    );

    assert.ok(verified.userId);
    assert.ok(verified.sessionId);

    const first = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/wallet/register",
        headers: {
          "x-user-id": verified.userId
        },
        body: {
          walletAddress: WALLET_ADDRESS
        }
      })
    );

    const second = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/api/wallet/register",
        headers: {
          "x-user-id": verified.userId
        },
        body: {
          walletAddress: WALLET_ADDRESS
        }
      })
    );

    const prefund = assertSuccess(
      await invokeJson(paymentServer, {
        method: "GET",
        path: `/api/wallet/prefund/${WALLET_ADDRESS}`
      })
    );

    assert.equal(first.prefunded, true);
    assert.equal(second.prefunded, true);
    assert.equal(second.prefundTxHash, first.prefundTxHash);
    assert.equal(prefund.walletAddress, WALLET_ADDRESS);
    assert.equal(prefund.funded, true);
  } finally {
    disposeServer(paymentServer);
    disposeServer(authServer);
  }
});
