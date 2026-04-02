import assert from "node:assert/strict";
import test from "node:test";

import { expectSuccess } from "../utils/http.mjs";
import { resetPostgresTables } from "../utils/postgres.mjs";
import { startService, stopService, waitForHealth } from "../utils/process.mjs";

const SELLER_WALLET_ADDRESS = "0x0000000000000000000000000000000000000a11";
const BUYER_WALLET_ADDRESS = "0x0000000000000000000000000000000000000b22";
const INTERNAL_API_KEY = "internal_dev_key";
const SERVICE_ENV = {
  HOST: "127.0.0.1",
  PORT: "3107",
  INTERNAL_API_KEY
};
const SERVICE_BASE_URL = `http://${SERVICE_ENV.HOST}:${SERVICE_ENV.PORT}`;
const MARKETPLACE_TABLES = [
  "marketplace_buy_hashes",
  "marketplace_settlement_ledger",
  "marketplace_completed_sales",
  "marketplace_idempotency",
  "marketplace_listings"
];

async function bootMarketplace() {
  const handle = startService(
    "marketplace-service",
    "marketplace-service",
    SERVICE_ENV,
    process.cwd()
  );

  try {
    await waitForHealth(SERVICE_BASE_URL);
    return handle;
  } catch (error) {
    await stopService(handle);
    throw error;
  }
}

test("marketplace-service persists listings, buy hashes, and settlements across restart", async () => {
  await resetPostgresTables(MARKETPLACE_TABLES);

  let service = await bootMarketplace();

  try {
    const listing = await expectSuccess(SERVICE_BASE_URL, "/marketplace/listings", {
      method: "POST",
      headers: {
        "x-user-id": "seller_restart_001",
        "x-kyc-status": "approved"
      },
      body: {
        tokenId: "token_restart_001",
        eventId: "event_restart_001",
        sellerWalletAddress: SELLER_WALLET_ADDRESS,
        originalPrice: 1_000_000,
        askPrice: 1_100_000
      }
    });

    const issuedBuyHash = await expectSuccess(
      SERVICE_BASE_URL,
      `/marketplace/listings/${listing.id}/initiate-buy`,
      {
        method: "POST",
        headers: {
          "x-user-id": "buyer_restart_001"
        },
        body: {
          orderId: "ord_buy_restart_001",
          amount: 1_100_000,
          buyerWalletAddress: BUYER_WALLET_ADDRESS,
          onChainListingId: 901
        }
      }
    );

    const purchase = await expectSuccess(
      SERVICE_BASE_URL,
      `/marketplace/listings/${listing.id}/purchase`,
      {
        method: "POST",
        headers: {
          "x-user-id": "buyer_restart_001",
          "idempotency-key": "purchase_restart_001"
        },
        body: {
          paymentId: "pay_restart_001",
          gateway: "momo",
          gatewayReference: "gw_restart_ref_001",
          buyerWalletAddress: BUYER_WALLET_ADDRESS
        }
      }
    );

    const finalizePayload = {
      ...purchase.settlement.escrowPayload,
      gatewayReference: "gw_restart_ref_001"
    };

    const settlement = await expectSuccess(
      SERVICE_BASE_URL,
      "/internal/marketplace/settlements/finalize",
      {
        method: "POST",
        headers: {
          "x-internal-api-key": INTERNAL_API_KEY
        },
        body: finalizePayload
      }
    );

    await stopService(service);
    service = await bootMarketplace();

    const completedListings = await expectSuccess(
      SERVICE_BASE_URL,
      "/marketplace/listings?status=completed"
    );
    assert.equal(completedListings.length, 1);
    assert.equal(completedListings[0].id, listing.id);
    assert.equal(completedListings[0].status, "completed");
    assert.equal(completedListings[0].buyerUserId, "buyer_restart_001");
    assert.equal(completedListings[0].paymentId, "pay_restart_001");
    assert.equal(completedListings[0].settlementId, purchase.listing.settlementId);

    const restoredBuyHash = await expectSuccess(
      SERVICE_BASE_URL,
      `/marketplace/listings/${listing.id}/buy-hash`,
      {
        headers: {
          "x-user-id": "buyer_restart_001"
        }
      }
    );
    assert.equal(restoredBuyHash.orderId, issuedBuyHash.orderId);
    assert.equal(restoredBuyHash.paymentHash, issuedBuyHash.paymentHash);
    assert.equal(restoredBuyHash.signature, issuedBuyHash.signature);
    assert.equal(restoredBuyHash.signerAddress, issuedBuyHash.signerAddress);

    const sales = await expectSuccess(SERVICE_BASE_URL, "/marketplace/me/sales", {
      headers: {
        "x-user-id": "seller_restart_001"
      }
    });
    assert.equal(sales.length, 1);
    assert.equal(sales[0].listingId, listing.id);
    assert.equal(sales[0].paymentId, "pay_restart_001");
    assert.equal(sales[0].settlementId, purchase.listing.settlementId);
    assert.equal(sales[0].escrowDataHash, purchase.settlement.escrowDataHash);

    const restoredSettlement = await expectSuccess(
      SERVICE_BASE_URL,
      "/internal/marketplace/settlements/finalize",
      {
        method: "POST",
        headers: {
          "x-internal-api-key": INTERNAL_API_KEY
        },
        body: finalizePayload
      }
    );
    assert.equal(restoredSettlement.settlementId, settlement.settlementId);
    assert.equal(restoredSettlement.submitTxHash, settlement.submitTxHash);
    assert.equal(restoredSettlement.escrowDataHash, settlement.escrowDataHash);
  } finally {
    await stopService(service);
  }
});
