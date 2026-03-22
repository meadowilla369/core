import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { createWebhookSignature } from "../utils/signatures.mjs";
import { disposeServer, invokeJson } from "../utils/server-harness.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");
const BACKEND_SIGNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TICKET_LEDGER_ADDRESS = "0x1000000000000000000000000000000000000001";
const BUYER_WALLET_ADDRESS = "0x000000000000000000000000000000000000dead";

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

function assertSuccess(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.payload));
  assert.equal(result.payload.success, true, JSON.stringify(result.payload));
  return result.payload.data;
}

function runCast(args) {
  const result = spawnSync("cast", args, {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result.stdout.trim();
}

function backendSignerAddress() {
  return runCast(["wallet", "address", "--private-key", BACKEND_SIGNER_PRIVATE_KEY]).toLowerCase();
}

function buildTypedData(paymentHashPayload) {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" }
      ],
      Purchase: [
        { name: "eventId", type: "uint256" },
        { name: "ticketTypeId", type: "uint256" },
        { name: "quantity", type: "uint256" },
        { name: "paymentHash", type: "bytes32" },
        { name: "buyer", type: "address" }
      ]
    },
    primaryType: "Purchase",
    domain: {
      name: "TicketLedger",
      version: "1",
      chainId: paymentHashPayload.domain.chainId,
      verifyingContract: paymentHashPayload.domain.verifyingContract
    },
    message: {
      eventId: paymentHashPayload.eventId,
      ticketTypeId: paymentHashPayload.ticketTypeId,
      quantity: paymentHashPayload.quantity,
      paymentHash: paymentHashPayload.paymentHash,
      buyer: paymentHashPayload.buyer
    }
  };
}

function computeExpectedPaymentHash({ orderId, userId, ticketIds, amount, nonce }) {
  const encoded = runCast([
    "abi-encode",
    "f(string,string,string[],uint256,bytes32)",
    orderId,
    userId,
    JSON.stringify(ticketIds),
    String(amount),
    nonce
  ]);

  return runCast(["keccak", encoded]).toLowerCase();
}

