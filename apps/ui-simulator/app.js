import { MobileBuyerApp } from "/mobile/index.js";
import { buildRotatingQr } from "/mobile/features/tickets.js";
import { StaffScannerApp } from "/staff/index.js";

const mobileApp = new MobileBuyerApp();
const staffApp = new StaffScannerApp();

let latestOtp = null;

function setOutput(id, value) {
  const node = document.getElementById(id);
  node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function mobileState(extra = {}) {
  return {
    ...extra,
    state: mobileApp.getState()
  };
}

document.getElementById("mobile-request-otp").addEventListener("click", () => {
  const phone = document.getElementById("mobile-phone").value.trim();
  latestOtp = mobileApp.requestOtp(phone);
  setOutput("mobile-output", mobileState({ latestOtp }));
});

document.getElementById("mobile-verify-otp").addEventListener("click", async () => {
  const phone = document.getElementById("mobile-phone").value.trim();
  const otp = latestOtp ? "123456" : "0000";

  try {
    await mobileApp.verifyOtp(phone, otp);
    setOutput("mobile-output", mobileState({ verified: true }));
  } catch (error) {
    setOutput("mobile-output", { error: String(error) });
  }
});

document.getElementById("mobile-start-purchase").addEventListener("click", () => {
  try {
    const eventId = document.getElementById("mobile-event-id").value.trim();
    const ticketTypeId = document.getElementById("mobile-ticket-type").value.trim();
    const qty = Number(document.getElementById("mobile-qty").value);
    const unitPrice = Number(document.getElementById("mobile-unit-price").value);

    const purchase = mobileApp.startPurchase(eventId, ticketTypeId, qty, unitPrice);
    setOutput("mobile-output", mobileState({ purchase }));
  } catch (error) {
    setOutput("mobile-output", { error: String(error) });
  }
});

document.getElementById("mobile-mark-pending").addEventListener("click", () => {
  try {
    mobileApp.markPurchasePending();
    setOutput("mobile-output", mobileState({ pending: true }));
  } catch (error) {
    setOutput("mobile-output", { error: String(error) });
  }
});

document.getElementById("mobile-finalize-success").addEventListener("click", () => {
  try {
    mobileApp.finalizePurchase(true);
    setOutput("mobile-output", mobileState({ finalized: "success" }));
  } catch (error) {
    setOutput("mobile-output", { error: String(error) });
  }
});

document.getElementById("mobile-finalize-fail").addEventListener("click", () => {
  try {
    mobileApp.finalizePurchase(false, "demo_failure");
    setOutput("mobile-output", mobileState({ finalized: "failed" }));
  } catch (error) {
    setOutput("mobile-output", { error: String(error) });
  }
});

document.getElementById("mobile-build-qr").addEventListener("click", () => {
  const tokenId = document.getElementById("mobile-token-id").value.trim();
  const state = mobileApp.getState();
  const ownerId = state.auth.userId ?? "anonymous";
  const qr = buildRotatingQr(tokenId, ownerId);

  setOutput("mobile-output", mobileState({ qr }));
});

document.getElementById("staff-scan").addEventListener("click", () => {
  const gateId = document.getElementById("staff-gate-id").value.trim();
  const qrPayload = document.getElementById("staff-qr").value.trim();

  const result = staffApp.scan({ gateId, qrPayload });
  const metrics = staffApp.getGateMetrics(gateId);

  setOutput("staff-output", { result, metrics });
});

document.getElementById("staff-refresh-metrics").addEventListener("click", () => {
  const gateId = document.getElementById("staff-gate-id").value.trim();
  setOutput("staff-output", { metrics: staffApp.getGateMetrics(gateId) });
});

setOutput("mobile-output", mobileState({ bootstrapped: true }));
setOutput("staff-output", { bootstrapped: true });
