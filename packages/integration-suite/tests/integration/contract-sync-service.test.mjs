/**
 * PR-06 contract-sync-service integration test
 *
 * Verifies that the contract-sync-service HTTP server correctly ingests
 * on-chain contract events (as would be emitted by the chain listener worker)
 * and reflects ownership / listing state that Flow-1 / Flow-2 downstream
 * services can query.
 *
 * This test does NOT require a live blockchain or anvil — it drives the
 * in-process HTTP server directly via the same invokeJson harness used by the
 * payment-orchestrator tests.
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const CONTRACT_SYNC_CONFIG = {
  serviceName: "contract-sync-service",
  host: "127.0.0.1",
  port: 3014,
  internalApiKey: "integration-test-key"
};

// ---------------------------------------------------------------------------
// Scenario: Flow-1 purchase produces a Transfer event → sync → query
// ---------------------------------------------------------------------------

test("contract-sync-service: Flow-1 Transfer event syncs ticket ownership", async () => {
  const { createContractSyncServer } = await importFromRepo(
    "services/contract-sync-service/dist/server.js"
  );
  const server = createContractSyncServer(CONTRACT_SYNC_CONFIG);

  try {
    // 1. Health check
    assertSuccess(await invokeJson(server, { method: "GET", path: "/healthz" }));

    // 2. Simulate Transfer event emitted by TicketLedger.purchaseWithSignature()
    const ingestResult = assertSuccess(
      await invokeJson(server, {
        method: "POST",
        path: "/internal/contracts/events",
        headers: { "x-internal-api-key": "integration-test-key" },
        body: {
          events: [
            {
              chainId: 31337,
              blockNumber: 1001,
              transactionHash: "0xflow1_tx_001",
              logIndex: 0,
              eventName: "Transfer",
              contractAddress: "0xticketledger0001",
              occurredAt: "2024-06-01T10:00:00.000Z",
              payload: {
                tokenId: "event_1:type_2:001",
                to: "0xbuyerwallet001",
                toUserId: "usr_flow1_001"
              }
            }
          ]
        }
      })
    );

    assert.equal(ingestResult.accepted, 1);
    assert.equal(ingestResult.rejected, 0);

    // 3. Query token state — should reflect the buyer as owner
    const tokenState = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: "/internal/contracts/tokens/event_1:type_2:001"
      })
    );

    assert.equal(tokenState.ownerWalletAddress, "0xbuyerwallet001");
    assert.equal(tokenState.ownerUserId, "usr_flow1_001");
    assert.equal(tokenState.isUsed, false);
    assert.equal(tokenState.listingStatus, "none");
    assert.equal(tokenState.lastSyncedBlock, 1001);
  } finally {
    disposeServer(server);
  }
});

// ---------------------------------------------------------------------------
// Scenario: Flow-2 resale produces Transfer → ListingStatusChanged → Transfer
// ---------------------------------------------------------------------------

test("contract-sync-service: Flow-2 resale listing and sale updates token state", async () => {
  const { createContractSyncServer } = await importFromRepo(
    "services/contract-sync-service/dist/server.js"
  );
  const server = createContractSyncServer(CONTRACT_SYNC_CONFIG);

  try {
    // Initial minting Transfer (seller received ticket)
    await invokeJson(server, {
      method: "POST",
      path: "/internal/contracts/events",
      headers: { "x-internal-api-key": "integration-test-key" },
      body: {
        events: [
          {
            blockNumber: 2001,
            transactionHash: "0xflow2_tx_001",
            logIndex: 0,
            eventName: "Transfer",
            payload: { tokenId: "event_2:type_1:001", to: "0xsellerwallet", toUserId: "usr_seller" }
          }
        ]
      }
    });

    // Seller lists ticket → ListingStatusChanged active
    await invokeJson(server, {
      method: "POST",
      path: "/internal/contracts/events",
      headers: { "x-internal-api-key": "integration-test-key" },
      body: {
        events: [
          {
            blockNumber: 2002,
            transactionHash: "0xflow2_tx_002",
            logIndex: 0,
            eventName: "ListingStatusChanged",
            payload: { tokenId: "event_2:type_1:001", status: "active" }
          }
        ]
      }
    });

    let tokenState = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: "/internal/contracts/tokens/event_2:type_1:001"
      })
    );
    assert.equal(tokenState.listingStatus, "active");
    assert.equal(tokenState.ownerWalletAddress, "0xsellerwallet");

    // Buyer purchases → Transfer from escrow to buyer + ListingStatusChanged completed
    await invokeJson(server, {
      method: "POST",
      path: "/internal/contracts/events",
      headers: { "x-internal-api-key": "integration-test-key" },
      body: {
        events: [
          {
            blockNumber: 2003,
            transactionHash: "0xflow2_tx_003",
            logIndex: 0,
            eventName: "Transfer",
            payload: {
              tokenId: "event_2:type_1:001",
              to: "0xbuyerwallet002",
              toUserId: "usr_buyer2"
            }
          },
          {
            blockNumber: 2003,
            transactionHash: "0xflow2_tx_003",
            logIndex: 1,
            eventName: "ListingStatusChanged",
            payload: { tokenId: "event_2:type_1:001", status: "completed" }
          }
        ]
      }
    });

    tokenState = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: "/internal/contracts/tokens/event_2:type_1:001"
      })
    );
    assert.equal(tokenState.ownerWalletAddress, "0xbuyerwallet002");
    assert.equal(tokenState.listingStatus, "completed");
    assert.equal(tokenState.lastSyncedBlock, 2003);
  } finally {
    disposeServer(server);
  }
});

// ---------------------------------------------------------------------------
// Scenario: Flow-4 check-in worker calls TicketLedger.markUsedBatch → TicketUsed
// ---------------------------------------------------------------------------

test("contract-sync-service: Flow-4 TicketUsed event marks ticket as used", async () => {
  const { createContractSyncServer } = await importFromRepo(
    "services/contract-sync-service/dist/server.js"
  );
  const server = createContractSyncServer(CONTRACT_SYNC_CONFIG);

  try {
    // Precondition: ticket is owned
    await invokeJson(server, {
      method: "POST",
      path: "/internal/contracts/events",
      headers: { "x-internal-api-key": "integration-test-key" },
      body: {
        events: [
          {
            blockNumber: 3001,
            transactionHash: "0xflow4_tx_001",
            logIndex: 0,
            eventName: "Transfer",
            payload: { tokenId: "event_3:type_1:001", to: "0xattendee", toUserId: "usr_attendee" }
          }
        ]
      }
    });

    // Check-in worker sends TicketUsed event
    const ingestResult = assertSuccess(
      await invokeJson(server, {
        method: "POST",
        path: "/internal/contracts/events",
        headers: { "x-internal-api-key": "integration-test-key" },
        body: {
          events: [
            {
              blockNumber: 3002,
              transactionHash: "0xflow4_tx_002",
              logIndex: 0,
              eventName: "TicketUsed",
              occurredAt: "2024-07-15T18:30:00.000Z",
              payload: { tokenId: "event_3:type_1:001" }
            }
          ]
        }
      })
    );

    assert.equal(ingestResult.accepted, 1);

    const tokenState = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: "/internal/contracts/tokens/event_3:type_1:001"
      })
    );

    assert.equal(tokenState.isUsed, true);
    assert.ok(tokenState.usedAt, "usedAt should be set");
  } finally {
    disposeServer(server);
  }
});

// ---------------------------------------------------------------------------
// Scenario: Duplicate event ingestion is idempotent (replay protection)
// ---------------------------------------------------------------------------

test("contract-sync-service: duplicate events are idempotent", async () => {
  const { createContractSyncServer } = await importFromRepo(
    "services/contract-sync-service/dist/server.js"
  );
  const server = createContractSyncServer(CONTRACT_SYNC_CONFIG);

  const event = {
    blockNumber: 4001,
    transactionHash: "0xdup_tx_001",
    logIndex: 0,
    eventName: "Transfer",
    payload: { tokenId: "event_4:type_1:001", to: "0xowner_dup" }
  };

  try {
    // First ingestion
    const first = assertSuccess(
      await invokeJson(server, {
        method: "POST",
        path: "/internal/contracts/events",
        headers: { "x-internal-api-key": "integration-test-key" },
        body: { events: [event] }
      })
    );
    assert.equal(first.accepted, 1);
    assert.equal(first.duplicates, 0);

    // Second ingestion of identical event
    const second = assertSuccess(
      await invokeJson(server, {
        method: "POST",
        path: "/internal/contracts/events",
        headers: { "x-internal-api-key": "integration-test-key" },
        body: { events: [event] }
      })
    );
    assert.equal(second.accepted, 0);
    assert.equal(second.duplicates, 1);

    // Token state should still reflect the correct owner (no double-apply)
    const tokenState = assertSuccess(
      await invokeJson(server, {
        method: "GET",
        path: "/internal/contracts/tokens/event_4:type_1:001"
      })
    );
    assert.equal(tokenState.ownerWalletAddress, "0xowner_dup");
  } finally {
    disposeServer(server);
  }
});

// ---------------------------------------------------------------------------
// Scenario: Sync status endpoint reports aggregate metrics
// ---------------------------------------------------------------------------

test("contract-sync-service: sync-status aggregates across multiple events", async () => {
  const { createContractSyncServer } = await importFromRepo(
    "services/contract-sync-service/dist/server.js"
  );
  const server = createContractSyncServer(CONTRACT_SYNC_CONFIG);

  try {
    await invokeJson(server, {
      method: "POST",
      path: "/internal/contracts/events",
      headers: { "x-internal-api-key": "integration-test-key" },
      body: {
        events: [
          {
            blockNumber: 5001,
            transactionHash: "0xstatus_tx_001",
            logIndex: 0,
            eventName: "Transfer",
            payload: { tokenId: "event_5:type_1:001", to: "0xowner5a" }
          },
          {
            blockNumber: 5002,
            transactionHash: "0xstatus_tx_002",
            logIndex: 0,
            eventName: "Transfer",
            payload: { tokenId: "event_5:type_1:002", to: "0xowner5b" }
          }
        ]
      }
    });

    const status = assertSuccess(await invokeJson(server, { method: "GET", path: "/sync/status" }));

    assert.equal(status.totalEventsProcessed >= 2, true);
    assert.equal(status.lastProcessedBlock >= 5002, true);
    assert.equal(status.trackedTokens >= 2, true);
  } finally {
    disposeServer(server);
  }
});
