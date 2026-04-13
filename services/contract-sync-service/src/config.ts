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
  const rpcUrl = process.env.RPC_URL?.trim();
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
