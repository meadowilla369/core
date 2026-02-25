export interface CheckinConfig {
  serviceName: string;
  host: string;
  port: number;
  qrSignatureSecret: string;
  maxQrAgeSec: number;
  maxClockSkewSec: number;
  markAsUsedPollMs: number;
  markAsUsedMaxRetries: number;
  markAsUsedFailureRate: number;
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

export function loadConfig(): CheckinConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "checkin-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3008),
    qrSignatureSecret: process.env.QR_SIGNATURE_SECRET ?? "checkin_dev_secret",
    maxQrAgeSec: parseNumber(process.env.MAX_QR_AGE_SEC, 30),
    maxClockSkewSec: parseNumber(process.env.MAX_CLOCK_SKEW_SEC, 10),
    markAsUsedPollMs: parseNumber(process.env.MARK_AS_USED_POLL_MS, 1000),
    markAsUsedMaxRetries: parseNumber(process.env.MARK_AS_USED_MAX_RETRIES, 3),
    markAsUsedFailureRate: parseRate(process.env.MARK_AS_USED_FAILURE_RATE, 0)
  };
}
