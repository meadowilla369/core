export interface CheckinConfig {
  serviceName: string;
  host: string;
  port: number;
  chainId: number;
  ticketLedgerAddress: string | undefined;
  maxClockSkewSec: number;
  markAsUsedPollMs: number;
  markAsUsedMaxRetries: number;
  rpcUrl: string | undefined;
  ticketLedgerOperatorAddress: string | undefined;
  operatorPrivateKey: string | undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): CheckinConfig {
  const operatorPrivateKey =
    process.env.OPERATOR_PRIVATE_KEY?.trim() ||
    process.env.BACKEND_SIGNER_PRIVATE_KEY?.trim() ||
    process.env.PRIVATE_KEY?.trim() ||
    undefined;

  return {
    serviceName: process.env.SERVICE_NAME ?? "checkin-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3008),
    chainId: parseNumber(process.env.CHAIN_ID, 31337),
    ticketLedgerAddress: process.env.TICKET_LEDGER_ADDRESS?.trim() || undefined,
    maxClockSkewSec: parseNumber(process.env.MAX_CLOCK_SKEW_SEC, 10),
    markAsUsedPollMs: parseNumber(process.env.MARK_AS_USED_POLL_MS, 1000),
    markAsUsedMaxRetries: parseNumber(process.env.MARK_AS_USED_MAX_RETRIES, 3),
    rpcUrl: process.env.RPC_URL?.trim() || undefined,
    ticketLedgerOperatorAddress: process.env.TICKET_LEDGER_ADDRESS?.trim() || undefined,
    operatorPrivateKey
  };
}
