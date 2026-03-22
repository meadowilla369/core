import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../..");

const { createContractSyncServer } = await import(
  pathToFileURL(path.resolve(REPO_ROOT, "services/contract-sync-service/dist/server.js")).href
);

const TEST_CONFIG = {
  serviceName: "contract-sync-test",
  host: "127.0.0.1",
  port: 3099,
  internalApiKey: "test-internal-key"
};

// ---------------------------------------------------------------------------
// Minimal in-process HTTP harness (no network)
// ---------------------------------------------------------------------------

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
    if (chunk !== undefined) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(this.chunks).toString("utf8");
    this._resolve({
      status: this.statusCode,
      payload: raw.trim() ? JSON.parse(raw) : {}
    });
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

  if (body !== undefined) {
    req.write(JSON.stringify(body));
  }
  req.end();
  return responsePromise;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("GET /healthz returns ok", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, { method: "GET", url: "/healthz" });
  assert.equal(res.status, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.service, "contract-sync-test");
  assert.equal(res.payload.data.status, "ok");
});

test("POST /contract-events requires internal API key", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "wrong-key" },
    body: { events: [] }
  });
  assert.equal(res.status, 401);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error.code, "UNAUTHORIZED_INTERNAL");
});

test("POST /contract-events rejects empty events array", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: { events: [] }
  });
  assert.equal(res.status, 400);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error.code, "INVALID_EVENT_PAYLOAD");
});

test("POST /contract-events processes Transfer event and updates token state", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          chainId: 31337,
          blockNumber: 100,
          transactionHash: "0xaaa1",
          logIndex: 0,
          eventName: "Transfer",
          contractAddress: "0x1234",
          occurredAt: "2024-01-01T00:00:00.000Z",
          payload: {
            tokenId: "tok_001",
            to: "0xbuyeraddress",
            toUserId: "usr_001"
          }
        }
      ]
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.accepted, 1);
  assert.equal(res.payload.data.rejected, 0);
  assert.equal(res.payload.data.results[0].status, "processed");
});

test("GET /internal/contracts/tokens/:tokenId returns updated state after Transfer", async () => {
  const server = createContractSyncServer(TEST_CONFIG);

  await invoke(server, {
    method: "POST",
    url: "/internal/contracts/events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          blockNumber: 200,
          transactionHash: "0xbbb1",
          logIndex: 0,
          eventName: "Transfer",
          payload: { tokenId: "tok_002", to: "0xowner" }
        }
      ]
    }
  });

  const res = await invoke(server, {
    method: "GET",
    url: "/internal/contracts/tokens/tok_002"
  });
  assert.equal(res.status, 200);
  assert.equal(res.payload.data.ownerWalletAddress, "0xowner");
  assert.equal(res.payload.data.lastSyncedBlock, 200);
});

test("GET /internal/contracts/tokens/:tokenId returns 404 for unknown token", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "GET",
    url: "/internal/contracts/tokens/tok_unknown"
  });
  assert.equal(res.status, 404);
  assert.equal(res.payload.error.code, "TICKET_NOT_FOUND");
});

test("POST /contract-events deduplicates events by txHash:logIndex", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const event = {
    blockNumber: 300,
    transactionHash: "0xdup1",
    logIndex: 0,
    eventName: "Transfer",
    payload: { tokenId: "tok_003", to: "0xowner1" }
  };

  // Send twice
  await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: { events: [event] }
  });

  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: { events: [event] }
  });

  assert.equal(res.payload.data.duplicates, 1);
  assert.equal(res.payload.data.results[0].status, "duplicate");
});

test("POST /contract-events processes TicketUsed event", async () => {
  const server = createContractSyncServer(TEST_CONFIG);

  // First Transfer the token
  await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          blockNumber: 400,
          transactionHash: "0xccc1",
          logIndex: 0,
          eventName: "Transfer",
          payload: { tokenId: "tok_004", to: "0xowner2" }
        }
      ]
    }
  });

  // Then mark used
  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          blockNumber: 401,
          transactionHash: "0xccc2",
          logIndex: 0,
          eventName: "TicketUsed",
          occurredAt: "2024-06-15T12:00:00.000Z",
          payload: { tokenId: "tok_004" }
        }
      ]
    }
  });

  assert.equal(res.payload.data.accepted, 1);

  const tokenRes = await invoke(server, {
    method: "GET",
    url: "/internal/contracts/tokens/tok_004"
  });
  assert.equal(tokenRes.payload.data.isUsed, true);
  assert.ok(tokenRes.payload.data.usedAt);
});

test("POST /contract-events processes ListingStatusChanged event", async () => {
  const server = createContractSyncServer(TEST_CONFIG);

  await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          blockNumber: 500,
          transactionHash: "0xddd1",
          logIndex: 0,
          eventName: "Transfer",
          payload: { tokenId: "tok_005", to: "0xseller" }
        },
        {
          blockNumber: 501,
          transactionHash: "0xddd2",
          logIndex: 0,
          eventName: "ListingStatusChanged",
          payload: { tokenId: "tok_005", status: "active" }
        }
      ]
    }
  });

  const tokenRes = await invoke(server, {
    method: "GET",
    url: "/internal/contracts/tokens/tok_005"
  });
  assert.equal(tokenRes.payload.data.listingStatus, "active");
});

test("GET /sync/status returns aggregate counters", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          blockNumber: 600,
          transactionHash: "0xeee1",
          logIndex: 0,
          eventName: "Transfer",
          payload: { tokenId: "tok_006", to: "0xowner" }
        }
      ]
    }
  });

  const res = await invoke(server, { method: "GET", url: "/sync/status" });
  assert.equal(res.status, 200);
  assert.equal(res.payload.data.totalEventsProcessed >= 1, true);
  assert.equal(res.payload.data.lastProcessedBlock >= 600, true);
  assert.equal(res.payload.data.trackedTokens >= 1, true);
});

test("POST /contract-events rejects event with missing transactionHash", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          blockNumber: 700,
          logIndex: 0,
          eventName: "Transfer",
          payload: { tokenId: "tok_007", to: "0xowner" }
        }
      ]
    }
  });
  assert.equal(res.payload.data.rejected, 1);
  assert.equal(res.payload.data.results[0].status, "rejected");
});

test("POST /contract-events rejects unsupported event name", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      events: [
        {
          blockNumber: 800,
          transactionHash: "0xfff1",
          logIndex: 0,
          eventName: "UnknownEvent",
          payload: { tokenId: "tok_008" }
        }
      ]
    }
  });
  assert.equal(res.payload.data.rejected, 1);
  assert.ok(res.payload.data.results[0].reason.includes("Unsupported eventName"));
});

test("GET /internal/contracts/sync-status alias works", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "GET",
    url: "/internal/contracts/sync-status"
  });
  assert.equal(res.status, 200);
  assert.ok("lastProcessedBlock" in res.payload.data);
});

test("POST /contract-events accepts single event without events wrapper", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, {
    method: "POST",
    url: "/contract-events",
    headers: { "x-internal-api-key": "test-internal-key" },
    body: {
      blockNumber: 900,
      transactionHash: "0xggg1",
      logIndex: 0,
      eventName: "Transfer",
      payload: { tokenId: "tok_009", to: "0xowner9" }
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.payload.data.accepted, 1);
});

test("GET unknown route returns 404", async () => {
  const server = createContractSyncServer(TEST_CONFIG);
  const res = await invoke(server, { method: "GET", url: "/unknown-route" });
  assert.equal(res.status, 404);
  assert.equal(res.payload.error.code, "NOT_FOUND");
});
