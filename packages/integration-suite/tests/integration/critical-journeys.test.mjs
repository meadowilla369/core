import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { createCheckinSignature, createWebhookSignature } from "../utils/signatures.mjs";
import { disposeServer, invokeJson } from "../utils/server-harness.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

function assertSuccess(result, code = 200) {
  assert.equal(result.status, code, JSON.stringify(result.payload));
  assert.equal(result.payload.success, true, JSON.stringify(result.payload));
  return result.payload.data;
}

test("critical journey: registration + wallet session provisioning", async () => {
  const { createAuthServer } = await importFromRepo("services/auth-service/dist/server.js");
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

  try {
    const phone = "+84901234567";
    const otp = assertSuccess(
      await invokeJson(authServer, {
        method: "POST",
        path: "/auth/otp/request",
        body: { phone }
      })
    );

    const verified = assertSuccess(
      await invokeJson(authServer, {
        method: "POST",
        path: "/auth/otp/verify",
        body: {
          phone,
          requestId: otp.requestId,
          otp: otp.otpCode,
          deviceId: "ios-device-01",
          platform: "ios"
        }
      })
    );

    assert.ok(verified.userId);
    assert.ok(verified.sessionId);

    const sessions = assertSuccess(
      await invokeJson(authServer, {
        method: "GET",
        path: "/auth/sessions",
        headers: {
          "x-user-id": verified.userId
        }
      })
    );

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].sessionId, verified.sessionId);
  } finally {
    disposeServer(authServer);
  }
});

test("critical journey: purchase + payment webhook + mint", async () => {
  const { createTicketingServer } = await importFromRepo("services/ticketing-service/dist/server.js");
  const { createPaymentOrchestratorServer } = await importFromRepo("services/payment-orchestrator/dist/server.js");
  const { createWorkerMintServer } = await importFromRepo("services/worker-mint/dist/server.js");

  const ticketingServer = createTicketingServer({
    serviceName: "ticketing-service",
    host: "127.0.0.1",
    port: 3005,
    reservationTtlSec: 900,
    internalApiKey: "internal-dev-key"
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
  const mintServer = createWorkerMintServer({
    serviceName: "worker-mint",
    host: "127.0.0.1",
    port: 3010,
    maxAttempts: 3,
    maxBatchSize: 10,
    retryBaseDelaySec: 1,
    tokenIdSeed: 100000
  });

  try {
    const userId = "usr_purchase_001";

    const reservation = assertSuccess(
      await invokeJson(ticketingServer, {
        method: "POST",
        path: "/tickets/reserve",
        headers: {
          "x-user-id": userId,
          "idempotency-key": "reserve-001"
        },
        body: {
          eventId: "evt_rockfest_2026",
          ticketTypeId: "tt_rockfest_ga",
          quantity: 2
        }
      })
    );

    const purchase = assertSuccess(
      await invokeJson(ticketingServer, {
        method: "POST",
        path: "/tickets/purchase",
        headers: {
          "x-user-id": userId,
          "idempotency-key": "purchase-001"
        },
        body: {
          reservationId: reservation.reservationId,
          paymentMethod: "momo"
        }
      })
    );

    const paymentIntent = assertSuccess(
      await invokeJson(paymentServer, {
        method: "POST",
        path: "/payments/intents",
        headers: {
          "x-user-id": userId
        },
        body: {
          reservationId: reservation.reservationId,
          amount: purchase.totalAmount,
          currency: "VND",
          gateway: "momo"
        }
      })
    );

    const webhookBody = {
      eventId: `evt_paid_${paymentIntent.paymentId}`,
      paymentId: paymentIntent.paymentId,
      status: "success",
      amount: purchase.totalAmount,
      currency: "VND",
      gatewayTransactionId: "momo_txn_critical_01"
    };
    const rawBody = JSON.stringify(webhookBody);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce-critical-001";
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
        body: webhookBody
      })
    );

    const payment = assertSuccess(
      await invokeJson(paymentServer, {
        method: "GET",
        path: `/payments/${paymentIntent.paymentId}`
      })
    );
    assert.equal(payment.status, "confirmed");

    const confirmed = assertSuccess(
      await invokeJson(ticketingServer, {
        method: "POST",
        path: `/tickets/purchase/${reservation.reservationId}/confirm`,
        headers: {
          "x-internal-api-key": "internal-dev-key"
        },
        body: {
          gatewayTransactionId: payment.gatewayTransactionId,
          status: "paid"
        }
      })
    );

    const mintJob = assertSuccess(
      await invokeJson(mintServer, {
        method: "POST",
        path: "/mint/jobs",
        body: {
          paymentId: payment.paymentId,
          reservationId: reservation.reservationId,
          userId,
          walletAddress: "0xbuyerwallet001",
          eventId: reservation.eventId,
          ticketTypeId: reservation.ticketTypeId,
          quantity: reservation.quantity
        }
      })
    );

    const run = assertSuccess(
      await invokeJson(mintServer, {
        method: "POST",
        path: "/mint/run",
        body: {
          limit: 5
        }
      })
    );
    assert.equal(run.minted, 1);

    const minted = assertSuccess(
      await invokeJson(mintServer, {
        method: "GET",
        path: `/mint/jobs/${mintJob.jobId}`
      })
    );
    assert.equal(minted.status, "minted");
  } finally {
    disposeServer(mintServer);
    disposeServer(paymentServer);
    disposeServer(ticketingServer);
  }
});

