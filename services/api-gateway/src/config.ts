export interface GatewayConfig {
  serviceName: string;
  host: string;
  port: number;
  authServiceBaseUrl: string;
  requestTimeoutMs: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): GatewayConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "api-gateway",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3000),
    authServiceBaseUrl: process.env.AUTH_SERVICE_BASE_URL ?? "http://127.0.0.1:3001",
    requestTimeoutMs: parseNumber(process.env.REQUEST_TIMEOUT_MS, 2000)
  };
}
