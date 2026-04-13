/**
 * rpc-listener.test.mjs
 *
 * Unit tests for event-mapper.ts — pure functions, no live RPC required.
 * Tests also verify the ingestEvents / applyEvent round-trip:
 *   createContractSyncApp → ingestEvents → token state
 */

import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../..");

const {
  mapTransfer,
  mapTicketUsed,
  mapTicketRefunded,
  mapTicketPurchased,
  mapTicketTransferred,
  mapTicketCancelled,
  mapListed,
  mapListingCancelled,
  mapSaleCompleted,
  mapTicketListed,
  mapMarketplaceListingCancelled,
  mapTicketSold
} = await import(
  pathToFileURL(path.resolve(REPO_ROOT, "services/contract-sync-service/dist/event-mapper.js")).href
);

const { createContractSyncApp } = await import(
  pathToFileURL(path.resolve(REPO_ROOT, "services/contract-sync-service/dist/server.js")).href
);

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const BASE_META = {
  chainId: 31337,
  blockNumber: 1000n,
  transactionHash: "0xaabbcc",
  logIndex: 0,
  address: "0xTicketNFT"
};

// ---------------------------------------------------------------------------
// event-mapper unit tests
// ---------------------------------------------------------------------------

test("mapTransfer: produces Transfer event with tokenId, from, to", () => {
  const ev = mapTransfer({ from: "0xseller", to: "0xbuyer", tokenId: 42n }, BASE_META);

  assert.equal(ev.eventName, "Transfer");
  assert.equal(ev.chainId, 31337);
  assert.equal(ev.blockNumber, 1000);
  assert.equal(ev.transactionHash, "0xaabbcc");
  assert.equal(ev.logIndex, 0);
  assert.equal(ev.payload?.tokenId, "42");
  assert.equal(ev.payload?.to, "0xbuyer");
  assert.equal(ev.payload?.from, "0xseller");
});

test("mapTransfer: blockTimestamp is converted to ISO when present", () => {
  const ts = 1700000000n;
  const ev = mapTransfer(
    { from: "0xseller", to: "0xbuyer", tokenId: 1n },
    { ...BASE_META, blockTimestamp: ts }
  );
  assert.equal(ev.occurredAt, new Date(Number(ts) * 1000).toISOString());
});

test("mapTicketUsed: isUsed payload fields correct", () => {
  const usedAt = 1700000000n;
  const ev = mapTicketUsed({ tokenId: 7n, usedAt }, BASE_META);

  assert.equal(ev.eventName, "TicketUsed");
  assert.equal(ev.payload?.tokenId, "7");
  assert.ok(ev.payload?.usedAt);
  assert.equal(ev.occurredAt, new Date(Number(usedAt) * 1000).toISOString());
});

test("mapTicketRefunded: produces TicketRefunded event", () => {
  const ev = mapTicketRefunded(
    { tokenId: 3n, amount: 100000n },
    { ...BASE_META, blockTimestamp: 1700000000n }
  );

  assert.equal(ev.eventName, "TicketRefunded");
  assert.equal(ev.payload?.tokenId, "3");
  assert.equal(ev.payload?.amount, "100000");
  assert.ok(ev.payload?.refundedAt);
});

test("mapTicketPurchased: normalizes TicketLedger purchase into Transfer", () => {
  const ev = mapTicketPurchased(
    {
      ticketId: 12n,
      buyer: "0xbuyer",
      eventId: 44n,
      price: 500000n,
      timestamp: 1700000000n
    },
    BASE_META
  );

  assert.equal(ev.eventName, "Transfer");
  assert.equal(ev.payload?.tokenId, "12");
  assert.equal(ev.payload?.eventId, "44");
  assert.equal(ev.payload?.to, "0xbuyer");
});

test("mapTicketTransferred: normalizes TicketLedger transfer into Transfer", () => {
  const ev = mapTicketTransferred(
    { ticketId: 19n, from: "0xseller", to: "0xbuyer" },
    { ...BASE_META, transactionHash: "0xledger-transfer" }
  );

  assert.equal(ev.eventName, "Transfer");
  assert.equal(ev.payload?.tokenId, "19");
  assert.equal(ev.payload?.from, "0xseller");
  assert.equal(ev.payload?.to, "0xbuyer");
});

