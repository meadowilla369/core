import assert from "node:assert/strict";
import test from "node:test";

import { buildOverviewModel } from "./overview.ts";
import { demoOrganizerSnapshot } from "../lib/demo-data.ts";

test("overview summarizes sales, tickets, check-in rate, and risk items", () => {
  const overview = buildOverviewModel(demoOrganizerSnapshot);

  assert.equal(overview.kpis.grossSalesVnd, 1_820_000_000);
  assert.equal(overview.kpis.ticketsSold, 7430);
  assert.equal(overview.kpis.checkinRate, 0.68);
  assert.equal(overview.kpis.openRiskItems, 12);
});

test("overview keeps newly created scheduled event informational", () => {
  const overview = buildOverviewModel(demoOrganizerSnapshot);
  const productLaunch = overview.events.find((event) => event.id === "evt_product_launch_2026");

  assert.equal(productLaunch?.status, "scheduled");
  assert.equal(productLaunch?.statusTone.name, "info");
});

test("overview exposes risk queues in priority order", () => {
  const overview = buildOverviewModel(demoOrganizerSnapshot);

  assert.deepEqual(
    overview.riskQueues.map((queue) => queue.id),
    ["refunds", "disputes", "settlement", "sync"]
  );
  assert.equal(overview.riskQueues[0].tone.name, "attention");
  assert.equal(overview.riskQueues[1].tone.name, "review");
});
