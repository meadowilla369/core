import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

test("e2e mobile critical path: onboarding -> purchase -> qr", async () => {
  const { MobileBuyerApp } = await importFromRepo("apps/mobile/dist/index.js");
  const { buildRotatingQr } = await importFromRepo("apps/mobile/dist/features/tickets.js");

  const app = new MobileBuyerApp();

  const otpRequest = app.requestOtp("+84987654321");
  assert.ok(otpRequest.requestId);

  await app.verifyOtp("+84987654321", "123456");
  const signedInState = app.getState();
  assert.equal(signedInState.auth.status, "signed_in");
  assert.ok(signedInState.auth.userId);

  const purchase = app.startPurchase("evt_rockfest_2026", "tt_rockfest_ga", 2, 900000);
  assert.equal(purchase.state, "reserved");

  app.markPurchasePending();
  assert.equal(app.getState().activePurchase.state, "payment_pending");

  app.finalizePurchase(true);
  assert.equal(app.getState().activePurchase.state, "success");

  const qr = buildRotatingQr("token_mobile_001", signedInState.auth.userId);
  assert.equal(qr.tokenId, "token_mobile_001");
  assert.ok(qr.signature.startsWith("sig_"));
});
