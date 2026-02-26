import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createCheckinSignature } from "../utils/signatures.mjs";
import { disposeServer, invokeJson } from "../utils/server-harness.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function timedInvoke(server, req) {
  const start = performance.now();
  const response = await invokeJson(server, req);
  const end = performance.now();
  return {
    response,
    durationMs: end - start
  };
}

test("load: event release and check-in peak", async () => {
  const { createEventServer } = await importFromRepo("services/event-service/dist/server.js");
  const { createCheckinServer } = await importFromRepo("services/checkin-service/dist/server.js");

  const eventServer = createEventServer({
    serviceName: "event-service",
    host: "127.0.0.1",
    port: 3004
  });
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
    const eventBurst = await Promise.all(
      Array.from({ length: 120 }, () => timedInvoke(eventServer, { method: "GET", path: "/events" }))
    );

    const eventP95 = percentile(eventBurst.map((item) => item.durationMs), 95);
    const eventErrors = eventBurst.filter((item) => item.response.status >= 500).length;

    assert.equal(eventErrors, 0);
    assert.ok(eventP95 < 500, `event list p95 too high: ${eventP95}ms`);

    const now = Math.floor(Date.now() / 1000);
    const checkins = await Promise.all(
      Array.from({ length: 80 }, (_, index) => {
        const qrData = {
          tokenId: `load_token_${index}`,
          eventId: "evt_load_001",
          timestamp: now,
          nonce: `nonce_${index}`,
          walletAddress: `0xwallet${index}`
        };

        return timedInvoke(checkinServer, {
          method: "POST",
          path: "/checkin/verify",
          body: {
            gateId: "gate-load",
            qrData: {
              ...qrData,
              signature: createCheckinSignature({ ...qrData, secret: "checkin_dev_secret" })
            }
          }
        });
      })
    );

    const checkinP95 = percentile(checkins.map((item) => item.durationMs), 95);
    const validCount = checkins.filter((item) => item.response.payload?.data?.valid === true).length;

    assert.ok(validCount >= 78, `expected >=78 valid checkins, got ${validCount}`);
    assert.ok(checkinP95 < 800, `checkin p95 too high: ${checkinP95}ms`);
  } finally {
    disposeServer(checkinServer);
    disposeServer(eventServer);
  }
});
