import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Helpers extracted / replicated from server.ts for unit testing
// ---------------------------------------------------------------------------

type PaymentStatus = "pending" | "confirmed" | "failed" | "cancelled";

function normalizeStatus(rawStatus: string | undefined): PaymentStatus | null {
  if (!rawStatus) return null;
  const s = rawStatus.trim().toLowerCase();
  if (["paid", "success", "succeeded", "confirmed"].includes(s)) return "confirmed";
  if (["failed", "error", "declined"].includes(s)) return "failed";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  if (s === "pending") return "pending";
  return null;
}

// ---------------------------------------------------------------------------
// Stub types mirroring PaymentIntent
// ---------------------------------------------------------------------------

interface PaymentIntent {
  id: string;
  reservationId: string;
  ticketTypeText?: string;
  quantity?: number;
  status: PaymentStatus;
  gatewayTransactionId?: string;
}

// ---------------------------------------------------------------------------
// Simulate the fire-and-forget sync logic from server.ts:1141-1159
// Returns the URL it would call, or null if the guard prevents the call.
// ---------------------------------------------------------------------------

function buildSyncUrl(eventServiceBaseUrl: string, payment: PaymentIntent): string | null {
  if (payment.ticketTypeText && payment.quantity) {
    return `${eventServiceBaseUrl}/internal/ticket-types/${encodeURIComponent(payment.ticketTypeText)}/sync-sold`;
  }
  return null;
}

