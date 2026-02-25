export interface RefundConfig {
  serviceName: string;
  host: string;
  port: number;
  payoutSyncPollMs: number;
  maxRetryCount: number;
  retryBaseDelaySec: number;
  payoutFailureRate: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRate(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed < 0) {
    return 0;
  }

  if (parsed > 1) {
    return 1;
  }

  return parsed;
}

export function loadConfig(): RefundConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "refund-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3009),
    payoutSyncPollMs: parseNumber(process.env.PAYOUT_SYNC_POLL_MS, 2000),
    maxRetryCount: parseNumber(process.env.MAX_REFUND_RETRY_COUNT, 3),
    retryBaseDelaySec: parseNumber(process.env.REFUND_RETRY_BASE_DELAY_SEC, 30),
    payoutFailureRate: parseRate(process.env.PAYOUT_FAILURE_RATE, 0)
  };
}
