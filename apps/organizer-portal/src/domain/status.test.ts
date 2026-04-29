import assert from "node:assert/strict";
import test from "node:test";

import {
  getEventStatusTone,
  getStatusTone,
  statusTones,
  type EventLifecycleStatus,
  type OrganizerStatus
} from "./status.ts";

test("draft, scheduled, and upcoming event statuses use the info tone", () => {
  const statuses: EventLifecycleStatus[] = ["draft", "scheduled", "upcoming"];

  for (const status of statuses) {
    const tone = getEventStatusTone(status);

    assert.equal(tone.intent, "info");
    assert.equal(tone.accent, "#2563EB");
  }
});

test("active and live event statuses plus valid and resolved use success tone", () => {
  for (const status of ["active", "live"] satisfies EventLifecycleStatus[]) {
    const tone = getEventStatusTone(status);

    assert.equal(tone.intent, "success");
    assert.equal(tone.accent, "#16A34A");
  }

  assert.equal(getStatusTone("valid").intent, "success");
  assert.equal(getStatusTone("resolved").accent, "#16A34A");
});

test("cancelled, invalid, and failed statuses use critical tone", () => {
  for (const status of ["cancelled", "invalid", "failed"] satisfies OrganizerStatus[]) {
    const tone = getStatusTone(status);

    assert.equal(tone.intent, "critical");
    assert.equal(tone.accent, "#DC2626");
  }
});

test("all status tones have nonempty labels and badge classes", () => {
  for (const tone of Object.values(statusTones)) {
    assert.notEqual(tone.label.trim(), "");
    assert.match(tone.badgeClass, /\bborder\b/);
    assert.match(tone.badgeClass, /\btext-/);
  }
});