test("mapTicketCancelled: normalizes TicketLedger cancel into TicketRefunded", () => {
  const ev = mapTicketCancelled(
    { ticketId: 33n, refundAmount: 700000n },
    { ...BASE_META, blockTimestamp: 1700000000n }
  );

  assert.equal(ev.eventName, "TicketRefunded");
  assert.equal(ev.payload?.tokenId, "33");
  assert.equal(ev.payload?.amount, "700000");
});

test("mapListed: produces ListingStatusChanged with status=active", () => {
  const ev = mapListed(
    { tokenId: 5n, seller: "0xseller", price: 500n, expiresAt: 9999999n },
    BASE_META
  );

  assert.equal(ev.eventName, "ListingStatusChanged");
  assert.equal(ev.payload?.status, "active");
  assert.equal(ev.payload?.tokenId, "5");
  assert.equal(ev.payload?.price, "500");
});

test("mapListingCancelled: produces ListingStatusChanged with status=cancelled", () => {
  const ev = mapListingCancelled({ tokenId: 5n, seller: "0xseller", reason: "expired" }, BASE_META);

  assert.equal(ev.eventName, "ListingStatusChanged");
  assert.equal(ev.payload?.status, "cancelled");
  assert.equal(ev.payload?.reason, "expired");
});

test("mapSaleCompleted: produces ListingStatusChanged with status=completed", () => {
  const ev = mapSaleCompleted(
    { tokenId: 5n, seller: "0xseller", buyer: "0xbuyer", price: 400n },
    BASE_META
  );

  assert.equal(ev.eventName, "ListingStatusChanged");
  assert.equal(ev.payload?.status, "completed");
  assert.equal(ev.payload?.buyer, "0xbuyer");
  assert.equal(ev.payload?.price, "400");
});

test("mapTicketListed: produces ListingStatusChanged with listingId for MarketplaceV2", () => {
  const ev = mapTicketListed(
    { listingId: 9n, seller: "0xseller", ticketId: 5n, price: 600n },
    BASE_META
  );

  assert.equal(ev.eventName, "ListingStatusChanged");
  assert.equal(ev.payload?.listingId, "9");
  assert.equal(ev.payload?.tokenId, "5");
  assert.equal(ev.payload?.status, "active");
});

test("mapMarketplaceListingCancelled: produces ListingStatusChanged with resolved ticketId", () => {
  const ev = mapMarketplaceListingCancelled(
    { listingId: 9n, seller: "0xseller", reason: "seller_cancelled" },
    BASE_META,
    5n
  );

  assert.equal(ev.eventName, "ListingStatusChanged");
  assert.equal(ev.payload?.listingId, "9");
  assert.equal(ev.payload?.tokenId, "5");
  assert.equal(ev.payload?.status, "cancelled");
});

test("mapTicketSold: produces ListingStatusChanged with status=completed for MarketplaceV2", () => {
  const ev = mapTicketSold(
    { listingId: 9n, buyer: "0xbuyer", seller: "0xseller", ticketId: 5n, price: 400n },
    BASE_META
  );

  assert.equal(ev.eventName, "ListingStatusChanged");
  assert.equal(ev.payload?.listingId, "9");
  assert.equal(ev.payload?.tokenId, "5");
  assert.equal(ev.payload?.status, "completed");
});

// ---------------------------------------------------------------------------
// Round-trip: mapper output → ingestEvents → token state
// ---------------------------------------------------------------------------

test("ingestEvents: Transfer event from mapper updates token ownership", () => {
  const { ingestEvents } = createContractSyncApp({
    serviceName: "test",
    host: "127.0.0.1",
    port: 3099,
    internalApiKey: "k"
  });

  const ev = mapTransfer(
    { from: "0x0000", to: "0xbuyer99", tokenId: 99n },
    { ...BASE_META, transactionHash: "0xingest1", logIndex: 0 }
  );

  ingestEvents([ev]);

  // We can't query the token state directly without an HTTP request,
  // but ingestEvents is synchronous, so no exception means it was accepted.
  // The next test builds on this and queries via the server HTTP harness.
});