test("critical journey: resale listing + purchase + escrow settlement", async () => {
  const { createMarketplaceServer } = await importFromRepo("services/marketplace-service/dist/server.js");
  const marketplaceServer = createMarketplaceServer({
    serviceName: "marketplace-service",
    host: "127.0.0.1",
    port: 3007,
    chainId: 31337,
    marketplaceContractAddress: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
    ticketNftAddress: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    maxMarkupBps: 12000,
    platformFeeBps: 500,
    organizerRoyaltyBps: 500,
    resaleCutoffMinutes: 30,
    resaleKycThresholdVnd: 5_000_000,
    maxResaleCount: 2,
    policyTimezone: "Asia/Ho_Chi_Minh",
    internalApiKey: "internal_dev_key"
  });

  try {
    const listing = assertSuccess(
      await invokeJson(marketplaceServer, {
        method: "POST",
        path: "/marketplace/listings",
        headers: {
          "x-user-id": "usr_seller_001",
          "x-kyc-status": "approved"
        },
        body: {
          tokenId: "token_resale_001",
          eventId: "evt_rockfest_2026",
          sellerWalletAddress: "0xsellerwallet",
          originalPrice: 1_000_000,
          askPrice: 1_100_000,
          eventStartAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      })
    );

    const purchased = assertSuccess(
      await invokeJson(marketplaceServer, {
        method: "POST",
        path: `/marketplace/listings/${listing.id}/purchase`,
        headers: {
          "x-user-id": "usr_buyer_001"
        },
        body: {
          paymentId: "pay_market_001",
          buyerWalletAddress: "0xbuyerwallet001",
          gateway: "momo",
          gatewayReference: "momo-ref-escrow-001"
        }
      })
    );

    assert.equal(purchased.listing.status, "completed");
    assert.ok(purchased.settlement.escrowDataHash);

    const finalized = assertSuccess(
      await invokeJson(marketplaceServer, {
        method: "POST",
        path: "/internal/marketplace/settlements/finalize",
        headers: {
          "x-internal-api-key": "internal_dev_key"
        },
        body: {
          ...purchased.settlement.escrowPayload,
          gatewayReference: "momo-ref-escrow-001"
        }
      })
    );

    assert.equal(finalized.status, "submitted");
  } finally {
    disposeServer(marketplaceServer);
  }
});

test("critical journey: check-in success + duplicate/race rejection", async () => {
  const { createCheckinServer } = await importFromRepo("services/checkin-service/dist/server.js");
  const checkinServer = createCheckinServer({
    serviceName: "checkin-service",
    host: "127.0.0.1",
    port: 3008,
    qrSignatureSecret: "checkin_dev_secret",
    maxQrAgeSec: 30,
    maxClockSkewSec: 10,
    markAsUsedPollMs: 50,
    markAsUsedMaxRetries: 2,
    markAsUsedFailureRate: 0
  });

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const qr = {
      tokenId: "token_checkin_001",
      eventId: "evt_checkin_001",
      timestamp,
      nonce: "nonce-checkin-001",
      walletAddress: "0xattendee001"
    };

    const signature = createCheckinSignature({ ...qr, secret: "checkin_dev_secret" });

    const first = assertSuccess(
      await invokeJson(checkinServer, {
        method: "POST",
        path: "/checkin/verify",
        body: {
          gateId: "gate-a",
          qrData: {
            ...qr,
            signature
          }
        }
      })
    );
    assert.equal(first.valid, true);

    const duplicate = assertSuccess(
      await invokeJson(checkinServer, {
        method: "POST",
        path: "/checkin/verify",
        body: {
          gateId: "gate-b",
          qrData: {
            ...qr,
            signature
          }
        }
      })
    );

    assert.equal(duplicate.valid, false);
    assert.equal(duplicate.reason, "NONCE_REPLAYED");

    const raceA = {
      tokenId: "token_checkin_race_001",
      eventId: "evt_checkin_001",
      timestamp,
      nonce: "nonce-race-a",
      walletAddress: "0xattendee001"
    };
    const raceB = {
      tokenId: "token_checkin_race_001",
      eventId: "evt_checkin_001",
      timestamp,
      nonce: "nonce-race-b",
      walletAddress: "0xattendee001"
    };

    const [left, right] = await Promise.all([
      invokeJson(checkinServer, {
        method: "POST",
        path: "/checkin/verify",
        body: {
          gateId: "gate-a",
          qrData: {
            ...raceA,
            signature: createCheckinSignature({ ...raceA, secret: "checkin_dev_secret" })
          }
        }
      }),
      invokeJson(checkinServer, {
        method: "POST",
        path: "/checkin/verify",
        body: {
          gateId: "gate-b",
          qrData: {
            ...raceB,
            signature: createCheckinSignature({ ...raceB, secret: "checkin_dev_secret" })
          }
        }
      })
    ]);

    const outcomes = [assertSuccess(left), assertSuccess(right)];
    const validCount = outcomes.filter((item) => item.valid === true).length;
    assert.equal(validCount, 1);
  } finally {
    disposeServer(checkinServer);
  }
});

