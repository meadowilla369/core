export interface GatewayConfig {
  serviceName: string;
  host: string;
  port: number;
  authServiceBaseUrl: string;
  userServiceBaseUrl: string;
  kycServiceBaseUrl: string;
  eventServiceBaseUrl: string;
  ticketingServiceBaseUrl: string;
  paymentOrchestratorBaseUrl: string;
  marketplaceServiceBaseUrl: string;
  checkinServiceBaseUrl: string;
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
    userServiceBaseUrl: process.env.USER_SERVICE_BASE_URL ?? "http://127.0.0.1:3002",
    kycServiceBaseUrl: process.env.KYC_SERVICE_BASE_URL ?? "http://127.0.0.1:3003",
    eventServiceBaseUrl: process.env.EVENT_SERVICE_BASE_URL ?? "http://127.0.0.1:3004",
    ticketingServiceBaseUrl: process.env.TICKETING_SERVICE_BASE_URL ?? "http://127.0.0.1:3005",
    paymentOrchestratorBaseUrl: process.env.PAYMENT_ORCHESTRATOR_BASE_URL ?? "http://127.0.0.1:3006",
    marketplaceServiceBaseUrl: process.env.MARKETPLACE_SERVICE_BASE_URL ?? "http://127.0.0.1:3007",
    checkinServiceBaseUrl: process.env.CHECKIN_SERVICE_BASE_URL ?? "http://127.0.0.1:3008",
    requestTimeoutMs: parseNumber(process.env.REQUEST_TIMEOUT_MS, 2000)
  };
}
