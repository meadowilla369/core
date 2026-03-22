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
  paymentHashTtlSec?: number;
  backendSignerPrivateKey?: string;
  ticketLedgerChainId?: number;
  ticketLedgerAddress?: string;
  prefundAmountWei?: string;
  castBinaryPath?: string;
}

export const DEFAULT_BACKEND_SIGNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const DEFAULT_TICKET_LEDGER_ADDRESS = "0x1000000000000000000000000000000000000001";
export const DEFAULT_TICKET_LEDGER_CHAIN_ID = 84532;
export const DEFAULT_PAYMENT_HASH_TTL_SEC = 24 * 60 * 60;
export const DEFAULT_WALLET_PREFUND_AMOUNT_WEI = "1000000000000000";

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

function parsePositiveIntegerString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && /^[0-9]+$/.test(normalized) ? normalized : fallback;
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
    retryBaseDelaySec: parseNumber(process.env.RETRY_BASE_DELAY_SEC, 30),
    paymentHashTtlSec: parseNumber(process.env.PAYMENT_HASH_TTL_SEC, DEFAULT_PAYMENT_HASH_TTL_SEC),
    backendSignerPrivateKey:
      process.env.BACKEND_SIGNER_PRIVATE_KEY ?? DEFAULT_BACKEND_SIGNER_PRIVATE_KEY,
    ticketLedgerChainId: parseNumber(
      process.env.TICKET_LEDGER_CHAIN_ID,
      DEFAULT_TICKET_LEDGER_CHAIN_ID
    ),
    ticketLedgerAddress: process.env.TICKET_LEDGER_ADDRESS ?? DEFAULT_TICKET_LEDGER_ADDRESS,
    prefundAmountWei: parsePositiveIntegerString(
      process.env.WALLET_PREFUND_AMOUNT_WEI,
      DEFAULT_WALLET_PREFUND_AMOUNT_WEI
    ),
    castBinaryPath: process.env.CAST_BINARY_PATH ?? "cast"
  };
}