test("critical journey: event cancellation + refund", async () => {
  const { createEventServer } = await importFromRepo("services/event-service/dist/server.js");
  const { createRefundServer } = await importFromRepo("services/refund-service/dist/server.js");

  const eventServer = createEventServer({
    serviceName: "event-service",
    host: "127.0.0.1",
    port: 3004
  });
  const refundServer = createRefundServer({
    serviceName: "refund-service",
    host: "127.0.0.1",
    port: 3009,
    payoutSyncPollMs: 100,
    maxRetryCount: 3,
    retryBaseDelaySec: 1,
    payoutFailureRate: 0
  });

  try {
    const event = assertSuccess(
      await invokeJson(eventServer, {
        method: "POST",
        path: "/events",
        headers: {
          "x-organizer-id": "org_001"
        },
        body: {
          title: "Pilot event",
          city: "Hanoi",
          venue: "NCC",
          startAt: "2026-06-01T20:00:00.000Z",
          endAt: "2026-06-01T22:00:00.000Z"
        }
      })
    );

    const cancelled = assertSuccess(
      await invokeJson(eventServer, {
        method: "POST",
        path: `/events/${event.id}/cancel`,
        headers: {
          "x-organizer-id": "org_001"
        }
      })
    );
    assert.equal(cancelled.status, "cancelled");

    const refund = assertSuccess(
      await invokeJson(refundServer, {
        method: "POST",
        path: "/refunds/requests",
        headers: {
          "x-user-id": "usr_refund_001"
        },
        body: {
          ticketId: "ticket_ref_001",
          eventId: event.id,
          paymentId: "pay_ref_001",
          originalPurchasePrice: 900000,
          eventStatus: "cancelled"
        }
      })
    );

    assertSuccess(
      await invokeJson(refundServer, {
        method: "POST",
        path: "/refunds/sync",
        body: {}
      })
    );

    const finalState = assertSuccess(
      await invokeJson(refundServer, {
        method: "GET",
        path: `/refunds/${refund.refundId}`
      })
    );
    assert.equal(finalState.status, "completed");
  } finally {
    disposeServer(refundServer);
    disposeServer(eventServer);
  }
});

