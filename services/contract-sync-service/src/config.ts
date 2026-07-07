export interface ContractSyncConfig {
  serviceName: string;
  host: string;
  port: number;
  internalApiKey: string;
}

/** Optional RPC listener configuration — loaded from env, absent when not set. */
export interface RpcConfig {
  rpcUrl: string;
  chainId: number;
  ticketContractAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function loadConfig(): ContractSyncConfig {
  return {
    serviceName: process.env.SERVICE_NAME ?? "contract-sync-service",
    host: process.env.HOST ?? "127.0.0.1",
    port: parseNumber(process.env.PORT, 3014),
    internalApiKey: process.env.INTERNAL_API_KEY ?? "internal-dev-key"
  };
}

/**
 * Returns RpcConfig when all required env vars are present, otherwise null.
 * Callers should check for null and skip starting the RPC listener.
 */
export function loadRpcConfig(): RpcConfig | null {
  const listenerEnabled = parseBoolean(process.env.CONTRACT_SYNC_RPC_LISTENER_ENABLED, true);
  if (!listenerEnabled) {
    return null;
  }

  const rpcUrl = process.env.CONTRACT_SYNC_RPC_URL?.trim() || process.env.RPC_URL?.trim();
  const ticketContract =
    process.env.TICKET_LEDGER_ADDRESS?.trim() ?? process.env.TICKET_NFT_ADDRESS?.trim();
  const marketplace = process.env.MARKETPLACE_ADDRESS?.trim();

  if (!rpcUrl || !ticketContract || !marketplace) {
    return null;
  }

  return {
    rpcUrl,
    chainId: parseNumber(process.env.CHAIN_ID, 31337),
    ticketContractAddress: ticketContract as `0x${string}`,
    marketplaceAddress: marketplace as `0x${string}`
  };
}
