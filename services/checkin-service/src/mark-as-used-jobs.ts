export type MarkAsUsedJobStatus = "pending" | "retrying" | "processed" | "failed";

export interface MarkAsUsedJobRow {
  id: string;
  check_in_id: string;
  token_id: string;
  event_id: string;
  status: MarkAsUsedJobStatus;
  attempt_count: number;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_error: string | null;
  tx_hash: string | null;
}

export function formatMarkAsUsedJobRow(row: MarkAsUsedJobRow) {
  return {
    jobId: row.id,
    checkInId: row.check_in_id,
    tokenId: row.token_id,
    eventId: row.event_id,
    status: row.status,
    attempt: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    requestedAt: row.created_at,
    completedAt: row.completed_at,
    lastError: row.last_error,
    txHash: row.tx_hash
  };
}

export function isRecoverableMarkAsUsedJob(input: {
  status: MarkAsUsedJobStatus;
  last_error: string | null;
}): boolean {
  return (
    input.status === "pending" ||
    input.status === "retrying" ||
    (input.status === "failed" && input.last_error === "CHAIN_NOT_CONFIGURED")
  );
}