test("critical journey: recovery + dispute escalation", async () => {
  const { createRecoveryServer } = await importFromRepo("services/recovery-service/dist/server.js");
  const { createDisputeServer } = await importFromRepo("services/dispute-service/dist/server.js");

  const recoveryServer = createRecoveryServer({
    serviceName: "recovery-service",
    host: "127.0.0.1",
    port: 3011,
    holdDurationSec: 1,
    requiredVerificationChannels: 2,
    eligibilityScanIntervalMs: 100
  });
  const disputeServer = createDisputeServer({
    serviceName: "dispute-service",
    host: "127.0.0.1",
    port: 3012,
    slaTier1Hours: 24,
    slaTier2Hours: 48,
    slaTier3Hours: 72,
    internalApiKey: "internal_dev_key"
  });

  try {
    const userId = "usr_recovery_001";
    const initiated = assertSuccess(
      await invokeJson(recoveryServer, {
        method: "POST",
        path: "/recovery/initiate",
        headers: {
          "x-user-id": userId
        },
        body: {
          newDeviceFingerprint: "ios-device-001",
          currentGuardianAddress: "0xguard_old",
          requestedGuardianAddress: "0xguard_new"
        }
      })
    );

    assertSuccess(
      await invokeJson(recoveryServer, {
        method: "POST",
        path: "/recovery/verify",
        body: {
          recoveryId: initiated.recoveryId,
          channel: "phone_otp",
          code: "123456"
        }
      })
    );

    const onHold = assertSuccess(
      await invokeJson(recoveryServer, {
        method: "POST",
        path: "/recovery/verify",
        body: {
          recoveryId: initiated.recoveryId,
          channel: "email_otp",
          code: "456789"
        }
      })
    );
    assert.equal(onHold.status, "on_hold");

    await delay(1_200);

    const rotated = assertSuccess(
      await invokeJson(recoveryServer, {
        method: "POST",
        path: `/recovery/${initiated.recoveryId}/rotate-guardian`,
        body: {
          requestedGuardianAddress: "0xguard_final"
        }
      })
    );

    assert.equal(rotated.status, "completed");

    const dispute = assertSuccess(
      await invokeJson(disputeServer, {
        method: "POST",
        path: "/disputes",
        headers: {
          "x-user-id": userId
        },
        body: {
          category: "payment_issue",
          title: "Charged but ticket missing",
          description: "Payment completed and ticket not visible",
          disputedAmount: 900000
        }
      })
    );

    const escalated = assertSuccess(
      await invokeJson(disputeServer, {
        method: "POST",
        path: `/disputes/${dispute.disputeId}/escalate`,
        headers: {
          "x-user-id": userId
        },
        body: {
          reason: "needs_manual_review"
        }
      })
    );

    assert.equal(escalated.currentTier, 2);
    assert.equal(escalated.status, "escalated");
  } finally {
    disposeServer(disputeServer);
    disposeServer(recoveryServer);
  }
});
