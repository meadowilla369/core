import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.resolve(REPO_ROOT, relativePath)).href);
}

test("mobile ui adapter maps imported normalized data to mobile feature models", async () => {
  const { toMobileEventSummaries, toMobileTickets, toMobileListings } = await importFromRepo(
    "apps/mobile/dist/integrations/ui-adapter.js"
  );

  const events = toMobileEventSummaries([
    {
      id: "evt-001",
      title: "My Tam Live in Concert 2026",
      city: "Ha Noi",
      venue: "My Dinh Stadium, Ha Noi",
      status: "active"
    }
  ]);
  const tickets = toMobileTickets([
    {
      tokenId: "tkt-001",
      eventId: "evt-001",
      reservationId: "res_tkt-001",
      seatInfo: "VIP"
    }
  ]);
  const listings = toMobileListings([
    {
      id: "lst-001",
      tokenId: "tkt-001",
      originalPrice: 100000,
      askPrice: 120000,
      status: "active"
    }
  ]);

  assert.equal(events[0].city, "Ha Noi");
  assert.equal(tickets[0].tokenId, "tkt-001");
  assert.equal(listings[0].listingId, "lst-001");
});

test("staff ui adapter builds scan input and readable scan labels", async () => {
  const { toStaffScanInput, toStaffScanLabel } = await importFromRepo(
    "apps/staff-scanner/dist/integrations/ui-adapter.js"
  );

  const scanInput = toStaffScanInput("gate-a", { tokenId: "tkt-001" });
  assert.equal(scanInput.qrPayload, "sig_imported_tkt-001");

  const accepted = toStaffScanLabel({ code: "success", message: "ok", tokenId: "tkt-001" });
  const rejected = toStaffScanLabel({ code: "invalid_signature", message: "bad" });

  assert.equal(accepted, "accepted");
  assert.equal(rejected, "rejected");
});

test("organizer ui adapter maps imported event/listing data into analytics snapshots", async () => {
  const { toOrganizerEventInputs, toEventSalesSnapshots } = await importFromRepo(
    "apps/organizer-portal/dist/integrations/ui-adapter.js"
  );

  const importedEvents = [
    {
      id: "evt-001",
      title: "My Tam Live in Concert 2026",
      city: "Ha Noi",
      venue: "My Dinh Stadium",
      startAt: "2026-04-15T19:00:00.000Z",
      endAt: "2026-04-15T22:00:00.000Z"
    }
  ];

  const inputs = toOrganizerEventInputs(importedEvents);
  const snapshots = toEventSalesSnapshots(importedEvents, [
    { id: "l-1", eventId: "evt-001", status: "completed", askPrice: 200000 },
    { id: "l-2", eventId: "evt-001", status: "active", askPrice: 250000 }
  ]);

  assert.equal(inputs[0].title, "My Tam Live in Concert 2026");
  assert.equal(snapshots[0].soldTickets, 1);
  assert.equal(snapshots[0].grossRevenue, 200000);
});