function verifyTypedDataSignature({ address, typedData, signature }) {
  const result = spawnSync(
    "cast",
    ["wallet", "verify", "--data", "--address", address, JSON.stringify(typedData), signature],
    {
      cwd: REPO_ROOT,
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n"));
}

function createConfig(overrides = {}) {
  return {
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
    paymentHashTtlSec: 24 * 60 * 60,
    backendSignerPrivateKey: BACKEND_SIGNER_PRIVATE_KEY,
    ticketLedgerChainId: 84532,
    ticketLedgerAddress: TICKET_LEDGER_ADDRESS,
    prefundAmountWei: "1000000000000000",
    castBinaryPath: "cast",
    ...overrides
  };
}

async function createServer(overrides = {}) {
  const { createPaymentOrchestratorServer } = await importFromRepo(
    "services/payment-orchestrator/dist/server.js"
  );
  return createPaymentOrchestratorServer(createConfig(overrides));
}

async function createPaymentIntent(server, overrides = {}) {
  const orderId = overrides.orderId ?? "ord_pr05_001";
  const reservationId = overrides.reservationId ?? "res_pr05_001";
  const payment = assertSuccess(
    await invokeJson(server, {
      method: "POST",
      path: overrides.path ?? "/payments/intents",
      headers: {
        "x-user-id": overrides.userId ?? "usr_pr05_001"
      },
      body: {
        orderId,
        reservationId,
        amount: overrides.amount ?? 900000,
        currency: "VND",
        gateway: overrides.gateway ?? "momo",
        eventId: overrides.eventId ?? 1,
        ticketTypeId: overrides.ticketTypeId ?? 2,
        quantity: overrides.quantity ?? 2,
        ticketIds: overrides.ticketIds ?? ["seat_a_01", "seat_a_02"],
        buyerWalletAddress: overrides.buyerWalletAddress ?? BUYER_WALLET_ADDRESS
      }
    })
  );

  return payment;
}

async function confirmPayment(server, paymentIntent, overrides = {}) {
  const gateway = overrides.gateway ?? paymentIntent.gateway ?? "momo";
  const payload = {
    eventId: overrides.eventId ?? `evt_${paymentIntent.orderId}`,
    paymentId: overrides.paymentId ?? paymentIntent.paymentId,
    orderId: paymentIntent.orderId,
    status: overrides.status ?? "success",
    amount: overrides.amount ?? paymentIntent.amount,
    currency: "VND",
    gatewayTransactionId: overrides.gatewayTransactionId ?? `tx_${paymentIntent.orderId}`
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = overrides.nonce ?? `nonce_${paymentIntent.orderId}_${Date.now()}`;
  const signature = createWebhookSignature({
    timestamp,
    nonce,
    rawBody,
    secret: gateway === "momo" ? "momo_dev_secret" : "vnpay_dev_secret"
  });

  return invokeJson(server, {
    method: "POST",
    path: overrides.path ?? `/webhooks/${gateway}`,
    headers: {
      "x-webhook-signature": signature,
      "x-webhook-timestamp": timestamp,
      "x-webhook-nonce": nonce,
      ...(overrides.headers ?? {})
    },
    body: payload
  });
}

test("payment-orchestrator prefunds wallet only once", async () => {
  const server = await createServer();

  try {
    const first = assertSuccess(
      await invokeJson(server, {
        method: "POST",
        path: "/api/wallet/register",
        headers: {
          "x-user-id": "usr_wallet_001"
        },
        body: {
          walletAddress: BUYER_WALLET_ADDRESS
        }
      })
    );

    const second = assertSuccess(
      await invokeJson(server, {
        method: "POST",
        path: "/api/wallet/register",
        headers: {
          "x-user-id": "usr_wallet_001"
        },
        body: {
          walletAddress: BUYER_WALLET_ADDRESS
        }
      })
    );

    assert.equal(first.prefunded, true);
    assert.equal(second.prefunded, true);
    assert.equal(first.prefundTxHash, second.prefundTxHash);
    assert.equal(first.amountWei, second.amountWei);

    const status = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/wallet/prefund/${BUYER_WALLET_ADDRESS}`
      })
    );

    assert.equal(status.funded, true);
    assert.equal(status.txHash, first.prefundTxHash);
  } finally {
    disposeServer(server);
  }
});

test("payment-orchestrator generates payment hash after confirmed webhook", async () => {
  const server = await createServer();

  try {
    const paymentIntent = await createPaymentIntent(server, {
      path: "/api/payment/initiate",
      orderId: "ord_pr05_hash_001",
      reservationId: "res_pr05_hash_001",
      userId: "usr_pr05_hash_001"
    });

    const webhook = await confirmPayment(server, paymentIntent, {
      eventId: "evt_pr05_hash_001",
      path: "/webhook/payment?gateway=momo"
    });
    const webhookData = assertSuccess(webhook);
    assert.equal(webhookData.paymentHashIssued, true);

    const paymentHashPayload = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    assert.equal(paymentHashPayload.status, "ready");
    assert.equal(paymentHashPayload.paymentStatus, "confirmed");
    assert.equal(paymentHashPayload.orderId, paymentIntent.orderId);
    assert.deepEqual(paymentHashPayload.ticketIds, ["seat_a_01", "seat_a_02"]);
    assert.ok(/^0x[0-9a-f]{64}$/.test(paymentHashPayload.paymentHash));
    assert.ok(/^0x[0-9a-f]{64}$/.test(paymentHashPayload.nonce));
    assert.ok(/^0x[0-9a-f]{130}$/.test(paymentHashPayload.signature));

    const expectedHash = computeExpectedPaymentHash({
      orderId: paymentIntent.orderId,
      userId: paymentIntent.userId,
      ticketIds: paymentHashPayload.ticketIds,
      amount: paymentIntent.amount,
      nonce: paymentHashPayload.nonce
    });

    assert.equal(paymentHashPayload.paymentHash, expectedHash);
  } finally {
    disposeServer(server);
  }
});

test("payment-orchestrator signs payment hash using EIP-712 purchase typed data", async () => {
  const server = await createServer();

  try {
    const paymentIntent = await createPaymentIntent(server, {
      orderId: "ord_pr05_sig_001",
      reservationId: "res_pr05_sig_001",
      userId: "usr_pr05_sig_001"
    });

    assertSuccess(await confirmPayment(server, paymentIntent, { eventId: "evt_pr05_sig_001" }));

    const paymentHashPayload = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    const typedData = buildTypedData(paymentHashPayload);
    verifyTypedDataSignature({
      address: paymentHashPayload.signerAddress,
      typedData,
      signature: paymentHashPayload.signature
    });
  } finally {
    disposeServer(server);
  }
});

test("payment-orchestrator exposes the authorized backend signer for issued signatures", async () => {
  const server = await createServer();

  try {
    const paymentIntent = await createPaymentIntent(server, {
      orderId: "ord_pr05_signer_001",
      reservationId: "res_pr05_signer_001",
      userId: "usr_pr05_signer_001"
    });

    assertSuccess(await confirmPayment(server, paymentIntent, { eventId: "evt_pr05_signer_001" }));

    const paymentHashPayload = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    assert.equal(paymentHashPayload.signerAddress, backendSignerAddress());
  } finally {
    disposeServer(server);
  }
});

test("payment-orchestrator rejects invalid webhook signatures", async () => {
  const server = await createServer();

  try {
    const paymentIntent = await createPaymentIntent(server, {
      orderId: "ord_pr05_invalid_001",
      reservationId: "res_pr05_invalid_001",
      userId: "usr_pr05_invalid_001"
    });

    const webhookPayload = {
      eventId: "evt_pr05_invalid_001",
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: paymentIntent.amount,
      currency: "VND",
      gatewayTransactionId: "tx_invalid_signature_001"
    };

    const result = await invokeJson(server, {
      method: "POST",
      path: "/webhooks/momo",
      headers: {
        "x-webhook-signature": "deadbeef",
        "x-webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-webhook-nonce": "nonce_invalid_signature_001"
      },
      body: webhookPayload
    });

    assert.equal(result.status, 401);
    assert.equal(result.payload.success, false);
    assert.equal(result.payload.error.code, "WEBHOOK_SIGNATURE_INVALID");
  } finally {
    disposeServer(server);
  }
});

test("payment-orchestrator handles duplicate webhook deliveries idempotently", async () => {
  const server = await createServer();

  try {
    const paymentIntent = await createPaymentIntent(server, {
      orderId: "ord_pr05_idempotent_001",
      reservationId: "res_pr05_idempotent_001",
      userId: "usr_pr05_idempotent_001"
    });

    const firstWebhook = assertSuccess(
      await confirmPayment(server, paymentIntent, {
        eventId: "evt_pr05_idempotent_001",
        nonce: "nonce_pr05_idempotent_001"
      })
    );
    assert.equal(firstWebhook.paymentHashIssued, true);

    const firstHashPayload = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    const duplicateWebhook = assertSuccess(
      await confirmPayment(server, paymentIntent, {
        eventId: "evt_pr05_idempotent_001",
        nonce: "nonce_pr05_idempotent_002"
      })
    );

    assert.equal(duplicateWebhook.status, "duplicate");

    const secondHashPayload = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    assert.equal(firstHashPayload.paymentHash, secondHashPayload.paymentHash);
    assert.equal(firstHashPayload.signature, secondHashPayload.signature);
  } finally {
    disposeServer(server);
  }
});

test("payment-orchestrator expires issued payment hashes after the configured TTL", async () => {
  const server = await createServer({
    paymentHashTtlSec: 1
  });

  try {
    const paymentIntent = await createPaymentIntent(server, {
      orderId: "ord_pr05_expiry_001",
      reservationId: "res_pr05_expiry_001",
      userId: "usr_pr05_expiry_001"
    });

    assertSuccess(await confirmPayment(server, paymentIntent, { eventId: "evt_pr05_expiry_001" }));

    const issued = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );
    assert.equal(issued.status, "ready");

    await delay(1_100);

    const expired = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: `/api/payment/hash/${paymentIntent.orderId}`
      })
    );

    assert.equal(expired.status, "expired");
    assert.equal(expired.paymentHash, issued.paymentHash);
  } finally {
    disposeServer(server);
  }
});
