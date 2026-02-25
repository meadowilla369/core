export interface EventServiceConfig {
  serviceName: string;
  host: string;
  port: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): EventServiceConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "event-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3004)
  };
}
