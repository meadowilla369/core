export interface RecoveryConfig {
  serviceName: string;
  host: string;
  port: number;
  holdDurationSec: number;
  requiredVerificationChannels: number;
  eligibilityScanIntervalMs: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): RecoveryConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "recovery-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3011),
    holdDurationSec: parseNumber(process.env.RECOVERY_HOLD_DURATION_SEC, 172800),
    requiredVerificationChannels: parseNumber(process.env.REQUIRED_VERIFICATION_CHANNELS, 2),
    eligibilityScanIntervalMs: parseNumber(process.env.ELIGIBILITY_SCAN_INTERVAL_MS, 1000)
  };
}
