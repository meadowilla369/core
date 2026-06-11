export interface EventServiceConfig {
  serviceName: string;
  host: string;
  port: number;
  internalApiKey: string;
  ticketingServiceBaseUrl: string;
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
    port: parseNumber(process.env.PORT, 3004),
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal-dev-key",
    ticketingServiceBaseUrl: process.env.TICKETING_SERVICE_BASE_URL ?? "http://127.0.0.1:3005"
  };
}