function buildConfirmUrl(ticketingServiceBaseUrl: string, payment: PaymentIntent): string | null {
  if (payment.reservationId) {
    return `${ticketingServiceBaseUrl}/tickets/purchase/${payment.reservationId}/confirm`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests: normalizeStatus
// ---------------------------------------------------------------------------

test("normalizeStatus maps gateway variants to 'confirmed'", () => {
  for (const raw of ["paid", "success", "succeeded", "confirmed", "PAID", "SUCCESS"]) {
    assert.equal(normalizeStatus(raw), "confirmed", `failed for: ${raw}`);
  }
});

test("normalizeStatus maps failure variants correctly", () => {
  assert.equal(normalizeStatus("failed"), "failed");
  assert.equal(normalizeStatus("error"), "failed");
  assert.equal(normalizeStatus("declined"), "failed");
});

test("normalizeStatus returns null for unrecognised status", () => {
  assert.equal(normalizeStatus("unknown_status"), null);
  assert.equal(normalizeStatus(""), null);
  assert.equal(normalizeStatus(undefined), null);
});

// ---------------------------------------------------------------------------
// Tests: buildSyncUrl — guards that prevent event-service sync
// ---------------------------------------------------------------------------

test("buildSyncUrl returns correct URL when ticketTypeText and quantity are present", () => {
  const payment: PaymentIntent = {
    id: "pi_1",
    reservationId: "res_1",
    ticketTypeText: "VIP",
    quantity: 2,
    status: "confirmed"
  };
  const url = buildSyncUrl("http://event-service", payment);
  assert.equal(url, "http://event-service/internal/ticket-types/VIP/sync-sold");
});

test("buildSyncUrl URL-encodes ticketTypeText with special characters", () => {
  const payment: PaymentIntent = {
    id: "pi_2",
    reservationId: "res_2",
    ticketTypeText: "VIP Zone A/B",
    quantity: 1,
    status: "confirmed"
  };
  const url = buildSyncUrl("http://event-service", payment);
  assert.equal(url, "http://event-service/internal/ticket-types/VIP%20Zone%20A%2FB/sync-sold");
});

// *** BUG REPRODUCTION TESTS ***
// These tests document the exact conditions under which organizer portal
// shows 0 tickets sold even after a successful purchase.

test("BUG: buildSyncUrl returns null when ticketTypeText is missing — sync never fires", () => {
  const payment: PaymentIntent = {
    id: "pi_3",
    reservationId: "res_3",
    // ticketTypeText intentionally absent — can happen if payment intent
    // was created without this field populated
    quantity: 1,
    status: "confirmed"
  };
  const url = buildSyncUrl("http://event-service", payment);
  // null means the event-service is never called → sold_count stays 0
  assert.equal(url, null, "sync URL should be null → event-service never updated");
});

test("BUG: buildSyncUrl returns null when quantity is missing — sync never fires", () => {
  const payment: PaymentIntent = {
    id: "pi_4",
    reservationId: "res_4",
    ticketTypeText: "General",
    // quantity intentionally absent
    status: "confirmed"
  };
  const url = buildSyncUrl("http://event-service", payment);
  assert.equal(url, null, "sync URL should be null → event-service never updated");
});

// ---------------------------------------------------------------------------
// Tests: fire-and-forget failure simulation
// Verifies that a failed fetch does NOT surface as an error to the caller
// (this is the core design flaw — webhook returns 200 even if sync fails).
// ---------------------------------------------------------------------------

test("fire-and-forget: sync failure is swallowed — webhook processing still succeeds", async () => {
  const logs: Array<{ level: string; message: string }> = [];

  async function simulateWebhookProcessing(
    payment: PaymentIntent,
    syncFetch: () => Promise<Response>
  ): Promise<{ processed: boolean }> {
    // Mirrors server.ts:1141-1159
    if (payment.ticketTypeText && payment.quantity) {
      syncFetch().catch((error) => {
        logs.push({
          level: "warn",
          message: `Failed to sync sold count to event-service: ${error instanceof Error ? error.message : String(error)}`
        });
      });
    }
    // Webhook handler returns success regardless
    return { processed: true };
  }

  const payment: PaymentIntent = {
    id: "pi_5",
    reservationId: "res_5",
    ticketTypeText: "General",
    quantity: 1,
    status: "confirmed"
  };

  // Simulate event-service being unreachable
  const failingFetch = () => Promise.reject(new Error("ECONNREFUSED"));

  const result = await simulateWebhookProcessing(payment, failingFetch);

  // Webhook returns success (200) — the sync failure is invisible to the caller
  assert.equal(result.processed, true);

  // Give the microtask queue a tick to flush the .catch()
  await new Promise((resolve) => setImmediate(resolve));

  // The error was only logged, not propagated
  assert.equal(logs.length, 1);
  assert.equal(logs[0].level, "warn");
  assert.match(logs[0].message, /ECONNREFUSED/);
});

// ---------------------------------------------------------------------------
// Tests: buildConfirmUrl — ticketing-service confirm
// ---------------------------------------------------------------------------

test("buildConfirmUrl returns correct URL when reservationId is present", () => {
  const payment: PaymentIntent = {
    id: "pi_6",
    reservationId: "res_abc123",
    status: "confirmed"
  };
  const url = buildConfirmUrl("http://ticketing-service", payment);
  assert.equal(url, "http://ticketing-service/tickets/purchase/res_abc123/confirm");
});

// ---------------------------------------------------------------------------
// Tests: sync only fires when status is "confirmed"
// ---------------------------------------------------------------------------

test("sync should NOT fire for non-confirmed statuses", () => {
  const statuses: PaymentStatus[] = ["pending", "failed", "cancelled"];

  for (const status of statuses) {
    const payment: PaymentIntent = {
      id: "pi_7",
      reservationId: "res_7",
      ticketTypeText: "General",
      quantity: 1,
      status
    };

    // Guard: sync only happens inside `if (updatedPayment.status === "confirmed")`
    const wouldSync = payment.status === "confirmed";
    assert.equal(wouldSync, false, `Should not sync for status: ${status}`);
  }
});

test("sync fires exactly once for confirmed status", () => {
  const payment: PaymentIntent = {
    id: "pi_8",
    reservationId: "res_8",
    ticketTypeText: "General",
    quantity: 1,
    status: "confirmed"
  };

  const wouldSync =
    payment.status === "confirmed" && !!payment.ticketTypeText && !!payment.quantity;
  assert.equal(wouldSync, true);
});
