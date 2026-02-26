import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

test("e2e staff critical path: scan and metrics", async () => {
  const { StaffScannerApp } = await importFromRepo("apps/staff-scanner/dist/index.js");

  const app = new StaffScannerApp();
  const gateId = "gate-1";

  const success = app.scan({
    gateId,
    qrPayload: "sig_usr123_token123_nonce"
  });
  assert.equal(success.code, "success");

  const invalid = app.scan({
    gateId,
    qrPayload: "bad-payload"
  });
  assert.equal(invalid.code, "invalid_signature");

  const metrics = app.getGateMetrics(gateId);
  assert.equal(metrics.totalScans, 2);
  assert.equal(metrics.successCount, 1);
  assert.equal(metrics.failedCount, 1);
});
