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

function createConfig() {
  return {
    serviceName: "api-gateway",
    host: "127.0.0.1",
    port: 3000,
    authServiceBaseUrl: "http://127.0.0.1:3001",
    userServiceBaseUrl: "http://127.0.0.1:3002",
    kycServiceBaseUrl: "http://127.0.0.1:3003",
    eventServiceBaseUrl: "http://127.0.0.1:3004",
    ticketingServiceBaseUrl: "http://127.0.0.1:3005",
    paymentOrchestratorBaseUrl: "http://127.0.0.1:3006",
    marketplaceServiceBaseUrl: "http://127.0.0.1:3007",
    checkinServiceBaseUrl: "http://127.0.0.1:3008",
    refundServiceBaseUrl: "http://127.0.0.1:3009",
    recoveryServiceBaseUrl: "http://127.0.0.1:3011",
    disputeServiceBaseUrl: "http://127.0.0.1:3012",
    notificationServiceBaseUrl: "http://127.0.0.1:3013",
    contractSyncServiceBaseUrl: "http://127.0.0.1:3014",
    requestTimeoutMs: 2000
  };
}

test("api-gateway adds CORS headers to proxied GET responses", async () => {
  const { createGatewayServer } = await importFromRepo("services/api-gateway/dist/server.js");
  const originalFetch = global.fetch;

  global.fetch = async () =>
    new Response(JSON.stringify({ success: true, data: { id: "evt_rockfest_2026" } }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    });

  const server = createGatewayServer(createConfig());

  try {
    const response = await invokeJson(server, {
      method: "GET",
      path: "/v1/events/evt_rockfest_2026",
      headers: {
        origin: "http://127.0.0.1:8080"
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers["access-control-allow-origin"], "*");
  } finally {
    global.fetch = originalFetch;
    disposeServer(server);
  }
});

test("api-gateway handles OPTIONS preflight for frontend custom headers", async () => {
  const { createGatewayServer } = await importFromRepo("services/api-gateway/dist/server.js");
  const server = createGatewayServer(createConfig());

  try {
    const response = await invokeJson(server, {
      method: "OPTIONS",
      path: "/v1/wallet/register",
      headers: {
        origin: "http://127.0.0.1:8080",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-user-id"
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers["access-control-allow-origin"], "*");
    assert.match(response.headers["access-control-allow-methods"], /POST/);
    assert.match(response.headers["access-control-allow-headers"], /x-user-id/i);
  } finally {
    disposeServer(server);
  }
});
