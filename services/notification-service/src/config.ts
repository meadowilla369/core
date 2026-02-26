export interface NotificationConfig {
  serviceName: string;
  host: string;
  port: number;
  deliveryPollMs: number;
  maxRetries: number;
  deliveryFailureRate: number;
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

export function loadConfig(): NotificationConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "notification-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3013),
    deliveryPollMs: parseNumber(process.env.DELIVERY_POLL_MS, 1000),
    maxRetries: parseNumber(process.env.MAX_NOTIFICATION_RETRIES, 2),
    deliveryFailureRate: parseRate(process.env.DELIVERY_FAILURE_RATE, 0)
  };
}
