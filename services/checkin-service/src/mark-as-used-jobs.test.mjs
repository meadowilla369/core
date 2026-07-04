import assert from "node:assert/strict";
import test from "node:test";

import { formatMarkAsUsedJobRow, isRecoverableMarkAsUsedJob } from "./mark-as-used-jobs.ts";

test("formatMarkAsUsedJobRow returns persisted check-in job fields", () => {
  const result = formatMarkAsUsedJobRow({
    id: "mku_001",
    check_in_id: "chk_001",
    token_id: "3",
    event_id: "evt_jazz_night_2026",
    status: "processed",
    attempt_count: 1,
    next_attempt_at: "2026-07-02T10:00:00.000Z",
    created_at: "2026-07-02T09:59:00.000Z",
    updated_at: "2026-07-02T10:00:01.000Z",
    completed_at: "2026-07-02T10:00:01.000Z",
    last_error: null,
    tx_hash: "0xabc"
  });

  assert.deepEqual(result, {
    jobId: "mku_001",
    checkInId: "chk_001",
    tokenId: "3",
    eventId: "evt_jazz_night_2026",
    status: "processed",
    attempt: 1,
    nextAttemptAt: "2026-07-02T10:00:00.000Z",
    requestedAt: "2026-07-02T09:59:00.000Z",
    completedAt: "2026-07-02T10:00:01.000Z",
    lastError: null,
    txHash: "0xabc"
  });
});

test("isRecoverableMarkAsUsedJob keeps CHAIN_NOT_CONFIGURED failures retryable", () => {
  assert.equal(
    isRecoverableMarkAsUsedJob({
      status: "failed",
      last_error: "CHAIN_NOT_CONFIGURED"
    }),
    true
  );

  assert.equal(
    isRecoverableMarkAsUsedJob({
      status: "failed",
      last_error: "execution reverted"
    }),
    false
  );
});
