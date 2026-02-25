export type PaymentGateway = "momo" | "vnpay";

export interface PaymentOrchestratorConfig {
  serviceName: string;
  host: string;
  port: number;
  allowedGateways: PaymentGateway[];
  momoWebhookSecret: string;
  vnpayWebhookSecret: string;
  webhookMaxSkewSec: number;
  webhookNonceTtlSec: number;
  maxWebhookRetries: number;
  retryBaseDelaySec: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseGateways(rawValue: string | undefined): PaymentGateway[] {
  const raw = rawValue?.trim();
  if (!raw) {
    return ["momo", "vnpay"];
  }

  const tokens = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const gateways = new Set<PaymentGateway>();
  for (const token of tokens) {
    if (token === "momo" || token === "vnpay") {
      gateways.add(token);
    }
  }

  if (gateways.size === 0) {
    return ["momo", "vnpay"];
  }

  return Array.from(gateways);
}

export function loadConfig(): PaymentOrchestratorConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "payment-orchestrator",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3006),
    allowedGateways: parseGateways(process.env.ALLOWED_PAYMENT_GATEWAYS),
    momoWebhookSecret: process.env.MOMO_WEBHOOK_SECRET ?? "momo_dev_secret",
    vnpayWebhookSecret: process.env.VNPAY_WEBHOOK_SECRET ?? "vnpay_dev_secret",
    webhookMaxSkewSec: parseNumber(process.env.WEBHOOK_MAX_SKEW_SEC, 300),
    webhookNonceTtlSec: parseNumber(process.env.WEBHOOK_NONCE_TTL_SEC, 1800),
    maxWebhookRetries: parseNumber(process.env.MAX_WEBHOOK_RETRIES, 5),
    retryBaseDelaySec: parseNumber(process.env.RETRY_BASE_DELAY_SEC, 30)
  };
}