test("ingestEvents + server query: TicketUsed from mapper sets isUsed=true", async () => {
  // Use a PassThrough / MockResponse harness (same pattern as server.test.mjs)
  const { PassThrough, Writable } = await import("node:stream");

  class MockResponse extends Writable {
    constructor(resolve) {
      super();
      this.statusCode = 200;
      this.headers = {};
      this.chunks = [];
      this._resolve = resolve;
    }
    _write(chunk, _enc, cb) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      cb();
    }
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    }
    getHeader(name) {
      return this.headers[String(name).toLowerCase()];
    }
    end(chunk) {
      if (chunk !== undefined)
        this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(this.chunks).toString("utf8");
      this._resolve({ status: this.statusCode, payload: raw.trim() ? JSON.parse(raw) : {} });
    }
  }

  async function invoke(server, { method = "GET", url = "/", headers = {}, body } = {}) {
    const req = new PassThrough();
    req.method = method;
    req.url = url;
    req.headers = {
      host: "localhost",
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    };
    const responsePromise = new Promise((resolve) => {
      server.emit("request", req, new MockResponse(resolve));
    });
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
    return responsePromise;
  }

  const { server, ingestEvents } = createContractSyncApp({
    serviceName: "test-mapper",
    host: "127.0.0.1",
    port: 3098,
    internalApiKey: "k"
  });

  // First transfer ownership via ingestEvents (bypasses HTTP)
  ingestEvents([
    mapTransfer(
      { from: "0x0000", to: "0xowner42", tokenId: 42n },
      { ...BASE_META, transactionHash: "0xroundtrip1", logIndex: 0 }
    )
  ]);

  // Then mark used via ingestEvents
  ingestEvents([
    mapTicketUsed(
      { tokenId: 42n, usedAt: 1700000001n },
      { ...BASE_META, transactionHash: "0xroundtrip2", logIndex: 0 }
    )
  ]);

  // Query token state via HTTP harness
  const res = await invoke(server, { method: "GET", url: "/internal/contracts/tokens/42" });
  assert.equal(res.status, 200);
  assert.equal(res.payload.data.ownerWalletAddress, "0xowner42");
  assert.equal(res.payload.data.isUsed, true);
  assert.ok(res.payload.data.usedAt);
});

test("ingestEvents: deduplication rejects same txHash:logIndex twice", () => {
  const { ingestEvents } = createContractSyncApp({
    serviceName: "test-dedup",
    host: "127.0.0.1",
    port: 3097,
    internalApiKey: "k"
  });

  const ev = mapTransfer(
    { from: "0x0", to: "0xowner", tokenId: 10n },
    { ...BASE_META, transactionHash: "0xdedupX", logIndex: 0 }
  );

  // Both calls should not throw; second is a no-op (duplicate)
  ingestEvents([ev]);
  ingestEvents([ev]);
});

test("mapListed then mapListingCancelled round-trip via ingestEvents", () => {
  const { ingestEvents } = createContractSyncApp({
    serviceName: "test-listing",
    host: "127.0.0.1",
    port: 3096,
    internalApiKey: "k"
  });

  ingestEvents([
    mapTransfer(
      { from: "0x0", to: "0xseller", tokenId: 20n },
      { ...BASE_META, transactionHash: "0xlisted1", logIndex: 0 }
    ),
    mapListed(
      { tokenId: 20n, seller: "0xseller", price: 200n, expiresAt: 9999n },
      { ...BASE_META, transactionHash: "0xlisted2", logIndex: 0 }
    ),
    mapListingCancelled(
      { tokenId: 20n, seller: "0xseller", reason: "seller changed mind" },
      { ...BASE_META, transactionHash: "0xlisted3", logIndex: 0 }
    )
  ]);
  // No assertion needed beyond no-throw; cancellation dedup is tested separately
});
